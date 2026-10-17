import { NextRequest, NextResponse } from "next/server";
import { storeMeetingChunk } from "@/lib/meetings";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CHUNK_BYTES = 12 * 1024 * 1024;

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string; index: string }> }) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const { id, index: rawIndex } = await context.params;
    const chunkIndex = Number(rawIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 239) throw new Error("INVALID_CHUNK_INDEX");
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length) throw new Error("EMPTY_CHUNK");
    if (bytes.length > MAX_CHUNK_BYTES) throw new Error("CHUNK_TOO_LARGE");
    const checksum = request.headers.get("x-content-sha256");
    if (!checksum || !/^[a-f0-9]{64}$/i.test(checksum)) throw new Error("INVALID_CHECKSUM");
    const result = await storeMeetingChunk({
      meetingId: id,
      chunkIndex,
      bytes,
      checksum,
      mimeType: (request.headers.get("content-type") || "application/octet-stream").slice(0, 120),
      filename: (request.headers.get("x-filename") || `chunk-${chunkIndex}.m4a`).slice(0, 240),
    }, requestUserId(request));
    return NextResponse.json(result, { status: result.stored ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chunk upload failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "MEETING_NOT_FOUND" ? 404 : message === "CHUNK_CONFLICT" ? 409 : message.includes("LARGE") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
