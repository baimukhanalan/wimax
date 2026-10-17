import { NextRequest, NextResponse } from "next/server";
import { taskUpdateSchema } from "@cognitive-mirror/contracts";
import { updateTask } from "@/lib/db";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id } = await context.params;
    const task = await updateTask(id, taskUpdateSchema.parse(await request.json()), requestUserId(request));
    if (!task) return NextResponse.json({ error: "Task not found or persistence is disabled" }, { status: 404 });
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task update failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "RATE_LIMITED" ? 429 : 500;
    return NextResponse.json({ error: status === 500 ? "Task update failed" : message }, { status });
  }
}
