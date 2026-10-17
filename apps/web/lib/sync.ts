import { createHash } from "node:crypto";
import { database, userId } from "./db";

export type SyncProvider = "NOTION" | "TODOIST" | "GOOGLE_CALENDAR";

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`SYNC_PROVIDER_${response.status}:${JSON.stringify(payload).slice(0, 400)}`);
  return payload as Record<string, unknown>;
}

async function googleToken() {
  if (process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) return process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  if (!process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("GOOGLE_CALENDAR_NOT_CONFIGURED");
  const payload = await jsonRequest("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  if (!payload.access_token) throw new Error("GOOGLE_TOKEN_REFRESH_FAILED");
  return String(payload.access_token);
}

async function syntheticCapture(provider: string, owner: string) {
  const db = database()!;
  const [row] = await db<Array<{ id: string }>>`
    INSERT INTO captures (user_id, summary, dominant_sentiment, energy_score, raw_text_cleaned, transcript, source, processing_mode, metadata)
    VALUES (${owner}, ${`Imported from ${provider}`}, 'NEUTRAL', 5, ${`Imported from ${provider}`}, '', ${`${provider}_SYNC`}, 'CLOUD', ${db.json({ synthetic: true })}) RETURNING id
  `;
  if (!row) throw new Error("SYNC_CAPTURE_FAILED");
  return row.id;
}

async function upsertExternalTask(provider: SyncProvider, external: { id: string; title: string; due: string | null; completed: boolean; updatedAt?: string | null }, owner: string) {
  const db = database()!;
  const [mapping] = await db<Array<{ local_id: string; external_updated_at: Date | string | null }>>`
    SELECT local_id, external_updated_at FROM external_mappings WHERE user_id = ${owner} AND provider = ${provider} AND entity_type = 'task' AND external_id = ${external.id}
  `;
  if (mapping) {
    if (external.updatedAt && mapping.external_updated_at && new Date(external.updatedAt) <= new Date(mapping.external_updated_at)) return "unchanged";
    await db`UPDATE tasks SET title = ${external.title}, due_date = ${external.due}, status = ${external.completed ? "COMPLETED" : "OPEN"}, updated_at = now() WHERE id::text = ${mapping.local_id} AND user_id = ${owner}`;
    await db`UPDATE external_mappings SET external_updated_at = ${external.updatedAt || null}, content_hash = ${hash(external)}, updated_at = now() WHERE user_id = ${owner} AND provider = ${provider} AND entity_type = 'task' AND external_id = ${external.id}`;
    return "updated";
  }
  const captureId = await syntheticCapture(provider, owner);
  const [task] = await db<Array<{ id: string }>>`
    INSERT INTO tasks (capture_id, user_id, title, project, due_date, priority, action_items, status, external_refs)
    VALUES (${captureId}, ${owner}, ${external.title}, ${provider}, ${external.due}, 'MEDIUM', '[]'::jsonb, ${external.completed ? "COMPLETED" : "OPEN"}, ${db.json({ [provider]: external.id })}) RETURNING id
  `;
  if (!task) throw new Error("SYNC_TASK_INSERT_FAILED");
  await saveMapping(provider, task.id, external.id, external.updatedAt || null, hash(external), owner);
  return "created";
}

function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

async function saveMapping(provider: SyncProvider, localId: string, externalId: string, externalUpdatedAt: string | null, contentHash: string, owner: string) {
  const db = database()!;
  await db`
    INSERT INTO external_mappings (user_id, provider, entity_type, local_id, external_id, external_updated_at, content_hash)
    VALUES (${owner}, ${provider}, 'task', ${localId}, ${externalId}, ${externalUpdatedAt}, ${contentHash})
    ON CONFLICT (user_id, provider, entity_type, local_id) DO UPDATE SET external_id = EXCLUDED.external_id,
      external_updated_at = EXCLUDED.external_updated_at, content_hash = EXCLUDED.content_hash, updated_at = now()
  `;
}

async function unmappedTasks(provider: SyncProvider, owner: string) {
  const db = database()!;
  return db<Array<{ id: string; title: string; due_date: Date | string | null; priority: string; status: string; action_items: string[] }>>`
    SELECT t.id, t.title, t.due_date, t.priority, t.status, t.action_items FROM tasks t
    LEFT JOIN external_mappings m ON m.user_id = t.user_id AND m.provider = ${provider} AND m.entity_type = 'task' AND m.local_id = t.id::text
    WHERE t.user_id = ${owner} AND m.id IS NULL AND t.status <> 'CANCELLED' ORDER BY t.created_at LIMIT 100
  `;
}

async function mappedTasksNeedingPush(provider: SyncProvider, owner: string) {
  const db = database()!;
  return db<Array<{ id: string; title: string; due_date: Date | string | null; priority: string; status: string; action_items: string[]; external_id: string }>>`
    SELECT t.id, t.title, t.due_date, t.priority, t.status, t.action_items, m.external_id
    FROM tasks t JOIN external_mappings m ON m.user_id = t.user_id AND m.provider = ${provider} AND m.entity_type = 'task' AND m.local_id = t.id::text
    WHERE t.user_id = ${owner} AND t.updated_at > m.updated_at AND t.status <> 'CANCELLED'
    ORDER BY t.updated_at LIMIT 100
  `;
}

async function touchMapping(provider: SyncProvider, localId: string, external: Record<string, unknown>, owner: string) {
  const db = database()!;
  const updatedAt = external.updated_at || external.updated || external.last_edited_time;
  await db`UPDATE external_mappings SET external_updated_at = ${updatedAt == null ? null : String(updatedAt)}, content_hash = ${hash(external)}, updated_at = now() WHERE user_id = ${owner} AND provider = ${provider} AND entity_type = 'task' AND local_id = ${localId}`;
}

async function syncTodoist(owner: string) {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) throw new Error("TODOIST_NOT_CONFIGURED");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let pulled = 0; let pushed = 0; let cursor: string | null = null;
  do {
    const payload = await jsonRequest(`https://api.todoist.com/api/v1/tasks?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { headers });
    const tasks = (payload.results || payload) as Array<Record<string, unknown>>;
    if (Array.isArray(tasks)) for (const task of tasks) {
      await upsertExternalTask("TODOIST", { id: String(task.id), title: String(task.content || "Untitled"), due: task.due && typeof task.due === "object" ? String((task.due as Record<string, unknown>).datetime || (task.due as Record<string, unknown>).date || "") || null : null, completed: Boolean(task.checked), updatedAt: task.updated_at ? String(task.updated_at) : null }, owner); pulled += 1;
    }
    cursor = payload.next_cursor ? String(payload.next_cursor) : null;
  } while (cursor);
  for (const task of await unmappedTasks("TODOIST", owner)) {
    const priority = task.priority === "URGENT" ? 4 : task.priority === "HIGH" ? 3 : task.priority === "MEDIUM" ? 2 : 1;
    const external = await jsonRequest("https://api.todoist.com/api/v1/tasks", { method: "POST", headers: { ...headers, "X-Request-Id": task.id }, body: JSON.stringify({ content: task.title, description: task.action_items?.join("\n"), due_datetime: task.due_date ? new Date(task.due_date).toISOString() : undefined, priority }) });
    await saveMapping("TODOIST", task.id, String(external.id), external.updated_at ? String(external.updated_at) : null, hash(external), owner); pushed += 1;
  }
  for (const task of await mappedTasksNeedingPush("TODOIST", owner)) {
    const priority = task.priority === "URGENT" ? 4 : task.priority === "HIGH" ? 3 : task.priority === "MEDIUM" ? 2 : 1;
    const external = await jsonRequest(`https://api.todoist.com/api/v1/tasks/${encodeURIComponent(task.external_id)}`, { method: "POST", headers, body: JSON.stringify({ content: task.title, description: task.action_items?.join("\n"), due_datetime: task.due_date ? new Date(task.due_date).toISOString() : null, priority }) });
    await touchMapping("TODOIST", task.id, external, owner); pushed += 1;
  }
  return { pulled, pushed };
}

function notionTitle(page: Record<string, unknown>, titleProperty: string) {
  const properties = (page.properties || {}) as Record<string, Record<string, unknown>>;
  const property = properties[titleProperty] || Object.values(properties).find((value) => value.type === "title");
  const title = property?.title as Array<{ plain_text?: string }> | undefined;
  return title?.map((item) => item.plain_text || "").join("").trim() || "Untitled";
}

async function syncNotion(owner: string) {
  const token = process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID || process.env.NOTION_DATABASE_ID;
  if (!token || !dataSourceId) throw new Error("NOTION_NOT_CONFIGURED");
  const version = process.env.NOTION_VERSION || "2025-09-03"; const titleProperty = process.env.NOTION_TITLE_PROPERTY || "Name";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": version };
  let cursor: string | null = null; let pulled = 0; let pushed = 0;
  do {
    const payload = await jsonRequest(`https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`, { method: "POST", headers, body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }) });
    for (const page of (payload.results || []) as Array<Record<string, unknown>>) {
      await upsertExternalTask("NOTION", { id: String(page.id), title: notionTitle(page, titleProperty), due: null, completed: Boolean(page.in_trash || page.archived), updatedAt: page.last_edited_time ? String(page.last_edited_time) : null }, owner); pulled += 1;
    }
    cursor = payload.has_more && payload.next_cursor ? String(payload.next_cursor) : null;
  } while (cursor);
  for (const task of await unmappedTasks("NOTION", owner)) {
    const external = await jsonRequest("https://api.notion.com/v1/pages", { method: "POST", headers, body: JSON.stringify({ parent: { type: "data_source_id", data_source_id: dataSourceId }, properties: { [titleProperty]: { title: [{ text: { content: task.title } }] } } }) });
    await saveMapping("NOTION", task.id, String(external.id), external.last_edited_time ? String(external.last_edited_time) : null, hash(external), owner); pushed += 1;
  }
  for (const task of await mappedTasksNeedingPush("NOTION", owner)) {
    const external = await jsonRequest(`https://api.notion.com/v1/pages/${encodeURIComponent(task.external_id)}`, { method: "PATCH", headers, body: JSON.stringify({ properties: { [titleProperty]: { title: [{ text: { content: task.title } }] } } }) });
    await touchMapping("NOTION", task.id, external, owner); pushed += 1;
  }
  return { pulled, pushed };
}

