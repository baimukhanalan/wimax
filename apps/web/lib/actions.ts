import { randomUUID } from "node:crypto";
import { database, userId } from "./db";

type CommandRow = {
  id: string;
  command_type: string;
  provider: string;
  title: string;
  status: string;
  requires_confirmation: boolean;
  idempotency_key: string;
  parameters: Record<string, unknown>;
};

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`PROVIDER_${response.status}:${JSON.stringify(payload).slice(0, 500)}`);
  return payload as Record<string, unknown>;
}

async function googleAccessToken() {
  if (process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) return process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) throw new Error("GOOGLE_CALENDAR_NOT_CONFIGURED");
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(`GOOGLE_TOKEN_REFRESH_FAILED:${payload.error || response.status}`);
  return payload.access_token;
}

async function executeProviderCommand(command: CommandRow) {
  const parameters = command.parameters || {};
  if (command.provider === "APPLE_REMINDERS") {
    return { client_action: "APPLE_REMINDERS", command_id: command.id, title: command.title, parameters };
  }
  if (command.provider === "TODOIST") {
    if (!process.env.TODOIST_API_TOKEN) throw new Error("TODOIST_NOT_CONFIGURED");
    const body = {
      content: String(parameters.content || command.title),
      description: parameters.description == null ? undefined : String(parameters.description),
      due_datetime: parameters.due_datetime == null ? undefined : String(parameters.due_datetime),
      due_date: parameters.due_date == null ? undefined : String(parameters.due_date),
      project_id: parameters.project_id == null ? undefined : String(parameters.project_id),
      priority: parameters.priority == null ? undefined : Number(parameters.priority),
    };
    return fetchJson("https://api.todoist.com/api/v1/tasks", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TODOIST_API_TOKEN}`, "Content-Type": "application/json", "X-Request-Id": command.idempotency_key },
      body: JSON.stringify(body),
    });
  }
  if (command.provider === "NOTION") {
    const token = process.env.NOTION_API_TOKEN;
    const dataSourceId = String(parameters.data_source_id || process.env.NOTION_DATA_SOURCE_ID || "");
    if (!token || !dataSourceId) throw new Error("NOTION_NOT_CONFIGURED");
    const titleProperty = String(parameters.title_property || process.env.NOTION_TITLE_PROPERTY || "Name");
    return fetchJson("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": process.env.NOTION_VERSION || "2025-09-03" },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: { [titleProperty]: { title: [{ text: { content: command.title } }] } },
        children: parameters.content ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: String(parameters.content).slice(0, 1_900) } }] } }] : undefined,
      }),
    });
  }
  if (command.provider === "GOOGLE_CALENDAR") {
    const start = String(parameters.start || parameters.start_datetime || "");
    const end = String(parameters.end || parameters.end_datetime || "");
    if (!start || !end) throw new Error("CALENDAR_TIME_REQUIRED");
    const calendarId = String(parameters.calendar_id || process.env.GOOGLE_CALENDAR_ID || "primary");
    return fetchJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await googleAccessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: command.title, description: parameters.description, location: parameters.location, start: { dateTime: start }, end: { dateTime: end } }),
    });
  }
  throw new Error("UNSUPPORTED_PROVIDER");
}

export async function executeCommand(id: string, confirmed: boolean, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [command] = await db<Array<CommandRow>>`SELECT * FROM commands WHERE id = ${id} AND user_id = ${owner} LIMIT 1`;
  if (!command) throw new Error("COMMAND_NOT_FOUND");
  if (command.status === "COMPLETED") return { status: "COMPLETED", result: null, idempotent: true };
  if (command.requires_confirmation && !confirmed) throw new Error("CONFIRMATION_REQUIRED");
  if (!["PENDING_CONFIRMATION", "QUEUED", "FAILED"].includes(command.status)) throw new Error("COMMAND_NOT_EXECUTABLE");

  const [claimed] = await db<Array<CommandRow>>`
    UPDATE commands SET status = 'EXECUTING', confirmed_at = CASE WHEN ${confirmed} THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
      attempts = attempts + 1, error = NULL, updated_at = now()
    WHERE id = ${id} AND user_id = ${owner} AND status IN ('PENDING_CONFIRMATION', 'QUEUED', 'FAILED') RETURNING *
  `;
  if (!claimed) throw new Error("COMMAND_ALREADY_CLAIMED");
  try {
    const result = await executeProviderCommand(claimed);
    if (claimed.provider === "APPLE_REMINDERS") {
      await db`UPDATE commands SET status = 'QUEUED', result = ${db.json(JSON.parse(JSON.stringify(result)))}, updated_at = now() WHERE id = ${id}`;
      return { status: "AWAITING_DEVICE", result };
    }
    await db`
      UPDATE commands SET status = 'COMPLETED', result = ${db.json(JSON.parse(JSON.stringify(result)))}, executed_at = now(), updated_at = now()
      WHERE id = ${id}
    `;
    return { status: "COMPLETED", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "COMMAND_EXECUTION_FAILED";
    await db`UPDATE commands SET status = 'FAILED', error = ${message}, updated_at = now() WHERE id = ${id}`;
    throw error;
  }
}

export async function completeDeviceCommand(id: string, result: Record<string, unknown>, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [command] = await db<Array<{ id: string }>>`
    UPDATE commands SET status = 'COMPLETED', result = ${db.json(JSON.parse(JSON.stringify(result)))}, executed_at = now(), updated_at = now()
    WHERE id = ${id} AND user_id = ${owner} AND provider = 'APPLE_REMINDERS' AND status = 'QUEUED' RETURNING id
  `;
  if (!command) throw new Error("COMMAND_NOT_FOUND");
  return { status: "COMPLETED", id: command.id };
}

export async function listPendingDeviceCommands(owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db<Array<Record<string, unknown>>>`
    SELECT id, command_type AS type, provider, title, parameters, result, created_at
    FROM commands WHERE user_id = ${owner} AND provider = 'APPLE_REMINDERS' AND status = 'QUEUED'
    ORDER BY created_at LIMIT 20
  `;
}

export async function listCommands(captureId?: string | null, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return captureId
    ? db<Array<Record<string, unknown>>>`
        SELECT id, capture_id, command_type AS type, provider, title, status, requires_confirmation, parameters, result, error, created_at, updated_at
        FROM commands WHERE user_id = ${owner} AND capture_id = ${captureId} ORDER BY created_at
      `
    : db<Array<Record<string, unknown>>>`
        SELECT id, capture_id, command_type AS type, provider, title, status, requires_confirmation, parameters, result, error, created_at, updated_at
        FROM commands WHERE user_id = ${owner} ORDER BY created_at DESC LIMIT 50
      `;
}

export function newSyncIdempotencyKey() {
  return randomUUID();
}
