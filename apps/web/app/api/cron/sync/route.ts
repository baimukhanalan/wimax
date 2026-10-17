import { NextRequest, NextResponse } from "next/server";
import { processNextSync } from "@/lib/sync";

export const runtime = "nodejs"; export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET; const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try { const job = await processNextSync(); return NextResponse.json({ processed: Boolean(job), job }); }
  catch (error) { console.error("sync_failed", { message: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 }); }
}
