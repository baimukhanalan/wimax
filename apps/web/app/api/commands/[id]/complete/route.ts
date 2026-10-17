import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeDeviceCommand } from "@/lib/actions";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

const inputSchema = z.object({ result: z.record(z.string(), z.unknown()) });
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id } = await context.params;
    const input = inputSchema.parse(await request.json());
    return NextResponse.json(await completeDeviceCommand(id, input.result, requestUserId(request)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command completion failed";
    return NextResponse.json({ error: message }, { status: message === "COMMAND_NOT_FOUND" ? 404 : 400 });
  }
}
