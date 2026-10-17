import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { briefingDraftSchema, parsedCaptureSchema, type ParsedCapture, type SearchResponse } from "@cognitive-mirror/contracts";
import type { TranscriptSegmentInput } from "./db";
import { productivityPrompt } from "./prompt";

let client: OpenAI | null = null;
let localClient: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function getProcessingClient(mode: "CLOUD" | "PRIVATE" = "CLOUD") {
  if (mode === "CLOUD") return getClient();
  const baseURL = process.env.LOCAL_AI_BASE_URL;
  if (!baseURL) throw new Error("PRIVATE_MODE_UNAVAILABLE");
  localClient ??= new OpenAI({
    baseURL,
    apiKey: process.env.LOCAL_AI_API_KEY || "local-private-runtime",
  });
  return localClient;
}

export type TranscriptionResult = {
  text: string;
  durationSeconds: number | null;
  segments: TranscriptSegmentInput[];
};

export async function transcribeAudio(
  bytes: ArrayBuffer,
  filename: string,
  mimeType: string,
  diarize = true,
  mode: "CLOUD" | "PRIVATE" = "CLOUD",
): Promise<TranscriptionResult> {
  const file = await toFile(Buffer.from(bytes), filename, { type: mimeType });
  const processingClient = getProcessingClient(mode);
  if (diarize && mode === "CLOUD") {
    const result = await processingClient.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_DIARIZE_MODEL || "gpt-4o-transcribe-diarize",
      response_format: "diarized_json",
      chunking_strategy: "auto",
    });
    if ("segments" in result) {
      const diarized = result as unknown as {
        text: string;
        duration: number;
        segments: Array<{ speaker: string; start: number; end: number; text: string }>;
      };
      return {
        text: diarized.text.trim(),
        durationSeconds: diarized.duration,
        segments: diarized.segments.map((segment, index) => ({
          chapterIndex: index,
          speakerLabel: segment.speaker,
          startedAtMs: Math.round(segment.start * 1_000),
          endedAtMs: Math.round(segment.end * 1_000),
          text: segment.text.trim(),
          confidence: null,
        })),
      };
    }
  }
  const result = await processingClient.audio.transcriptions.create({
    file,
    model: mode === "PRIVATE"
      ? process.env.LOCAL_TRANSCRIBE_MODEL || "whisper-1"
      : process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    response_format: "json",
    temperature: 0,
  });
  return { text: result.text.trim(), durationSeconds: null, segments: [] };
}

export async function parseTranscript(transcript: string, currentDateTime: string, mode: "CLOUD" | "PRIVATE" = "CLOUD"): Promise<ParsedCapture> {
  const response = await getProcessingClient(mode).responses.parse({
    model: mode === "PRIVATE"
      ? process.env.LOCAL_PARSER_MODEL || "local-parser"
      : process.env.OPENAI_PARSER_MODEL || "gpt-5-mini",
    instructions: productivityPrompt,
    input: `CURRENT_DATETIME: ${currentDateTime}\n\nTRANSCRIPT:\n${transcript}`,
    text: { format: zodTextFormat(parsedCaptureSchema, "cognitive_mirror_capture") },
  });

  if (!response.output_parsed) {
    throw new Error(`The parser returned no structured result (${response.status})`);
  }
  return response.output_parsed;
}

export async function embedTexts(texts: string[], mode: "CLOUD" | "PRIVATE" = "CLOUD") {
  if (!texts.length) return [];
  const response = await getProcessingClient(mode).embeddings.create({
    model: mode === "PRIVATE"
      ? process.env.LOCAL_EMBEDDING_MODEL || "text-embedding-3-small"
      : process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input: texts,
    dimensions: 1536,
    encoding_format: "float",
  });
  return response.data.map((item) => item.embedding);
}

export async function answerSearch(query: string, hits: SearchResponse["hits"]) {
  if (!hits.length) return "I couldn’t find a matching memory yet.";
  const sources = hits
    .map((hit, index) => `[${index + 1}] ${hit.title}\n${hit.excerpt}`)
    .join("\n\n");
  const response = await getClient().responses.create({
    model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_PARSER_MODEL || "gpt-5-mini",
    instructions: "Answer only from the supplied WIMAX sources. Be concise, preserve the user's language, and cite supporting source numbers like [1]. If the sources do not support a claim, say so.",
    input: `QUESTION:\n${query}\n\nSOURCES:\n${sources}`,
  });
  return response.output_text.trim();
}

export async function generateWeeklyBriefing(context: string) {
  const response = await getClient().responses.parse({
    model: process.env.OPENAI_BRIEFING_MODEL || process.env.OPENAI_PARSER_MODEL || "gpt-5-mini",
    instructions: "Create a short weekly WIMAX briefing grounded only in the supplied personal data. Preserve the dominant language of the source. Highlight progress, one blind spot, and one concrete next step. Avoid diagnosis, judgement, and unsupported claims.",
    input: context,
    text: { format: zodTextFormat(briefingDraftSchema, "cognitive_mirror_weekly_briefing") },
  });
  if (!response.output_parsed) throw new Error("Briefing generation returned no result");
  return response.output_parsed;
}

export async function synthesizeBriefing(text: string) {
  if (process.env.ELEVENLABS_API_KEY) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": process.env.ELEVENLABS_API_KEY },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2", output_format: "mp3_44100_128" }),
    });
    if (!response.ok) throw new Error(`ElevenLabs TTS failed (${response.status})`);
    return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: "audio/mpeg", provider: "ELEVENLABS" as const };
  }
  const response = await getClient().audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: (process.env.OPENAI_TTS_VOICE || "coral") as "coral",
    input: text,
    instructions: "Warm, grounded personal productivity briefing. Calm pace, concise and encouraging.",
    response_format: "mp3",
  });
  return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: "audio/mpeg", provider: "OPENAI" as const };
}
