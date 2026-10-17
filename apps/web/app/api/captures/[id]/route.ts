import { NextRequest, NextResponse } from "next/server";
import { deleteCapture } from "@/lib/db";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id } = await context.params;
    return (await deleteCapture(id, requestUserId(request))) ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "Capture not found" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
