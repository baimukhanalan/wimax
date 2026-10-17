import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { consumeRateLimit } from "./db";
import { mobileUserId, sessionCookie, sessionUserId, verifyMobileToken } from "./session";
export { openBytes, openSecret, sealBytes, sealSecret } from "./crypto";

const MAX_BYTES = 25 * 1024 * 1024;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertCaptureRequest(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("PAYLOAD_TOO_LARGE");

  const origin = request.headers.get("origin");
  const ownOrigin = request.nextUrl.origin;
  if (origin === ownOrigin) return;
  const referer = request.headers.get("referer");
  if (referer?.startsWith(`${ownOrigin}/`)) return;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return;
  if (process.env.NODE_ENV !== "production" && (!origin || origin === "null")) return;

  const expected = process.env.MIRROR_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied) throw new Error("UNAUTHORIZED");
  if ((!expected || !safeEqual(expected, supplied)) && !verifyMobileToken(supplied)) throw new Error("UNAUTHORIZED");
}

export function requestUserId(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const serviceToken = process.env.MIRROR_API_TOKEN;
  if (bearer && serviceToken && safeEqual(bearer, serviceToken)) return process.env.MIRROR_USER_ID || "owner";
  const mobile = mobileUserId(bearer);
  if (mobile) return mobile;
  const browser = sessionUserId(request.cookies.get(sessionCookie)?.value);
  if (browser) return browser;
  if (process.env.NODE_ENV !== "production") return process.env.MIRROR_USER_ID || "owner";
  throw new Error("UNAUTHORIZED");
}

export async function assertRateLimit(request: NextRequest) {
  const rawKey = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "local";
  const key = createHash("sha256").update(`${rawKey}:${process.env.RATE_LIMIT_SALT || "mirror"}`).digest("hex");
  const durable = await consumeRateLimit(key, 30, 60);
  if (durable) {
    if (!durable.allowed) throw new Error("RATE_LIMITED");
    return;
  }
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 12) throw new Error("RATE_LIMITED");
  current.count += 1;
}
