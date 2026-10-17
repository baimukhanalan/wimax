import { NextRequest, NextResponse } from "next/server";
import { searchRequestSchema } from "@cognitive-mirror/contracts";
import { answerSearch, embedTexts } from "@/lib/ai";
import { searchMirror } from "@/lib/db";
import { assertCaptureRequest, assertRateLimit, requestUserId } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertCaptureRequest(request);
    await assertRateLimit(request);
    const input = searchRequestSchema.parse(await request.json());
    let embedding: number[] | null = null;
    try {
      [embedding] = await embedTexts([input.query]);
    } catch (error) {
      console.warn("search_embedding_failed", { message: error instanceof Error ? error.message : "Embedding failed" });
    }
    const result = await searchMirror(input.query, embedding || null, input.limit, requestUserId(request));
    if (!result) return NextResponse.json({ answer: "Connect PostgreSQL to search your Mirror.", hits: [], persisted: false });
    result.answer = await answerSearch(input.query, result.hits);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "RATE_LIMITED" ? 429 : 500;
    return NextResponse.json({ error: status === 500 ? "Search unavailable" : message }, { status });
  }
}
