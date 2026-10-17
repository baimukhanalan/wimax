import { NextRequest, NextResponse } from "next/server";
import { authenticateAccount } from "@/lib/accounts";
import { issueMobileToken, productionAuthConfigured } from "@/lib/session";
import { assertRateLimit, safeEqual } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!productionAuthConfigured()) return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  try {
    await assertRateLimit(request);
    const input = await request.json().catch(() => ({})) as { account?: string; password?: string };
    if (!input.password || !input.account) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    const account = await authenticateAccount(input.account, input.password);
    const expectedAccount = process.env.MIRROR_WEB_ACCOUNT?.trim() || "mirror";
    const legacy = safeEqual(input.account.trim().toLowerCase(), expectedAccount.toLowerCase()) && safeEqual(input.password, process.env.MIRROR_WEB_PASSWORD || "");
    if (!account && !legacy) return NextResponse.json({ error: "Invalid account or password" }, { status: 401 });
    const userId = account?.id || process.env.MIRROR_USER_ID || "owner";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
    return NextResponse.json({ token: issueMobileToken(userId), expires_at: expiresAt, account: account ? { email: account.email, name: account.name } : { account: expectedAccount } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed";
    return NextResponse.json({ error: message === "RATE_LIMITED" ? message : "Sign-in failed" }, { status: message === "RATE_LIMITED" ? 429 : 500 });
  }
}
