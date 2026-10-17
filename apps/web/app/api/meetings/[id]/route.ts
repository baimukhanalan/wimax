import { NextRequest, NextResponse } from "next/server";
import { getMeeting } from "@/lib/meetings";
import { assertCaptureRequest, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    const { id } = await context.params;
    const meeting = await getMeeting(id, requestUserId(request));
    return meeting ? NextResponse.json(meeting) : NextResponse.json({ error: "MEETING_NOT_FOUND" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting lookup failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
