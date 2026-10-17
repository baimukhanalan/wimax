import { database, userId } from "./db";
import { synthesizeBriefing } from "./ai";
import { sendPushToUser } from "./push";

type CoachingSignal = { trigger: string; title: string; body: string; evidence: Record<string, unknown> };

async function detectSignal(owner = userId()): Promise<CoachingSignal | null> {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [metrics] = await db<Array<Record<string, unknown>>>`
    SELECT
      avg(energy_score) FILTER (WHERE created_at >= now() - interval '3 days')::float8 AS recent_energy,
      avg(energy_score) FILTER (WHERE created_at >= now() - interval '10 days' AND created_at < now() - interval '3 days')::float8 AS baseline_energy,
      count(*) FILTER (WHERE created_at >= now() - interval '3 days' AND dominant_sentiment IN ('ANXIOUS', 'EXHAUSTED'))::int AS strain_captures,
      count(*) FILTER (WHERE created_at >= now() - interval '3 days')::int AS recent_captures
    FROM captures WHERE user_id = ${owner} AND deleted_at IS NULL
  `;
  if (!metrics || Number(metrics.recent_captures || 0) < 2) return null;
  const recent = Number(metrics.recent_energy || 0);
  const baseline = Number(metrics.baseline_energy || 0);
  const strain = Number(metrics.strain_captures || 0);
  if (baseline > 0 && baseline - recent >= 2) return {
    trigger: "ENERGY_DROP",
    title: "A gentle check-in from WIMAX",
    body: `Your reported energy averaged ${recent.toFixed(1)} over the last three days, about ${(baseline - recent).toFixed(1)} below your previous baseline. Consider protecting one recovery block today.`,
    evidence: { recent_energy: recent, baseline_energy: baseline, window_days: 3 },
  };
  if (strain >= 2) return {
    trigger: "REPEATED_STRAIN",
    title: "A pattern worth noticing",
    body: "Several recent check-ins contained anxious or exhausted signals. This is not a diagnosis; consider reducing one nonessential commitment and checking in with someone you trust.",
    evidence: { strain_captures: strain, window_days: 3 },
  };
  return null;
}

export async function evaluateCoaching(owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const signal = await detectSignal(owner);
  if (!signal) return { created: false, reason: "NO_SIGNAL" };
  const recent = await db<Array<{ id: string }>>`
    SELECT id FROM coaching_notifications WHERE user_id = ${owner} AND trigger_type = ${signal.trigger}
      AND created_at >= now() - interval '72 hours' LIMIT 1
  `;
  if (recent.length) return { created: false, reason: "COOLDOWN" };
  let audioBytes: Buffer | null = null;
  let audioMimeType: string | null = null;
  try {
    const audio = await synthesizeBriefing(`${signal.title}. ${signal.body}`);
    audioBytes = audio.bytes;
    audioMimeType = audio.mimeType;
  } catch (error) {
    console.warn("coaching_audio_failed", { message: error instanceof Error ? error.message : "unknown" });
  }
  const [notification] = await db<Array<{ id: string }>>`
    INSERT INTO coaching_notifications (user_id, trigger_type, title, body, evidence, audio_bytes, audio_mime_type)
    VALUES (${owner}, ${signal.trigger}, ${signal.title}, ${signal.body}, ${db.json(JSON.parse(JSON.stringify(signal.evidence)))}, ${audioBytes}, ${audioMimeType}) RETURNING id
  `;
  if (!notification) throw new Error("COACHING_INSERT_FAILED");
  const push = await sendPushToUser(owner, { title: signal.title, body: signal.body, data: { kind: "COACHING", screen: "Inbox", coaching_notification_id: notification.id, audio_path: `/api/coaching/${notification.id}/audio` } });
  await db`UPDATE coaching_notifications SET status = ${push.accepted ? "SENT" : "QUEUED"}, sent_at = CASE WHEN ${push.accepted > 0} THEN now() ELSE NULL END WHERE id = ${notification.id}`;
  return { created: true, id: notification.id, push };
}

export async function registerPushToken(input: { token: string; platform: "IOS" | "ANDROID"; locale?: string; timezone?: string }, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db`
    INSERT INTO device_push_tokens (user_id, platform, token, locale, timezone)
    VALUES (${owner}, ${input.platform}, ${input.token}, ${input.locale || null}, ${input.timezone || null})
    ON CONFLICT (user_id, token) DO UPDATE SET platform = EXCLUDED.platform, locale = EXCLUDED.locale,
      timezone = EXCLUDED.timezone, enabled = true, last_seen_at = now()
  `;
  return { registered: true };
}

export async function getCoachingAudio(id: string, owner = userId()) {
  const db = database();
  if (!db) return null;
  const [row] = await db<Array<{ audio_bytes: Buffer | null; audio_mime_type: string | null }>>`
    SELECT audio_bytes, audio_mime_type FROM coaching_notifications WHERE id = ${id} AND user_id = ${owner}
  `;
  return row?.audio_bytes ? { bytes: row.audio_bytes, mimeType: row.audio_mime_type || "audio/mpeg" } : null;
}
