import { createHash } from "node:crypto";
import type { MeetingRecord } from "@cognitive-mirror/contracts";
import { meetingRecordSchema } from "@cognitive-mirror/contracts";
import { processTranscriptCapture } from "./capture-service";
import { transcribeAudio } from "./ai";
import { database, userId, type TranscriptSegmentInput } from "./db";
import { sendPushToUser } from "./push";

type MeetingCreate = {
  title: string;
  started_at: string;
  source: "IOS" | "ANDROID" | "WEB" | "IMPORT";
  chunk_duration_seconds: number;
};

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function createMeeting(input: MeetingCreate, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [row] = await db<Array<Record<string, unknown>>>`
    INSERT INTO meetings (user_id, title, source, started_at, chunk_duration_seconds, consent_confirmed_at)
    VALUES (${owner}, ${input.title}, ${input.source}, ${input.started_at}, ${input.chunk_duration_seconds}, now())
    RETURNING *
  `;
  if (!row) throw new Error("MEETING_CREATE_FAILED");
  return normalizeMeeting(row, []);
}

export async function getMeeting(id: string, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [row, chunks] = await Promise.all([
    db<Array<Record<string, unknown>>>`SELECT * FROM meetings WHERE id = ${id} AND user_id = ${owner} LIMIT 1`,
    db<Array<{ chunk_index: number }>>`SELECT chunk_index FROM meeting_chunks WHERE meeting_id = ${id} ORDER BY chunk_index`,
  ]);
  if (!row[0]) return null;
  return normalizeMeeting(row[0], chunks.map((chunk) => Number(chunk.chunk_index)));
}

function normalizeMeeting(row: Record<string, unknown>, uploadedChunks: number[]) {
  return meetingRecordSchema.parse({
    id: row.id,
    title: row.title,
    status: row.status,
    started_at: iso(row.started_at as Date | string),
    ended_at: iso(row.ended_at as Date | string | null),
    duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    chunk_duration_seconds: Number(row.chunk_duration_seconds),
    expected_chunks: row.expected_chunks == null ? null : Number(row.expected_chunks),
    uploaded_chunks: uploadedChunks,
    total_bytes: Number(row.total_bytes || 0),
    capture_id: row.capture_id || null,
    error: row.error || null,
    created_at: iso(row.created_at as Date | string),
    updated_at: iso(row.updated_at as Date | string),
  });
}

export async function storeMeetingChunk(input: {
  meetingId: string;
  chunkIndex: number;
  bytes: Buffer;
  mimeType: string;
  filename: string;
  checksum: string;
}, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const actualChecksum = createHash("sha256").update(input.bytes).digest("hex");
  if (actualChecksum !== input.checksum.toLowerCase()) throw new Error("CHECKSUM_MISMATCH");
  return db.begin(async (tx) => {
    const trx = tx as unknown as NonNullable<ReturnType<typeof database>>;
    const [meeting] = await trx<Array<{ status: string }>>`
      SELECT status FROM meetings WHERE id = ${input.meetingId} AND user_id = ${owner} FOR UPDATE
    `;
    if (!meeting) throw new Error("MEETING_NOT_FOUND");
    if (["PROCESSING", "READY", "CANCELLED"].includes(meeting.status)) throw new Error("MEETING_NOT_WRITABLE");
    const existing = await trx<Array<{ checksum_sha256: string; byte_length: number }>>`
      SELECT checksum_sha256, byte_length FROM meeting_chunks
      WHERE meeting_id = ${input.meetingId} AND chunk_index = ${input.chunkIndex}
    `;
    if (existing[0]) {
      if (existing[0].checksum_sha256 !== actualChecksum || Number(existing[0].byte_length) !== input.bytes.length) {
        throw new Error("CHUNK_CONFLICT");
      }
      return { stored: false, checksum: actualChecksum };
    }
    await trx`
      INSERT INTO meeting_chunks (meeting_id, chunk_index, mime_type, filename, checksum_sha256, byte_length, payload)
      VALUES (${input.meetingId}, ${input.chunkIndex}, ${input.mimeType}, ${input.filename}, ${actualChecksum}, ${input.bytes.length}, ${input.bytes})
    `;
    await trx`
      UPDATE meetings SET status = 'UPLOADING', total_bytes = total_bytes + ${input.bytes.length}, updated_at = now(), error = NULL
      WHERE id = ${input.meetingId}
    `;
    return { stored: true, checksum: actualChecksum };
  });
}

export async function completeMeeting(id: string, input: { expected_chunks: number; ended_at: string; duration_seconds: number }, owner = userId()) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.begin(async (tx) => {
    const trx = tx as unknown as NonNullable<ReturnType<typeof database>>;
    const [meeting] = await trx<Array<{ status: string }>>`
      SELECT status FROM meetings WHERE id = ${id} AND user_id = ${owner} FOR UPDATE
    `;
    if (!meeting) throw new Error("MEETING_NOT_FOUND");
    if (meeting.status === "READY") return;
    const chunks = await trx<Array<{ chunk_index: number }>>`
      SELECT chunk_index FROM meeting_chunks WHERE meeting_id = ${id} ORDER BY chunk_index
    `;
    const missing = missingChunkIndices(input.expected_chunks, chunks.map((chunk) => Number(chunk.chunk_index)));
    if (missing.length) {
      const error = new Error("MISSING_CHUNKS");
      Object.assign(error, { missing });
      throw error;
    }
    await trx`
      UPDATE meetings SET status = 'QUEUED', expected_chunks = ${input.expected_chunks}, ended_at = ${input.ended_at},
        duration_seconds = ${input.duration_seconds}, next_attempt_at = now(), error = NULL, updated_at = now()
      WHERE id = ${id}
    `;
  });
  return getMeeting(id, owner);
}

