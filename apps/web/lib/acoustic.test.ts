import { describe, expect, it } from "vitest";
import { applyAcousticContext, deriveAcousticProfile } from "./acoustic";
import { missingChunkIndices } from "./meetings";

describe("meeting and acoustic processing", () => {
  it("finds resumable upload gaps without treating repeats as gaps", () => {
    expect(missingChunkIndices(5, [0, 1, 1, 3, 4])).toEqual([2]);
    expect(missingChunkIndices(3, [2, 0, 1])).toEqual([]);
  });

  it("derives temporal acoustic evidence from measured segment timing", () => {
    const profile = deriveAcousticProfile("one two three four five six", 6, [
      { chapterIndex: 0, startedAtMs: 0, endedAtMs: 2_000, text: "one two three" },
      { chapterIndex: 1, startedAtMs: 3_000, endedAtMs: 6_000, text: "four five six" },
    ]);
    expect(profile?.speaking_rate_wpm).toBe(60);
    expect(profile?.pause_ratio).toBeCloseTo(1 / 6, 2);
    expect(profile?.pitch_variability).toBeNull();
    expect(profile?.evidence.length).toBeGreaterThan(1);
  });

  it("never overwrites textual sentiment from weak acoustic evidence", () => {
    const parsed = {
      summary: "ok", dominant_sentiment: "POSITIVE" as const, energy_score: 7,
      tasks: [], habits: [], knowledge_base: [], financial_transactions: [], commands: [], acoustic_profile: null,
      raw_text_cleaned: "ok",
    };
    const result = applyAcousticContext(parsed, { arousal: 2, valence: 0, speaking_rate_wpm: 60, pause_ratio: 0.4, pitch_variability: null, confidence: 0.8, evidence: [] });
    expect(result.dominant_sentiment).toBe("POSITIVE");
  });
});
