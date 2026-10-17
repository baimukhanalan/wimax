import { NextRequest, NextResponse } from "next/server";
import { processNextMeeting } from "@/lib/meetings";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const meeting = await processNextMeeting();
    return NextResponse.json({ processed: Boolean(meeting), meeting });
  } catch (error) {
    console.error("meeting_processing_failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "MEETING_PROCESSING_FAILED" }, { status: 500 });
  }
}
