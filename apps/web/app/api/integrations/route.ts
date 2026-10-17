import { NextRequest, NextResponse } from "next/server";
import { integrationStatuses } from "@/lib/integrations";
import { assertCaptureRequest, assertRateLimit } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    return NextResponse.json({ integrations: integrationStatuses() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integrations unavailable";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

