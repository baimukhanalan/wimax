import { createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookie = "mirror_session";
export const deviceCookie = "mirror_device";

function secret() { return process.env.MIRROR_SESSION_SECRET?.trim() || ""; }

function signature(payload: string) {
  const key = secret();
  if (!key) return "";
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function safeTokenEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueSession(userId = legacyUserId(), now = Date.now(), ttlSeconds = 60 * 60 * 24 * 7) {
  return issueSignedToken("owner", userId, now, ttlSeconds);
}

export function verifySession(token: string | undefined, now = Date.now()) {
  return Boolean(signedTokenUserId(token, "owner", now));
}

export function sessionUserId(token: string | undefined, now = Date.now()) {
  return signedTokenUserId(token, "owner", now);
}

export function issueMobileToken(userId = legacyUserId(), now = Date.now(), ttlSeconds = 60 * 60 * 24 * 30) {
  return issueSignedToken("mobile", userId, now, ttlSeconds);
}

export function verifyMobileToken(token: string | undefined, now = Date.now()) {
  return Boolean(signedTokenUserId(token, "mobile", now));
}

export function mobileUserId(token: string | undefined, now = Date.now()) {
  return signedTokenUserId(token, "mobile", now);
}

export function issueDeviceToken(userId = legacyUserId(), now = Date.now(), ttlSeconds = 60 * 60 * 24 * 365) {
  return issueSignedToken("device", userId, now, ttlSeconds);
}

export function verifyDeviceToken(token: string | undefined, now = Date.now()) {
  return Boolean(signedTokenUserId(token, "device", now));
}

export function deviceUserId(token: string | undefined, now = Date.now()) {
  return signedTokenUserId(token, "device", now);
}

function legacyUserId() {
  return process.env.MIRROR_USER_ID || "owner";
}

function issueSignedToken(subject: "owner" | "mobile" | "device", userId: string, now: number, ttlSeconds: number) {
  const expires = Math.floor(now / 1000) + ttlSeconds;
  const encodedUserId = Buffer.from(userId).toString("base64url");
  const payload = `${expires}.${subject}.${encodedUserId}`;
  return `${payload}.${signature(payload)}`;
}

function signedTokenUserId(token: string | undefined, subjectExpected: "owner" | "mobile" | "device", now: number) {
  if (!token || !secret()) return null;
  const [expiresText, subject, encodedUserId, provided] = token.split(".");
  if (!expiresText || subject !== subjectExpected || !encodedUserId || !provided || Number(expiresText) <= Math.floor(now / 1000)) return null;
  const expected = signature(`${expiresText}.${subject}.${encodedUserId}`);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const userId = Buffer.from(encodedUserId, "base64url").toString();
    return userId.length > 0 && userId.length <= 200 ? userId : null;
  } catch { return null; }
}

export function productionAuthConfigured() {
  return Boolean(process.env.MIRROR_WEB_PASSWORD?.trim() && secret().length >= 32);
}
