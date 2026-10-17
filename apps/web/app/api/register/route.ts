import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerAccount } from "@/lib/accounts";
import { deviceCookie, issueDeviceToken, issueMobileToken, issueSession, productionAuthConfigured, sessionCookie } from "@/lib/session";
import { assertRateLimit } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(10).max(200),
  client: z.enum(["web", "mobile"]).default("web"),
});

export async function POST(request: NextRequest) {
  if (!productionAuthConfigured()) return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  try {
    await assertRateLimit(request);
    const input = schema.parse(await request.json());
    const account = await registerAccount(input);
    if (input.client === "mobile") {
      return NextResponse.json({ token: issueMobileToken(account.id), account: { email: account.email, name: account.name }, expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() }, { status: 201 });
    }
    const response = NextResponse.json({ authenticated: true, account: { email: account.email, name: account.name } }, { status: 201 });
    const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", priority: "high" as const };
    response.cookies.set(sessionCookie, issueSession(account.id), { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
    response.cookies.set(deviceCookie, issueDeviceToken(account.id), { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    const status = message === "ACCOUNT_EXISTS" ? 409 : message === "RATE_LIMITED" ? 429 : message === "DATABASE_UNAVAILABLE" ? 503 : message.includes("validation") ? 400 : 400;
    return NextResponse.json({ error: message === "ACCOUNT_EXISTS" ? "An account with this email already exists" : message === "RATE_LIMITED" ? message : "Registration failed" }, { status });
  }
}
