import { after, NextRequest, NextResponse } from "next/server";
import { claimProviderEvent } from "@/lib/db";
import { processTelegramUpdate } from "@/lib/provider-capture";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || !safeEqual(expected, supplied)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const update = await request.json() as { update_id?: number };
  const eventId = String(update.update_id || "");
  if (!eventId) return NextResponse.json({ ok: true });
  if (!(await claimProviderEvent("TELEGRAM", eventId))) return NextResponse.json({ ok: true, duplicate: true });
  after(() => processTelegramUpdate(update, eventId).catch((error) => console.error("telegram_capture_failed", { eventId, message: error instanceof Error ? error.message : "failed" })));
  return NextResponse.json({ ok: true }, { status: 202 });
}

