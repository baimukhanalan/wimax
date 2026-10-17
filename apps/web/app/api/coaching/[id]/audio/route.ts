import { NextRequest } from "next/server";
import { getCoachingAudio } from "@/lib/coaching";
import { assertCaptureRequest, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request); const { id } = await context.params; const audio = await getCoachingAudio(id, requestUserId(request));
    if (!audio) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return new Response(new Uint8Array(audio.bytes), { headers: { "Content-Type": audio.mimeType, "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
}