async function syncGoogleCalendar(owner: string) {
  const token = await googleToken(); const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const payload = await jsonRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&showDeleted=true&maxResults=2500&timeMin=${encodeURIComponent(new Date(Date.now() - 90 * 86400_000).toISOString())}`, { headers });
  let pulled = 0; let pushed = 0;
  for (const event of (payload.items || []) as Array<Record<string, unknown>>) {
    const start = event.start as Record<string, unknown> | undefined;
    await upsertExternalTask("GOOGLE_CALENDAR", { id: String(event.id), title: String(event.summary || "Calendar event"), due: start?.dateTime ? String(start.dateTime) : start?.date ? `${start.date}T23:59:59Z` : null, completed: event.status === "cancelled", updatedAt: event.updated ? String(event.updated) : null }, owner); pulled += 1;
  }
  for (const task of (await unmappedTasks("GOOGLE_CALENDAR", owner)).filter((item) => item.due_date)) {
    const start = new Date(task.due_date!); const end = new Date(start.getTime() + 30 * 60_000);
    const external = await jsonRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", headers, body: JSON.stringify({ summary: task.title, description: task.action_items?.join("\n"), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, extendedProperties: { private: { cognitiveMirrorTaskId: task.id } } }) });
    await saveMapping("GOOGLE_CALENDAR", task.id, String(external.id), external.updated ? String(external.updated) : null, hash(external), owner); pushed += 1;
  }
  for (const task of (await mappedTasksNeedingPush("GOOGLE_CALENDAR", owner)).filter((item) => item.due_date)) {
    const start = new Date(task.due_date!); const end = new Date(start.getTime() + 30 * 60_000);
    const external = await jsonRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(task.external_id)}`, { method: "PATCH", headers, body: JSON.stringify({ summary: task.title, description: task.action_items?.join("\n"), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }) });
    await touchMapping("GOOGLE_CALENDAR", task.id, external, owner); pushed += 1;
  }
  return { pulled, pushed };
}

