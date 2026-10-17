import { NextRequest, NextResponse } from "next/server";
import { listCommands } from "@/lib/actions";
import { assertCaptureRequest, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    const captureId = request.nextUrl.searchParams.get("capture_id");
    return NextResponse.json({ commands: await listCommands(captureId, requestUserId(request)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commands unavailable";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
