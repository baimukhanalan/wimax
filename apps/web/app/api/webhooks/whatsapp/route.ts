import { createHmac } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { claimProviderEvent } from "@/lib/db";
import { firstWhatsAppAudio, processWhatsAppAudio } from "@/lib/provider-capture";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = request.nextUrl.searchParams.get("hub.challenge") || "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && safeEqual(expected, token)) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  const supplied = request.headers.get("x-hub-signature-256") || "";
  const expected = secret ? `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}` : "";
  if (!secret || !safeEqual(expected, supplied)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const audio = firstWhatsAppAudio(JSON.parse(raw));
  if (!audio) return NextResponse.json({ ok: true });
  if (!(await claimProviderEvent("WHATSAPP", audio.eventId))) return NextResponse.json({ ok: true, duplicate: true });
  after(() => processWhatsAppAudio(audio).catch((error) => console.error("whatsapp_capture_failed", { eventId: audio.eventId, message: error instanceof Error ? error.message : "failed" })));
  return NextResponse.json({ ok: true }, { status: 202 });
}
