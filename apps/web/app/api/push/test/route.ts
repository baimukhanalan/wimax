import { NextRequest, NextResponse } from "next/server";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const result = await sendPushToUser(requestUserId(request), {
      title: "WIMAX notifications are ready",
      body: "You will be notified when a meeting, briefing or coaching insight is ready.",
      data: { kind: "TEST", screen: "Inbox" },
    });
    return NextResponse.json(result, { status: result.devices ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PUSH_TEST_FAILED";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
