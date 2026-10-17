import { NextRequest, NextResponse } from "next/server";
import { authenticateAccount, authenticateAccountById } from "@/lib/accounts";
import { deviceCookie, deviceUserId, issueDeviceToken, issueSession, productionAuthConfigured, sessionCookie } from "@/lib/session";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({ remembered: Boolean(deviceUserId(request.cookies.get(deviceCookie)?.value)) });
}

export async function POST(request: NextRequest) {
  if (!productionAuthConfigured()) return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  const input = await request.json().catch(() => ({})) as { account?: string; password?: string };
  const rememberedUserId = deviceUserId(request.cookies.get(deviceCookie)?.value);
  const remembered = Boolean(rememberedUserId);
  const expectedAccount = process.env.MIRROR_WEB_ACCOUNT?.trim() || "mirror";
  if (!input.password) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  let account = rememberedUserId ? await authenticateAccountById(rememberedUserId, input.password) : null;
  let userId = account?.id || null;
  if (!remembered && input.account) {
    account = await authenticateAccount(input.account, input.password);
    userId = account?.id || null;
  }
  if (!userId) {
    const legacyAccountMatches = rememberedUserId === (process.env.MIRROR_USER_ID || "owner")
      || (!remembered && Boolean(input.account) && safeEqual(input.account!.trim().toLowerCase(), expectedAccount.toLowerCase()));
    const legacyPasswordMatches = safeEqual(input.password, process.env.MIRROR_WEB_PASSWORD || "");
    if (legacyAccountMatches && legacyPasswordMatches) userId = process.env.MIRROR_USER_ID || "owner";
  }
  if (!userId) return NextResponse.json({ error: remembered ? "Invalid password" : "Invalid account or password" }, { status: 401 });
  const response = NextResponse.json({ authenticated: true, account: account ? { email: account.email, name: account.name } : { account: expectedAccount } });
  const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", priority: "high" as const };
  response.cookies.set(sessionCookie, issueSession(userId), { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
  if (!remembered) response.cookies.set(deviceCookie, issueDeviceToken(userId), { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  if (request.nextUrl.searchParams.get("forgetDevice") === "1") {
    response.cookies.set(deviceCookie, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  }
  return response;
}
