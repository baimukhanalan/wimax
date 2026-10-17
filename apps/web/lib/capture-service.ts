import type { CaptureResponse } from "@cognitive-mirror/contracts";
import { embedTexts, parseTranscript, transcribeAudio } from "./ai";
import { persistCapture, type TranscriptSegmentInput } from "./db";
import { applyAcousticContext, deriveAcousticProfile } from "./acoustic";

type CommonInput = {
  currentDateTime: string;
  source: string;
  processingMode?: "CLOUD" | "PRIVATE";
  userId?: string;
};

export async function processTranscriptCapture(input: CommonInput & {
  transcript: string;
  durationSeconds?: number | null;
  segments?: TranscriptSegmentInput[];
  audioBytes?: ArrayBuffer | null;
  audioMimeType?: string | null;
  audioFilename?: string | null;
  metering?: { averageDb?: number | null; peakDb?: number | null; variabilityDb?: number | null };
}): Promise<CaptureResponse> {
  const processingMode = input.processingMode || "CLOUD";
  const parsedText = await parseTranscript(input.transcript, input.currentDateTime, processingMode);
  const acousticProfile = deriveAcousticProfile(input.transcript, input.durationSeconds, input.segments, input.metering);
  const parsed = applyAcousticContext(parsedText, acousticProfile);
  let embeddings: number[][] = [];
  try {
    embeddings = await embedTexts(parsed.knowledge_base.map((note) => `${note.topic}\n${note.content}`), processingMode);
  } catch (embeddingError) {
    console.warn("capture_embedding_failed", { message: embeddingError instanceof Error ? embeddingError.message : "Embedding failed" });
  }
  const captureId = await persistCapture(parsed, input.source, {
    transcript: input.transcript,
    processingMode,
    durationSeconds: input.durationSeconds == null ? null : Math.max(0, Math.round(input.durationSeconds)),
    segments: input.segments?.length ? input.segments : [{ chapterIndex: 0, text: input.transcript }],
    embeddings,
    metadata: { captureDate: input.currentDateTime.slice(0, 10) },
    audioBytes: input.audioBytes || null,
    audioMimeType: input.audioMimeType || null,
    audioFilename: input.audioFilename || null,
  }, input.userId);
  return { capture_id: captureId, parsed, transcript: input.transcript, persisted: Boolean(captureId) };
}

export async function processAudioCapture(input: CommonInput & {
  bytes: ArrayBuffer;
  filename: string;
  mimeType: string;
  diarize?: boolean;
  metering?: { averageDb?: number | null; peakDb?: number | null; variabilityDb?: number | null };
}) {
  const processingMode = input.processingMode || "CLOUD";
  const transcription = await transcribeAudio(input.bytes, input.filename, input.mimeType, input.diarize !== false, processingMode);
  if (!transcription.text) throw new Error("NO_SPEECH_DETECTED");
  return processTranscriptCapture({
    transcript: transcription.text,
    currentDateTime: input.currentDateTime,
    source: input.source,
    processingMode,
    durationSeconds: transcription.durationSeconds,
    segments: transcription.segments,
    audioBytes: input.bytes,
    audioMimeType: input.mimeType,
    audioFilename: input.filename,
    metering: input.metering,
    userId: input.userId,
  });
}
