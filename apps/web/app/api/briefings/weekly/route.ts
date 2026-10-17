import { NextRequest, NextResponse } from "next/server";
import { getLatestBriefing } from "@/lib/db";
import { runWeeklyBriefing } from "@/lib/briefings";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    return NextResponse.json({ briefing: await getLatestBriefing(requestUserId(request)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Briefing unavailable";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const input = await request.json().catch(() => ({})) as { audio?: boolean };
    const briefing = await runWeeklyBriefing({ audio: input.audio !== false, userId: requestUserId(request) });
    if (!briefing) return NextResponse.json({ error: "PostgreSQL is required for weekly briefings" }, { status: 503 });
    return NextResponse.json({ briefing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Briefing generation failed";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? message : "Briefing generation failed" }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
