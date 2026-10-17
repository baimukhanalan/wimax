import { NextRequest, NextResponse } from "next/server";
import { evaluateCoaching } from "@/lib/coaching";
import { listAccountIds } from "@/lib/accounts";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET; const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const users = await listAccountIds();
    const results = await Promise.allSettled(users.map(async (userId) => ({ userId, result: await evaluateCoaching(userId) })));
    return NextResponse.json({ users: users.length, results: results.map((result) => result.status === "fulfilled" ? result.value : { error: result.reason instanceof Error ? result.reason.message : "COACHING_FAILED" }) });
  }
  catch (error) { console.error("coaching_failed", { message: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ error: "COACHING_FAILED" }, { status: 500 }); }
}
