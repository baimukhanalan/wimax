import { database } from "./db";

type PushData = Record<string, string | number | boolean | null>;

export type PushMessage = {
  title: string;
  body: string;
  data?: PushData;
  sound?: "default" | null;
  channelId?: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(owner: string, message: PushMessage) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db<Array<{ token: string }>>`
    SELECT token FROM device_push_tokens WHERE user_id = ${owner} AND enabled ORDER BY last_seen_at DESC
  `;
  if (!rows.length) return { devices: 0, accepted: 0, rejected: 0 };

  let accepted = 0;
  let rejected = 0;
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(batch.map(({ token }) => ({
        to: token,
        title: message.title,
        body: message.body,
        sound: message.sound === undefined ? "default" : message.sound,
        priority: "high",
        channelId: message.channelId || "wimax-updates",
        data: message.data || {},
      }))),
    });
    if (!response.ok) throw new Error(`EXPO_PUSH_${response.status}`);
    const payload = await response.json() as { data?: ExpoTicket[] };
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    for (let offset = 0; offset < batch.length; offset += 1) {
      const ticket = tickets[offset];
      const token = batch[offset]?.token;
      if (ticket?.status === "ok") accepted += 1;
      else {
        rejected += 1;
        if (token && ticket?.details?.error === "DeviceNotRegistered") {
          await db`UPDATE device_push_tokens SET enabled = false WHERE user_id = ${owner} AND token = ${token}`;
        }
      }
    }
  }
  return { devices: rows.length, accepted, rejected };
}
