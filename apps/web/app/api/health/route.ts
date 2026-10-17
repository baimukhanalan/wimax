import { NextResponse } from "next/server";
import { healthcheckDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await healthcheckDatabase();
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const ready = openai && (!database.configured || database.ready);
  return NextResponse.json(
    { status: ready ? "ready" : "degraded", checks: { openai, database }, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
