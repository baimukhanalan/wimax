import { NextRequest, NextResponse } from "next/server";
import { getBriefingAudio } from "@/lib/db";
import { assertCaptureRequest, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    const { id } = await context.params;
    const audio = await getBriefingAudio(id, requestUserId(request));
    if (!audio) return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(audio.bytes), { headers: { "Content-Type": audio.mimeType, "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio unavailable";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
