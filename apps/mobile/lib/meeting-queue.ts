import { Directory, File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as Crypto from "expo-crypto";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { getMobileToken, mobileApiUrl } from "./auth";

const TASK_NAME = "cognitive-mirror-meeting-upload-recovery";
const NETWORK_CHUNK_BYTES = 4 * 1024 * 1024;
const queueDirectory = new Directory(Paths.document, "meeting-queue");
const queueFile = new File(queueDirectory, "queue.json");

export type PendingMeeting = {
  localId: string;
  serverId: string | null;
  title: string;
  source: "IOS" | "ANDROID";
  fileUri: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  uploadedChunks: number[];
  attempts: number;
  lastError: string | null;
};

function ensureQueueDirectory() {
  if (!queueDirectory.exists) queueDirectory.create({ idempotent: true, intermediates: true });
}

export function readMeetingQueue(): PendingMeeting[] {
  ensureQueueDirectory();
  if (!queueFile.exists) return [];
  try { return JSON.parse(queueFile.textSync()) as PendingMeeting[]; } catch { return []; }
}

export function writeMeetingQueue(queue: PendingMeeting[]) {
  ensureQueueDirectory();
  queueFile.write(JSON.stringify(queue));
}

export function enqueueMeeting(meeting: PendingMeeting) {
  const queue = readMeetingQueue().filter((item) => item.localId !== meeting.localId);
  queue.push(meeting);
  writeMeetingQueue(queue);
}

async function apiConfiguration() {
  const token = await getMobileToken();
  if (!token) throw new Error("Sign in to upload this meeting");
  return { apiUrl: mobileApiUrl(), token };
}

async function requestJson(url: string, token: string, init: RequestInit) {
  const response = await expoFetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(String((payload as { error?: string }).error || `HTTP ${response.status}`));
  return payload as Record<string, unknown>;
}

async function uploadMeeting(meeting: PendingMeeting, persist: (next: PendingMeeting) => void) {
  const { apiUrl, token } = await apiConfiguration();
  let serverId = meeting.serverId;
  let uploaded = new Set(meeting.uploadedChunks);
  if (!serverId) {
    const created = await requestJson(`${apiUrl}/api/meetings`, token, {
      method: "POST",
      body: JSON.stringify({ title: meeting.title, started_at: meeting.startedAt, source: meeting.source, consent_confirmed: true, chunk_duration_seconds: 300 }),
    });
    serverId = String(created.id);
    meeting = { ...meeting, serverId };
    persist(meeting);
  } else {
    const state = await requestJson(`${apiUrl}/api/meetings/${serverId}`, token, { method: "GET" });
    uploaded = new Set((state.uploaded_chunks as number[] | undefined) || meeting.uploadedChunks);
  }

  const file = new File(meeting.fileUri);
  if (!file.exists) throw new Error("Local meeting audio is missing");
  const bytes = await file.bytes();
  const expectedChunks = Math.ceil(bytes.length / NETWORK_CHUNK_BYTES);
  for (let index = 0; index < expectedChunks; index += 1) {
    if (uploaded.has(index)) continue;
    const chunk = bytes.slice(index * NETWORK_CHUNK_BYTES, Math.min(bytes.length, (index + 1) * NETWORK_CHUNK_BYTES));
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, chunk);
    const checksum = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
    const response = await expoFetch(`${apiUrl}/api/meetings/${serverId}/chunks/${index}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/m4a", "X-Content-SHA256": checksum, "X-Filename": `${meeting.localId}.m4a` },
      body: chunk,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Chunk ${index} failed (${response.status})`);
    }
    uploaded.add(index);
    meeting = { ...meeting, serverId, uploadedChunks: [...uploaded].sort((a, b) => a - b), lastError: null };
    persist(meeting);
  }
  await requestJson(`${apiUrl}/api/meetings/${serverId}/complete`, token, {
    method: "POST",
    body: JSON.stringify({ expected_chunks: expectedChunks, ended_at: meeting.endedAt, duration_seconds: Math.max(1, Math.round(meeting.durationSeconds)) }),
  });
  file.delete();
}

export async function flushMeetingQueue() {
  const queue = readMeetingQueue();
  for (const original of [...queue]) {
    let current = original;
    const persist = (next: PendingMeeting) => {
      current = next;
      const live = readMeetingQueue();
      writeMeetingQueue(live.map((item) => item.localId === next.localId ? next : item));
    };
    try {
      await uploadMeeting(current, persist);
      writeMeetingQueue(readMeetingQueue().filter((item) => item.localId !== current.localId));
    } catch (error) {
      persist({ ...current, attempts: current.attempts + 1, lastError: error instanceof Error ? error.message : "Upload failed" });
    }
  }
  return readMeetingQueue();
}

if (!TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async () => {
    const remaining = await flushMeetingQueue();
    return remaining.length ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  });
}

export async function registerMeetingUploadRecovery() {
  if (!(await TaskManager.isTaskRegisteredAsync(TASK_NAME))) {
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
  }
}
