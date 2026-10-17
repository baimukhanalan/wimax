import type { MeetingRecord } from "@cognitive-mirror/contracts";

const DATABASE_NAME = "wimax-meeting-recovery";
const DATABASE_VERSION = 1;
const SESSION_STORE = "sessions";
const CHUNK_STORE = "chunks";

export const WEB_MEETING_CHUNK_SECONDS = 30;

export type LocalMeetingSession = {
  localId: string;
  serverId: string | null;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  mimeType: string;
  status: "RECORDING" | "UPLOADING" | "QUEUED";
  lastError: string | null;
  updatedAt: string;
};

type LocalMeetingChunk = {
  localId: string;
  index: number;
  blob: Blob;
};

const emptySummary: MeetingQueueSummary = { pending: 0, uploaded: 0, errors: [] };
let flushTail: Promise<MeetingQueueSummary> = Promise.resolve(emptySummary);

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

function openMeetingDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE)) database.createObjectStore(SESSION_STORE, { keyPath: "localId" });
      if (!database.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = database.createObjectStore(CHUNK_STORE, { keyPath: ["localId", "index"] });
        chunks.createIndex("byMeeting", "localId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local meeting storage is unavailable"));
  });
}

async function putSession(session: LocalMeetingSession) {
  const database = await openMeetingDatabase();
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  transaction.objectStore(SESSION_STORE).put(session);
  await transactionComplete(transaction);
  database.close();
}

