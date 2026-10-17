import { NextRequest, NextResponse } from "next/server";
import { meetingCompleteSchema } from "@cognitive-mirror/contracts";
import { completeMeeting, processNextMeeting } from "@/lib/meetings";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id } = await context.params;
    const input = meetingCompleteSchema.parse(await request.json());
    const userId = requestUserId(request);
    await completeMeeting(id, input, userId);
    try {
      const processed = await processNextMeeting(id, userId);
      return NextResponse.json(processed ?? (await completeMeeting(id, input, userId)), { status: processed ? 200 : 202 });
    } catch (processingError) {
      console.error("meeting_inline_processing_failed", {
        meetingId: id,
        message: processingError instanceof Error ? processingError.message : "unknown",
      });
      return NextResponse.json(await completeMeeting(id, input, userId), { status: 202 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting completion failed";
    const missing = error && typeof error === "object" && "missing" in error ? (error as { missing: number[] }).missing : undefined;
    const status = message === "UNAUTHORIZED" ? 401 : message === "MEETING_NOT_FOUND" ? 404 : message === "MISSING_CHUNKS" ? 409 : 400;
    return NextResponse.json({ error: message, missing }, { status });
  }
}
