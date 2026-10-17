import { NextRequest, NextResponse } from "next/server";
import { createDemoDashboard } from "@/lib/demo-data";
import { getDashboard } from "@/lib/db";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const days = Math.min(90, Math.max(7, Number(request.nextUrl.searchParams.get("days") || 28)));
    return NextResponse.json((await getDashboard(days, requestUserId(request))) || createDemoDashboard());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "RATE_LIMITED" ? 429 : 500;
    return NextResponse.json({ error: status === 500 ? "Dashboard unavailable" : message }, { status });
  }
}
