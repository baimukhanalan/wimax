import { NextRequest, NextResponse } from "next/server";
import { runWeeklyBriefing } from "@/lib/briefings";
import { listAccountIds } from "@/lib/accounts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const users = await listAccountIds();
  const results = await Promise.allSettled(users.map(async (userId) => ({ userId, briefing: await runWeeklyBriefing({ audio: true, userId }) })));
  return NextResponse.json({ users: users.length, results: results.map((result) => result.status === "fulfilled" ? result.value : { error: result.reason instanceof Error ? result.reason.message : "BRIEFING_FAILED" }) });
}
