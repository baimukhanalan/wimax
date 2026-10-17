import { NextRequest, NextResponse } from "next/server";
import { exportMirrorData } from "@/lib/db";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const data = await exportMirrorData(requestUserId(request));
    if (!data) return NextResponse.json({ error: "PostgreSQL is required for export" }, { status: 503 });
    return NextResponse.json(data, { headers: { "Content-Disposition": `attachment; filename="cognitive-mirror-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
