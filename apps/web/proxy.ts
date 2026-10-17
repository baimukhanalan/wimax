import { NextRequest, NextResponse } from "next/server";
import { productionAuthConfigured, safeTokenEqual, sessionCookie, verifyMobileToken, verifySession } from "@/lib/session";

const publicPaths = ["/", "/login", "/register", "/privacy", "/terms", "/account-deletion", "/download", "/downloads", "/media", "/api/session", "/api/register", "/api/mobile/session", "/api/health", "/api/webhooks/telegram", "/api/webhooks/whatsapp", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (process.env.NODE_ENV !== "production" && !productionAuthConfigured()) return NextResponse.next();
  if (!productionAuthConfigured()) return NextResponse.json({ error: "Production authentication is not configured" }, { status: 503 });

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const serviceToken = process.env.MIRROR_API_TOKEN;
  if (bearer && ((serviceToken && safeTokenEqual(bearer, serviceToken)) || verifyMobileToken(bearer))) return NextResponse.next();
  if (verifySession(request.cookies.get(sessionCookie)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.png|favicon.ico).*)"] };
