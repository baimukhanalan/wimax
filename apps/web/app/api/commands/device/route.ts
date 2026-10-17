import { NextRequest, NextResponse } from "next/server";
import { listPendingDeviceCommands } from "@/lib/actions";
import { assertCaptureRequest, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    return NextResponse.json({ commands: await listPendingDeviceCommands(requestUserId(request)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command lookup failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
