import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processAudioCapture, processTranscriptCapture } from "@/lib/capture-service";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const textCaptureSchema = z.object({
  transcript: z.string().trim().min(2).max(60_000),
  current_datetime: z.string().datetime({ offset: true }),
  source: z.string().max(32).default("TEXT"),
  processing_mode: z.enum(["CLOUD", "PRIVATE"]).default("CLOUD"),
});

export async function POST(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const contentType = request.headers.get("content-type") || "";
    const userId = requestUserId(request);
    let result;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const processingMode = String(form.get("processing_mode") || "CLOUD") === "PRIVATE" ? "PRIVATE" : "CLOUD";
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) {
        return NextResponse.json({ error: "audio is required" }, { status: 400 });
      }
      if (audio.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: "audio exceeds 25 MB" }, { status: 413 });
      }
      result = await processAudioCapture({
        bytes: await audio.arrayBuffer(),
        filename: audio.name || "capture.webm",
        mimeType: audio.type || "audio/webm",
        diarize: String(form.get("diarize") || "true") !== "false",
        currentDateTime: String(form.get("current_datetime") || new Date().toISOString()),
        source: String(form.get("source") || "VOICE").slice(0, 32),
        processingMode,
        metering: {
          averageDb: nullableNumber(form.get("metering_average_db")),
          peakDb: nullableNumber(form.get("metering_peak_db")),
          variabilityDb: nullableNumber(form.get("metering_variability_db")),
        },
        userId,
      });
    } else {
      const input = textCaptureSchema.parse(await request.json());
      result = await processTranscriptCapture({ transcript: input.transcript, currentDateTime: input.current_datetime, source: input.source, processingMode: input.processing_mode, userId });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "RATE_LIMITED" ? 429 : message === "PAYLOAD_TOO_LARGE" ? 413 : message === "NO_SPEECH_DETECTED" ? 422 : message === "PRIVATE_MODE_UNAVAILABLE" ? 503 : 500;
    console.error(JSON.stringify({ event: "capture_failed", message, status }));
    return NextResponse.json({ error: status === 500 ? "Capture processing failed" : message }, { status });
  }
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
