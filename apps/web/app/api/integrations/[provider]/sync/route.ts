import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enqueueSync } from "@/lib/sync";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

const providerSchema = z.enum(["NOTION", "TODOIST", "GOOGLE_CALENDAR"]);
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try { assertCaptureRequest(request); await assertRateLimit(request); const { provider } = await context.params; return NextResponse.json(await enqueueSync(providerSchema.parse(provider), requestUserId(request)), { status: 202 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Sync queue failed"; return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 }); }
}
