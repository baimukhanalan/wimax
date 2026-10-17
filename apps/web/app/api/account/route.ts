import { NextRequest, NextResponse } from "next/server";
import { deleteAccount } from "@/lib/accounts";
import { assertCaptureRequest, requestUserId } from "@/lib/security";
import { deviceCookie, sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    const input = await request.json().catch(() => ({})) as { password?: string; confirmation?: string };
    if (!input.password || input.confirmation !== "DELETE") {
      return NextResponse.json({ error: "Password and DELETE confirmation are required" }, { status: 400 });
    }
    await deleteAccount(requestUserId(request), input.password);
    const response = NextResponse.json({ deleted: true });
    const cookie = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 };
    response.cookies.set(sessionCookie, "", cookie);
    response.cookies.set(deviceCookie, "", cookie);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ACCOUNT_DELETION_FAILED";
    const status = message === "INVALID_PASSWORD" ? 401 : message === "ACCOUNT_DELETION_UNAVAILABLE" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