export async function createLocalMeeting(input: Pick<LocalMeetingSession, "localId" | "title" | "startedAt" | "mimeType">) {
  const session: LocalMeetingSession = {
    ...input,
    serverId: null,
    endedAt: null,
    durationSeconds: null,
    status: "RECORDING",
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  await putSession(session);
  return session;
}

export async function saveLocalMeetingChunk(localId: string, index: number, blob: Blob) {
  const database = await openMeetingDatabase();
  const transaction = database.transaction(CHUNK_STORE, "readwrite");
  transaction.objectStore(CHUNK_STORE).put({ localId, index, blob } satisfies LocalMeetingChunk);
  await transactionComplete(transaction);
  database.close();
}

export async function finishLocalMeeting(localId: string, endedAt: string, durationSeconds: number) {
  const session = await getSession(localId);
  if (!session) throw new Error("LOCAL_MEETING_NOT_FOUND");
  await putSession({ ...session, endedAt, durationSeconds: Math.max(1, Math.round(durationSeconds)), status: "QUEUED", updatedAt: new Date().toISOString() });
}

async function getSession(localId: string) {
  const database = await openMeetingDatabase();
  const transaction = database.transaction(SESSION_STORE, "readonly");
  const session = await requestResult(transaction.objectStore(SESSION_STORE).get(localId)) as LocalMeetingSession | undefined;
  await transactionComplete(transaction);
  database.close();
  return session || null;
}

export async function listLocalMeetings() {
  if (typeof indexedDB === "undefined") return [];
  const database = await openMeetingDatabase();
  const transaction = database.transaction(SESSION_STORE, "readonly");
  const sessions = await requestResult(transaction.objectStore(SESSION_STORE).getAll()) as LocalMeetingSession[];
  await transactionComplete(transaction);
  database.close();
  return sessions.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

async function listChunks(localId: string) {
  const database = await openMeetingDatabase();
  const transaction = database.transaction(CHUNK_STORE, "readonly");
  const chunks = await requestResult(transaction.objectStore(CHUNK_STORE).index("byMeeting").getAll(localId)) as LocalMeetingChunk[];
  await transactionComplete(transaction);
  database.close();
  return chunks.sort((left, right) => left.index - right.index);
}

async function deleteMeeting(localId: string) {
  const database = await openMeetingDatabase();
  const transaction = database.transaction([SESSION_STORE, CHUNK_STORE], "readwrite");
  transaction.objectStore(SESSION_STORE).delete(localId);
  const chunkStore = transaction.objectStore(CHUNK_STORE);
  const cursorRequest = chunkStore.index("byMeeting").openKeyCursor(IDBKeyRange.only(localId));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    chunkStore.delete(cursor.primaryKey);
    cursor.continue();
  };
  await transactionComplete(transaction);
  database.close();
}

async function checksum(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

async function uploadSession(original: LocalMeetingSession) {
  let session = original;
  let server: MeetingRecord;
  if (!session.serverId) {
    server = await requestJson<MeetingRecord>("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: session.title,
        started_at: session.startedAt,
        source: "WEB",
        consent_confirmed: true,
        chunk_duration_seconds: WEB_MEETING_CHUNK_SECONDS,
      }),
    });
    session = { ...session, serverId: server.id, status: "UPLOADING", lastError: null, updatedAt: new Date().toISOString() };
    await putSession(session);
  } else {
    const response = await fetch(`/api/meetings/${encodeURIComponent(session.serverId)}`, { method: "GET", cache: "no-store" });
    if (response.status === 404) {
      const recovered = { ...session, serverId: null, status: session.endedAt ? "QUEUED" as const : session.status, lastError: null, updatedAt: new Date().toISOString() };
      await putSession(recovered);
      return uploadSession(recovered);
    }
    const payload = await response.json().catch(() => ({})) as MeetingRecord & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Meeting lookup failed (${response.status})`);
    server = payload;
  }

  const uploaded = new Set(server.uploaded_chunks);
  const chunks = await listChunks(session.localId);
  for (const chunk of chunks) {
    if (uploaded.has(chunk.index)) continue;
    const response = await fetch(`/api/meetings/${encodeURIComponent(session.serverId!)}/chunks/${chunk.index}`, {
      method: "PUT",
      headers: {
        "Content-Type": session.mimeType || chunk.blob.type || "audio/webm",
        "X-Content-SHA256": await checksum(chunk.blob),
        "X-Filename": `${session.localId}-${chunk.index}.webm`,
      },
      body: chunk.blob,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Chunk ${chunk.index} failed (${response.status})`);
    }
  }

  if (!session.endedAt || session.durationSeconds == null) return false;
  if (!chunks.length) throw new Error("Meeting stopped before audio was captured");
  await requestJson<MeetingRecord>(`/api/meetings/${encodeURIComponent(session.serverId!)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expected_chunks: chunks.length, ended_at: session.endedAt, duration_seconds: session.durationSeconds }),
  });
  await deleteMeeting(session.localId);
  return true;
}

export type MeetingQueueSummary = { pending: number; uploaded: number; errors: string[] };

async function flushNow(): Promise<MeetingQueueSummary> {
  const sessions = await listLocalMeetings();
  let uploaded = 0;
  const errors: string[] = [];
  for (const session of sessions) {
    try {
      if (await uploadSession(session)) uploaded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meeting upload failed";
      errors.push(message);
      const current = await getSession(session.localId);
      if (current) await putSession({ ...current, status: current.endedAt ? "QUEUED" : current.status, lastError: message, updatedAt: new Date().toISOString() });
    }
  }
  return { pending: (await listLocalMeetings()).filter((session) => session.endedAt != null).length, uploaded, errors };
}

export function flushMeetingQueue() {
  const run = flushTail.catch(() => emptySummary).then(() => flushNow());
  flushTail = run;
  return run;
}

export async function recoverInterruptedMeetings() {
  const now = new Date();
  const sessions = await listLocalMeetings();
  for (const session of sessions) {
    if (session.endedAt) continue;
    const durationSeconds = Math.max(1, Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1_000));
    await putSession({ ...session, endedAt: now.toISOString(), durationSeconds, status: "QUEUED", lastError: "Recording was interrupted; recovered locally saved audio.", updatedAt: now.toISOString() });
  }
  return flushMeetingQueue();
}
