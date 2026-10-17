import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeCommand } from "@/lib/actions";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

const inputSchema = z.object({ confirmed: z.boolean().default(false) });
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id } = await context.params;
    const input = inputSchema.parse(await request.json());
    return NextResponse.json(await executeCommand(id, input.confirmed, requestUserId(request)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "COMMAND_NOT_FOUND" ? 404 : message === "CONFIRMATION_REQUIRED" ? 409 : message.includes("NOT_CONFIGURED") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