export async function enqueueSync(provider: SyncProvider, owner = userId()) {
  const db = database(); if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [job] = await db<Array<{ id: string }>>`INSERT INTO sync_jobs (user_id, provider, direction) VALUES (${owner}, ${provider}, 'BIDIRECTIONAL') RETURNING id`;
  return job!;
}

export async function processNextSync() {
  const db = database(); if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [job] = await db<Array<{ id: string; provider: SyncProvider; user_id: string }>>`
    UPDATE sync_jobs SET status = 'RUNNING', attempts = attempts + 1, started_at = now()
    WHERE id = (SELECT id FROM sync_jobs WHERE status IN ('QUEUED', 'FAILED') AND COALESCE(next_attempt_at, now()) <= now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, provider, user_id::text
  `;
  if (!job) return null;
  try {
    const stats = job.provider === "TODOIST" ? await syncTodoist(job.user_id) : job.provider === "NOTION" ? await syncNotion(job.user_id) : await syncGoogleCalendar(job.user_id);
    await db`UPDATE sync_jobs SET status = 'COMPLETED', stats = ${db.json(stats)}, completed_at = now(), error = NULL WHERE id = ${job.id}`;
    await db`
      INSERT INTO integrations (user_id, provider, status, last_synced_at) VALUES (${job.user_id}, ${job.provider}, 'CONNECTED', now())
      ON CONFLICT (user_id, provider) DO UPDATE SET status = 'CONNECTED', last_synced_at = now(), last_error = NULL, updated_at = now()
    `;
    return { ...job, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SYNC_FAILED";
    await db`UPDATE sync_jobs SET status = 'FAILED', error = ${message}, next_attempt_at = now() + (LEAST(attempts, 6)::text || ' minutes')::interval WHERE id = ${job.id}`;
    await db`
      INSERT INTO integrations (user_id, provider, status, last_error) VALUES (${job.user_id}, ${job.provider}, 'ERROR', ${message})
      ON CONFLICT (user_id, provider) DO UPDATE SET status = 'ERROR', last_error = ${message}, updated_at = now()
    `;
    throw error;
  }
}
