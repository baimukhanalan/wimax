import postgres from "postgres";
import type { DashboardResponse, ParsedCapture, SearchResponse } from "@cognitive-mirror/contracts";
import { openBytes, sealBytes } from "./crypto";
import { createHash } from "node:crypto";

let sql: ReturnType<typeof postgres> | null = null;

export function database() {
  if (!process.env.DATABASE_URL) return null;
  sql ??= postgres(process.env.DATABASE_URL, {
    max: Number(process.env.DATABASE_POOL_SIZE || 8),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return sql;
}

export function userId() {
  return process.env.MIRROR_USER_ID || "owner";
}

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export type TranscriptSegmentInput = {
  chapterIndex: number;
  speakerLabel?: string | null;
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  text: string;
  confidence?: number | null;
};

type PersistCaptureOptions = {
  transcript: string;
  processingMode?: "CLOUD" | "PRIVATE";
  language?: string | null;
  durationSeconds?: number | null;
  segments?: TranscriptSegmentInput[];
  embeddings?: Array<number[] | null>;
  metadata?: Record<string, unknown>;
  audioBytes?: ArrayBuffer | null;
  audioMimeType?: string | null;
  audioFilename?: string | null;
};

export async function persistCapture(parsed: ParsedCapture, source: string, options: PersistCaptureOptions, owner = userId()) {
  const db = database();
  if (!db) return null;

  return db.begin(async (tx) => {
    const trx = tx as unknown as NonNullable<ReturnType<typeof database>>;
    const audioEnvelope = process.env.MIRROR_STORE_ENCRYPTED_AUDIO === "true" && options.audioBytes
      ? sealBytes(new Uint8Array(options.audioBytes))
      : null;
    const [capture] = await trx<{ id: string }[]>`
      INSERT INTO captures (
        user_id, summary, dominant_sentiment, energy_score, raw_text_cleaned,
        transcript, source, processing_mode, language, duration_seconds, metadata,
        audio_envelope, audio_mime_type, audio_filename
      ) VALUES (
        ${owner}, ${parsed.summary}, ${parsed.dominant_sentiment}, ${parsed.energy_score},
        ${parsed.raw_text_cleaned}, ${options.transcript}, ${source},
        ${options.processingMode || "CLOUD"}, ${options.language || null},
        ${options.durationSeconds || null}, ${trx.json(JSON.parse(JSON.stringify(options.metadata || {})))},
        ${audioEnvelope}, ${audioEnvelope ? options.audioMimeType || "application/octet-stream" : null},
        ${audioEnvelope ? options.audioFilename || "capture-audio" : null}
      ) RETURNING id
    `;
    if (!capture) throw new Error("Capture insert failed");

    const noteIds: string[] = [];
    for (let index = 0; index < parsed.knowledge_base.length; index += 1) {
      const note = parsed.knowledge_base[index];
      if (!note) continue;
      const embedding = options.embeddings?.[index] || null;
      const [inserted] = embedding
        ? await trx<{ id: string }[]>`
            INSERT INTO knowledge_notes (capture_id, user_id, topic, category, content, tags, embedding)
            VALUES (${capture.id}, ${owner}, ${note.topic}, ${note.category}, ${note.content}, ${note.tags}, ${JSON.stringify(embedding)}::vector)
            RETURNING id
          `
        : await trx<{ id: string }[]>`
            INSERT INTO knowledge_notes (capture_id, user_id, topic, category, content, tags)
            VALUES (${capture.id}, ${owner}, ${note.topic}, ${note.category}, ${note.content}, ${note.tags})
            RETURNING id
          `;
      if (inserted) noteIds.push(inserted.id);
    }

    await Promise.all([
      ...parsed.tasks.map((task) => trx`
        INSERT INTO tasks (capture_id, user_id, title, project, due_date, priority, action_items)
        VALUES (${capture.id}, ${owner}, ${task.title}, ${task.project}, ${task.due_date}, ${task.priority}, ${trx.json(task.action_items)})
      `),
      ...parsed.habits.map((habit) => trx`
        INSERT INTO habits (capture_id, user_id, habit_name, status, metric_value, metric_unit, notes, event_date)
        VALUES (${capture.id}, ${owner}, ${habit.habit_name}, ${habit.status}, ${habit.metric_value}, ${habit.metric_unit}, ${habit.notes}, ${(options.metadata?.captureDate as string | undefined) || new Date().toISOString().slice(0, 10)})
      `),
      ...parsed.financial_transactions.map((transaction) => trx`
        INSERT INTO financial_transactions (
          capture_id, user_id, description, amount, currency, direction, category,
          occurred_at, account, merchant, notes
        ) VALUES (
          ${capture.id}, ${owner}, ${transaction.description}, ${transaction.amount},
          ${transaction.currency}, ${transaction.direction}, ${transaction.category},
          ${transaction.occurred_at}, ${transaction.account}, ${transaction.merchant}, ${transaction.notes}
        )
      `),
      ...(parsed.acoustic_profile ? [trx`
        INSERT INTO audio_signals (
          capture_id, user_id, arousal, valence, speaking_rate_wpm, pause_ratio,
          pitch_variability, confidence, evidence
        ) VALUES (
          ${capture.id}, ${owner}, ${parsed.acoustic_profile.arousal}, ${parsed.acoustic_profile.valence},
          ${parsed.acoustic_profile.speaking_rate_wpm}, ${parsed.acoustic_profile.pause_ratio},
          ${parsed.acoustic_profile.pitch_variability}, ${parsed.acoustic_profile.confidence},
          ${trx.json(parsed.acoustic_profile.evidence)}
        )
      `] : []),
      ...parsed.commands.map((command, index) => {
        const idempotencyKey = createHash("sha256")
          .update(`${capture.id}:${index}:${command.type}:${command.provider}:${command.title}`)
          .digest("hex");
        return trx`
          INSERT INTO commands (
            capture_id, user_id, command_type, provider, title, status,
            requires_confirmation, idempotency_key, parameters
          ) VALUES (
            ${capture.id}, ${owner}, ${command.type}, ${command.provider}, ${command.title},
            ${command.requires_confirmation ? "PENDING_CONFIRMATION" : "QUEUED"},
            ${command.requires_confirmation}, ${idempotencyKey}, ${trx.json(JSON.parse(JSON.stringify(command.parameters)))}
          ) ON CONFLICT (user_id, idempotency_key) DO NOTHING
        `;
      }),
      ...parsed.habits.map((habit) => trx`
        INSERT INTO habit_definitions (user_id, normalized_name, target_unit)
        VALUES (${owner}, ${habit.habit_name}, ${habit.metric_unit})
        ON CONFLICT (user_id, normalized_name) DO UPDATE SET
          target_unit = COALESCE(habit_definitions.target_unit, EXCLUDED.target_unit)
      `),
      ...(options.segments || []).map((segment) => trx`
        INSERT INTO transcript_segments (capture_id, user_id, chapter_index, speaker_label, started_at_ms, ended_at_ms, text, confidence)
        VALUES (${capture.id}, ${owner}, ${segment.chapterIndex}, ${segment.speakerLabel || null}, ${segment.startedAtMs || null}, ${segment.endedAtMs || null}, ${segment.text}, ${segment.confidence || null})
      `),
      trx`
        INSERT INTO audit_events (user_id, event_type, entity_type, entity_id, metadata)
        VALUES (${owner}, 'CAPTURE_CREATED', 'capture', ${capture.id}, ${trx.json({ source })})
      `,
    ]);

    for (const noteId of noteIds) {
      await trx`
        INSERT INTO knowledge_edges (user_id, from_note_id, to_note_id, relation, score, evidence)
        SELECT ${owner}, ${noteId}, candidate.id, 'RELATED',
          GREATEST(COALESCE(1 - (current_note.embedding <=> candidate.embedding), 0), similarity(current_note.content, candidate.content)),
          jsonb_build_object('method', 'hybrid')
        FROM knowledge_notes current_note
        JOIN LATERAL (
          SELECT id, embedding, content FROM knowledge_notes
          WHERE user_id = ${owner} AND id <> ${noteId}
          ORDER BY CASE WHEN current_note.embedding IS NULL OR embedding IS NULL THEN 2 ELSE current_note.embedding <=> embedding END,
                   similarity(current_note.content, content) DESC
          LIMIT 3
        ) candidate ON true
        WHERE current_note.id = ${noteId}
          AND GREATEST(COALESCE(1 - (current_note.embedding <=> candidate.embedding), 0), similarity(current_note.content, candidate.content)) >= 0.45
        ON CONFLICT (from_note_id, to_note_id, relation)
        DO UPDATE SET score = EXCLUDED.score, evidence = EXCLUDED.evidence
      `;
    }

    return capture.id;
  });
}

export async function getDashboard(days = 28, owner = userId()): Promise<DashboardResponse | null> {
  const db = database();
  if (!db) return null;
  const [captures, tasks, habits, knowledge, transactions, energy, stats] = await Promise.all([
    db<Array<Record<string, unknown>>>`
      SELECT id, summary, dominant_sentiment, energy_score, raw_text_cleaned, transcript, source, processing_mode,
        (audio_envelope IS NOT NULL) AS audio_available, created_at
      FROM captures WHERE user_id = ${owner} AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30
    `,
    db<Array<Record<string, unknown>>>`
      SELECT id, capture_id, title, project, due_date, priority, action_items, status, created_at, completed_at
      FROM tasks WHERE user_id = ${owner}
      ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END, due_date NULLS LAST, created_at DESC LIMIT 80
    `,
    db<Array<Record<string, unknown>>>`
      SELECT id, capture_id, habit_name, status, metric_value, metric_unit, notes, event_date, occurred_at
      FROM habits WHERE user_id = ${owner} ORDER BY event_date DESC, occurred_at DESC LIMIT 120
    `,
    db<Array<Record<string, unknown>>>`
      SELECT id, capture_id, topic, category, content, tags, created_at
      FROM knowledge_notes WHERE user_id = ${owner} ORDER BY created_at DESC LIMIT 80
    `,
    db<Array<Record<string, unknown>>>`
      SELECT id, capture_id, description, amount::float8 AS amount, currency, direction, category,
        occurred_at, account, merchant, notes, created_at
      FROM financial_transactions WHERE user_id = ${owner} ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT 120
    `,
    db<Array<Record<string, unknown>>>`
      SELECT created_at::date::text AS date, round(avg(energy_score)::numeric, 1)::float8 AS average, count(*)::int AS captures
      FROM captures
      WHERE user_id = ${owner} AND deleted_at IS NULL AND created_at >= now() - (${days}::text || ' days')::interval
      GROUP BY created_at::date ORDER BY created_at::date
    `,
    db<Array<Record<string, unknown>>>`
      SELECT
        count(*) FILTER (WHERE kind = 'task' AND state = 'OPEN')::int AS open_tasks,
        count(*) FILTER (WHERE kind = 'habit' AND state = 'COMPLETED')::int AS completed_habits,
        count(*) FILTER (WHERE kind = 'knowledge')::int AS knowledge_notes
      FROM (
        SELECT 'task' AS kind, status AS state FROM tasks WHERE user_id = ${owner}
        UNION ALL SELECT 'habit', status FROM habits WHERE user_id = ${owner} AND event_date >= current_date - 6
        UNION ALL SELECT 'knowledge', NULL FROM knowledge_notes WHERE user_id = ${owner}
      ) counters
    `,
  ]);

  const normalizedTasks = tasks.map((row) => ({ ...row, due_date: iso(row.due_date as Date | string | null), created_at: iso(row.created_at as Date | string)!, completed_at: iso(row.completed_at as Date | string | null) }));
  const normalizedHabits = habits.map((row) => ({ ...row, event_date: String(row.event_date), occurred_at: iso(row.occurred_at as Date | string)!, metric_value: row.metric_value === null ? null : Number(row.metric_value) }));
  const normalizedKnowledge = knowledge.map((row) => ({ ...row, created_at: iso(row.created_at as Date | string)! }));
  const normalizedTransactions = transactions.map((row) => ({ ...row, occurred_at: iso(row.occurred_at as Date | string | null), created_at: iso(row.created_at as Date | string)! }));
  const normalizedCaptures = captures.map((row) => ({ ...row, created_at: iso(row.created_at as Date | string)! }));
  const counter = stats[0] || {};
  const completedDates = new Set(normalizedHabits.filter((habit) => (habit as Record<string, unknown>).status === "COMPLETED").map((habit) => String(habit.event_date)));
  let currentStreak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    if (!completedDates.has(date.toISOString().slice(0, 10))) break;
    currentStreak += 1;
  }

  return {
    captures: normalizedCaptures as DashboardResponse["captures"],
    tasks: normalizedTasks as DashboardResponse["tasks"],
    habits: normalizedHabits as DashboardResponse["habits"],
    knowledge: normalizedKnowledge as DashboardResponse["knowledge"],
    financial_transactions: normalizedTransactions as DashboardResponse["financial_transactions"],
    energy: energy.map((row) => ({ date: String(row.date), average: Number(row.average), captures: Number(row.captures) })),
    stats: {
      open_tasks: Number(counter.open_tasks || 0),
      completed_habits: Number(counter.completed_habits || 0),
      knowledge_notes: Number(counter.knowledge_notes || 0),
      current_streak: currentStreak,
    },
    persisted: true,
  };
}

export async function searchMirror(query: string, embedding: number[] | null, limit: number, owner = userId()): Promise<SearchResponse | null> {
  const db = database();
  if (!db) return null;
  const vector = embedding ? JSON.stringify(embedding) : null;
  const rows = vector
    ? await db<Array<Record<string, unknown>>>`
        SELECT * FROM (
          SELECT n.id, n.capture_id, 'KNOWLEDGE' AS kind, n.topic AS title, n.content AS excerpt, n.created_at, c.source,
            GREATEST(COALESCE(1 - (n.embedding <=> ${vector}::vector), 0), similarity(n.content, ${query})) AS score
          FROM knowledge_notes n JOIN captures c ON c.id = n.capture_id
          WHERE n.user_id = ${owner} AND c.deleted_at IS NULL
          UNION ALL
          SELECT c.id, c.id, 'CAPTURE', c.summary, c.raw_text_cleaned, c.created_at, c.source, similarity(c.transcript, ${query}) AS score
          FROM captures c WHERE c.user_id = ${owner} AND c.deleted_at IS NULL
          UNION ALL
          SELECT s.id, s.capture_id, 'TRANSCRIPT',
            concat(COALESCE(s.speaker_label, 'Voice'), ' · chapter ', s.chapter_index + 1),
            s.text, s.created_at, c.source, similarity(s.text, ${query}) AS score
          FROM transcript_segments s JOIN captures c ON c.id = s.capture_id
          WHERE s.user_id = ${owner} AND c.deleted_at IS NULL
        ) hits WHERE score > 0.08 ORDER BY score DESC, created_at DESC LIMIT ${limit}
      `
    : await db<Array<Record<string, unknown>>>`
        SELECT * FROM (
          SELECT n.id, n.capture_id, 'KNOWLEDGE' AS kind, n.topic AS title, n.content AS excerpt, n.created_at, c.source, similarity(n.content, ${query}) AS score
          FROM knowledge_notes n JOIN captures c ON c.id = n.capture_id
          WHERE n.user_id = ${owner} AND c.deleted_at IS NULL
          UNION ALL
          SELECT c.id, c.id, 'CAPTURE', c.summary, c.raw_text_cleaned, c.created_at, c.source, similarity(c.transcript, ${query}) AS score
          FROM captures c WHERE c.user_id = ${owner} AND c.deleted_at IS NULL
          UNION ALL
          SELECT s.id, s.capture_id, 'TRANSCRIPT',
            concat(COALESCE(s.speaker_label, 'Voice'), ' · chapter ', s.chapter_index + 1),
            s.text, s.created_at, c.source, similarity(s.text, ${query}) AS score
          FROM transcript_segments s JOIN captures c ON c.id = s.capture_id
          WHERE s.user_id = ${owner} AND c.deleted_at IS NULL
        ) hits WHERE score > 0.08 ORDER BY score DESC, created_at DESC LIMIT ${limit}
      `;

  return {
    answer: "",
    hits: rows.map((row) => ({
      id: String(row.id), capture_id: String(row.capture_id), kind: row.kind as "CAPTURE" | "KNOWLEDGE" | "TRANSCRIPT",
      title: String(row.title), excerpt: String(row.excerpt).slice(0, 700), score: Number(row.score),
      created_at: iso(row.created_at as Date | string)!, source: row.source ? String(row.source) : null,
    })),
    persisted: true,
  };
}

export async function updateTask(id: string, patch: { status?: "OPEN" | "COMPLETED" | "CANCELLED"; due_date?: string | null; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }, owner = userId()) {
  const db = database();
  if (!db) return null;
  const [task] = await db<Array<Record<string, unknown>>>`
    UPDATE tasks SET
      status = COALESCE(${patch.status || null}, status),
      due_date = CASE WHEN ${patch.due_date === undefined} THEN due_date ELSE ${patch.due_date ?? null} END,
      priority = COALESCE(${patch.priority || null}, priority),
      completed_at = CASE WHEN ${patch.status || null} = 'COMPLETED' THEN COALESCE(completed_at, now()) WHEN ${patch.status || null} = 'OPEN' THEN NULL ELSE completed_at END,
      updated_at = now()
    WHERE id = ${id} AND user_id = ${owner} RETURNING *
  `;
  return task || null;
}

export async function getWeeklyBriefingContext(periodStart: string, periodEnd: string, owner = userId()) {
  const db = database();
  if (!db) return null;
  const [captures, tasks, habits, knowledge] = await Promise.all([
    db<Array<Record<string, unknown>>>`
      SELECT summary, dominant_sentiment, energy_score, raw_text_cleaned, created_at
      FROM captures WHERE user_id = ${owner} AND deleted_at IS NULL
        AND created_at::date BETWEEN ${periodStart}::date AND ${periodEnd}::date
      ORDER BY created_at
    `,
    db<Array<Record<string, unknown>>>`
      SELECT title, project, priority, status, due_date, completed_at
      FROM tasks WHERE user_id = ${owner} AND created_at::date BETWEEN ${periodStart}::date AND ${periodEnd}::date
      ORDER BY created_at
    `,
    db<Array<Record<string, unknown>>>`
      SELECT habit_name, status, metric_value, metric_unit, notes, event_date
      FROM habits WHERE user_id = ${owner} AND event_date BETWEEN ${periodStart}::date AND ${periodEnd}::date
      ORDER BY event_date
    `,
    db<Array<Record<string, unknown>>>`
      SELECT topic, category, content, tags, created_at
      FROM knowledge_notes WHERE user_id = ${owner} AND created_at::date BETWEEN ${periodStart}::date AND ${periodEnd}::date
      ORDER BY created_at
    `,
  ]);
  return JSON.stringify({ period_start: periodStart, period_end: periodEnd, captures, tasks, habits, knowledge }, null, 2);
}

export async function saveBriefing(input: {
  periodStart: string;
  periodEnd: string;
  title: string;
  summary: string;
  insights: string[];
  audioBytes: Buffer | null;
  audioMimeType: string | null;
}, owner = userId()): Promise<{ id: string; period_start: string; period_end: string; title: string; summary: string; insights: string[]; audio_available: boolean; created_at: string } | null> {
  const db = database();
  if (!db) return null;
  const [row] = await db<Array<{ id: string; period_start: string; period_end: string; title: string; summary: string; insights: string[]; audio_available: boolean; created_at: Date | string }>>`
    INSERT INTO briefings (user_id, period_start, period_end, title, summary, insights, audio_bytes, audio_mime_type, status)
    VALUES (${owner}, ${input.periodStart}, ${input.periodEnd}, ${input.title}, ${input.summary}, ${db.json(input.insights)}, ${input.audioBytes}, ${input.audioMimeType}, 'READY')
    ON CONFLICT (user_id, period_start, period_end) DO UPDATE SET
      title = EXCLUDED.title, summary = EXCLUDED.summary, insights = EXCLUDED.insights,
      audio_bytes = EXCLUDED.audio_bytes, audio_mime_type = EXCLUDED.audio_mime_type,
      status = 'READY', created_at = now()
    RETURNING id, period_start::text, period_end::text, title, summary, insights,
      (audio_bytes IS NOT NULL) AS audio_available, created_at
  `;
  if (!row) return null;
  return { ...row, created_at: iso(row.created_at as Date | string)! };
}

export async function getLatestBriefing(owner = userId()) {
  const db = database();
  if (!db) return null;
  const [row] = await db<Array<Record<string, unknown>>>`
    SELECT id, period_start::text, period_end::text, title, summary, insights,
      (audio_bytes IS NOT NULL) AS audio_available, created_at
    FROM briefings WHERE user_id = ${owner} AND status = 'READY'
    ORDER BY period_end DESC LIMIT 1
  `;
  return row ? { ...row, created_at: iso(row.created_at as Date | string)! } : null;
}

export async function getBriefingAudio(id: string, owner = userId()) {
  const db = database();
  if (!db) return null;
  const [row] = await db<Array<{ audio_bytes: Buffer | null; audio_mime_type: string | null }>>`
    SELECT audio_bytes, audio_mime_type FROM briefings WHERE id = ${id} AND user_id = ${owner} AND status = 'READY'
  `;
  return row?.audio_bytes ? { bytes: row.audio_bytes, mimeType: row.audio_mime_type || "audio/mpeg" } : null;
}

export async function getCaptureAudio(id: string, owner = userId()) {
  const db = database();
  if (!db) return null;
  const [row] = await db<Array<{ audio_envelope: string | null; audio_mime_type: string | null; audio_filename: string | null }>>`
    SELECT audio_envelope, audio_mime_type, audio_filename
    FROM captures WHERE id = ${id} AND user_id = ${owner} AND deleted_at IS NULL
  `;
  return row?.audio_envelope ? {
    bytes: openBytes(row.audio_envelope),
    mimeType: row.audio_mime_type || "application/octet-stream",
    filename: row.audio_filename || "capture-audio",
  } : null;
}

export async function healthcheckDatabase() {
  const db = database();
  if (!db) return { configured: false, ready: false };
  try {
    await db`SELECT 1`;
    return { configured: true, ready: true };
  } catch {
    return { configured: true, ready: false };
  }
}

export async function consumeRateLimit(keyHash: string, limit: number, windowSeconds: number) {
  const db = database();
  if (!db) return null;
  const [row] = await db<Array<{ count: number; reset_at: Date }>>`
    INSERT INTO api_rate_limits (key_hash, count, reset_at)
    VALUES (${keyHash}, 1, now() + (${windowSeconds}::text || ' seconds')::interval)
    ON CONFLICT (key_hash) DO UPDATE SET
      count = CASE WHEN api_rate_limits.reset_at <= now() THEN 1 ELSE api_rate_limits.count + 1 END,
      reset_at = CASE WHEN api_rate_limits.reset_at <= now() THEN now() + (${windowSeconds}::text || ' seconds')::interval ELSE api_rate_limits.reset_at END,
      updated_at = now()
    RETURNING count, reset_at
  `;
  return row ? { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.reset_at } : null;
}

export async function claimProviderEvent(provider: string, eventId: string) {
  const db = database();
  if (!db) return true;
  const [row] = await db<Array<{ id: string }>>`
    INSERT INTO provider_events (provider, event_id)
    VALUES (${provider}, ${eventId})
    ON CONFLICT (provider, event_id) DO UPDATE SET
      status = 'PROCESSING',
      error = NULL,
      processed_at = NULL
    WHERE provider_events.status = 'FAILED'
      AND provider_events.attempt_count < 5
      AND provider_events.next_attempt_at <= now()
    RETURNING id
  `;
  return Boolean(row);
}

export async function finishProviderEvent(provider: string, eventId: string, error?: string) {
  const db = database();
  if (!db) return;
  if (!error) {
    await db`UPDATE provider_events SET status = 'COMPLETED', error = NULL, next_attempt_at = NULL, processed_at = now() WHERE provider = ${provider} AND event_id = ${eventId}`;
    return;
  }
  await db`
    UPDATE provider_events SET
      attempt_count = attempt_count + 1,
      status = CASE WHEN attempt_count + 1 >= 5 THEN 'DEAD' ELSE 'FAILED' END,
      error = ${error},
      next_attempt_at = CASE WHEN attempt_count + 1 >= 5 THEN NULL ELSE now() + (LEAST(900, 15 * power(2, attempt_count))::text || ' seconds')::interval END,
      dead_lettered_at = CASE WHEN attempt_count + 1 >= 5 THEN now() ELSE NULL END,
      processed_at = now()
    WHERE provider = ${provider} AND event_id = ${eventId}
  `;
}

export async function exportMirrorData(owner = userId()) {
  const db = database();
  if (!db) return null;
  const [captures, tasks, habits, knowledge, segments, edges, briefings, integrations] = await Promise.all([
    db`SELECT * FROM captures WHERE user_id = ${owner} ORDER BY created_at`,
    db`SELECT * FROM tasks WHERE user_id = ${owner} ORDER BY created_at`,
    db`SELECT * FROM habits WHERE user_id = ${owner} ORDER BY occurred_at`,
    db`SELECT id, capture_id, user_id, topic, category, content, tags, created_at FROM knowledge_notes WHERE user_id = ${owner} ORDER BY created_at`,
    db`SELECT * FROM transcript_segments WHERE user_id = ${owner} ORDER BY created_at`,
    db`SELECT e.* FROM knowledge_edges e WHERE e.user_id = ${owner} ORDER BY e.created_at`,
    db`SELECT id, period_start, period_end, title, summary, insights, audio_url, status, created_at FROM briefings WHERE user_id = ${owner} ORDER BY period_start`,
    db`SELECT provider, status, sync_cursor, last_synced_at, last_error, settings, created_at, updated_at FROM integrations WHERE user_id = ${owner} ORDER BY provider`,
  ]);
  return { exported_at: new Date().toISOString(), captures, tasks, habits, knowledge, transcript_segments: segments, knowledge_edges: edges, briefings, integrations };
}

export async function deleteCapture(id: string, owner = userId()) {
  const db = database();
  if (!db) return false;
  return db.begin(async (tx) => {
    const trx = tx as unknown as NonNullable<ReturnType<typeof database>>;
    const [capture] = await trx<Array<{ id: string }>>`SELECT id FROM captures WHERE id = ${id} AND user_id = ${owner} FOR UPDATE`;
    if (!capture) return false;
    await trx`INSERT INTO audit_events (user_id, event_type, entity_type, entity_id) VALUES (${owner}, 'CAPTURE_DELETED', 'capture', ${id})`;
    await trx`DELETE FROM captures WHERE id = ${id} AND user_id = ${owner}`;
    return true;
  });
}
