import { NextRequest, NextResponse } from "next/server";
import { getCaptureAudio } from "@/lib/db";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id } = await context.params;
    const audio = await getCaptureAudio(id, requestUserId(request));
    if (!audio) return NextResponse.json({ error: "Audio not found or encrypted audio retention is disabled" }, { status: 404 });
    return new NextResponse(new Uint8Array(audio.bytes), { headers: {
      "Content-Type": audio.mimeType,
      "Content-Disposition": `inline; filename="${audio.filename.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio unavailable";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
