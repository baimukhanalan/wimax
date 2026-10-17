import { NextRequest, NextResponse } from "next/server";
import { meetingCreateSchema } from "@cognitive-mirror/contracts";
import { createMeeting } from "@/lib/meetings";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const input = meetingCreateSchema.parse(await request.json());
    return NextResponse.json(await createMeeting(input, requestUserId(request)), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting creation failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