export function missingChunkIndices(expectedChunks: number, uploadedChunks: number[]) {
  const uploaded = new Set(uploadedChunks);
  return Array.from({ length: expectedChunks }, (_, index) => index).filter((index) => !uploaded.has(index));
}

export async function processNextMeeting(meetingId?: string, owner?: string): Promise<MeetingRecord | null> {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [claimed] = meetingId
    ? await db<Array<{ id: string; user_id: string; chunk_duration_seconds: number; started_at: Date | string }>>`
        UPDATE meetings SET status = 'PROCESSING', processing_attempts = processing_attempts + 1, updated_at = now()
        WHERE id = (
          SELECT id FROM meetings
          WHERE id = ${meetingId} AND user_id = ${owner || userId()} AND status IN ('QUEUED', 'FAILED')
            AND COALESCE(next_attempt_at, now()) <= now()
          FOR UPDATE SKIP LOCKED LIMIT 1
        ) RETURNING id, user_id, chunk_duration_seconds, started_at
      `
    : owner
      ? await db<Array<{ id: string; user_id: string; chunk_duration_seconds: number; started_at: Date | string }>>`
        UPDATE meetings SET status = 'PROCESSING', processing_attempts = processing_attempts + 1, updated_at = now()
        WHERE id = (
          SELECT id FROM meetings
          WHERE user_id = ${owner} AND status IN ('QUEUED', 'FAILED') AND COALESCE(next_attempt_at, now()) <= now()
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        ) RETURNING id, user_id, chunk_duration_seconds, started_at
      `
      : await db<Array<{ id: string; user_id: string; chunk_duration_seconds: number; started_at: Date | string }>>`
        UPDATE meetings SET status = 'PROCESSING', processing_attempts = processing_attempts + 1, updated_at = now()
        WHERE id = (
          SELECT id FROM meetings
          WHERE status IN ('QUEUED', 'FAILED') AND COALESCE(next_attempt_at, now()) <= now()
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        ) RETURNING id, user_id, chunk_duration_seconds, started_at
      `;
  if (!claimed) return null;
  const claimedOwner = claimed.user_id;

  try {
    const chunks = await db<Array<{ chunk_index: number; mime_type: string; filename: string; payload: Buffer }>>`
      SELECT chunk_index, mime_type, filename, payload FROM meeting_chunks
      WHERE meeting_id = ${claimed.id} ORDER BY chunk_index
    `;
    if (!chunks.length) throw new Error("MEETING_HAS_NO_CHUNKS");
    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.payload.length, 0);
    if (totalBytes > 25 * 1024 * 1024) throw new Error("MEETING_AUDIO_EXCEEDS_TRANSCRIPTION_LIMIT");
    const combined = Buffer.concat(chunks.map((chunk) => chunk.payload), totalBytes);
    const firstChunk = chunks[0]!;
    const combinedBytes = combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength) as ArrayBuffer;
    const result = await transcribeAudio(combinedBytes, firstChunk.filename, firstChunk.mime_type, true, "CLOUD");
    const transcriptParts = [result.text];
    const allSegments: TranscriptSegmentInput[] = result.segments;
    const totalDuration = result.durationSeconds || 0;
    const capture = await processTranscriptCapture({
      transcript: transcriptParts.join("\n\n"),
      currentDateTime: iso(claimed.started_at) || new Date().toISOString(),
      source: "MEETING",
      durationSeconds: totalDuration,
      segments: allSegments,
      audioBytes: null,
      userId: claimedOwner,
    });
    await db.begin(async (tx) => {
      const trx = tx as unknown as NonNullable<ReturnType<typeof database>>;
      await trx`UPDATE meetings SET status = 'READY', capture_id = ${capture.capture_id}, error = NULL, updated_at = now() WHERE id = ${claimed.id}`;
      await trx`DELETE FROM meeting_chunks WHERE meeting_id = ${claimed.id}`;
    });
    await sendPushToUser(claimedOwner, {
      title: "Your meeting is ready",
      body: "WIMAX created the transcript, chapters and action items.",
      data: { kind: "MEETING_READY", screen: "Inbox", meeting_id: claimed.id, capture_id: capture.capture_id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting processing failed";
    await db`
      UPDATE meetings SET status = 'FAILED', error = ${message},
        next_attempt_at = now() + (LEAST(processing_attempts, 6)::text || ' minutes')::interval, updated_at = now()
      WHERE id = ${claimed.id}
    `;
    throw error;
  }
  return getMeeting(claimed.id, claimedOwner);
}
