import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerPushToken } from "@/lib/coaching";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

const schema = z.object({ token: z.string().min(10).max(500), platform: z.enum(["IOS", "ANDROID"]), locale: z.string().max(30).optional(), timezone: z.string().max(80).optional() });
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { assertCaptureRequest(request); await assertRateLimit(request); return NextResponse.json(await registerPushToken(schema.parse(await request.json()), requestUserId(request))); }
  catch (error) { const message = error instanceof Error ? error.message : "Registration failed"; return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 }); }
}
