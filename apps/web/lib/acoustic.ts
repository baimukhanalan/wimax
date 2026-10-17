import type { ParsedCapture } from "@cognitive-mirror/contracts";
import type { TranscriptSegmentInput } from "./db";

export type AcousticObservation = NonNullable<ParsedCapture["acoustic_profile"]>;

export function deriveAcousticProfile(
  transcript: string,
  durationSeconds: number | null | undefined,
  segments: TranscriptSegmentInput[] = [],
  metering?: { averageDb?: number | null; peakDb?: number | null; variabilityDb?: number | null },
): AcousticObservation | null {
  const timed = segments
    .filter((segment) => segment.startedAtMs != null && segment.endedAtMs != null)
    .sort((left, right) => Number(left.startedAtMs) - Number(right.startedAtMs));
  const inferredDuration = durationSeconds || (timed.length ? Number(timed.at(-1)?.endedAtMs || 0) / 1_000 : 0);
  if (!inferredDuration && !metering) return null;

  const words = transcript.trim() ? transcript.trim().split(/\s+/u).length : 0;
  const speakingRate = inferredDuration > 0 ? Math.round((words / inferredDuration) * 60) : null;
  let pauseMs = 0;
  for (let index = 1; index < timed.length; index += 1) {
    pauseMs += Math.max(0, Number(timed[index]?.startedAtMs) - Number(timed[index - 1]?.endedAtMs));
  }
  const pauseRatio = inferredDuration > 0 && timed.length > 1
    ? Math.min(1, Math.round((pauseMs / (inferredDuration * 1_000)) * 1_000) / 1_000)
    : null;
  const tempoArousal = speakingRate == null ? 5 : Math.max(1, Math.min(10, 5 + (speakingRate - 130) / 30));
  const meterArousal = metering?.averageDb == null ? null : Math.max(1, Math.min(10, 10 + metering.averageDb / 6));
  const arousal = Math.round(((meterArousal == null ? tempoArousal : (tempoArousal + meterArousal) / 2)) * 10) / 10;
  const evidence = [
    speakingRate == null ? null : `Measured speaking rate: ${speakingRate} wpm`,
    pauseRatio == null ? null : `Measured pause ratio: ${pauseRatio}`,
    metering?.variabilityDb == null ? null : `Measured loudness variability: ${metering.variabilityDb.toFixed(1)} dB`,
  ].filter((item): item is string => Boolean(item));

  return {
    arousal,
    valence: 0,
    speaking_rate_wpm: speakingRate,
    pause_ratio: pauseRatio,
    pitch_variability: null,
    confidence: Math.min(0.85, 0.35 + (timed.length ? 0.25 : 0) + (metering ? 0.2 : 0)),
    evidence,
  };
}

export function applyAcousticContext(parsed: ParsedCapture, profile: AcousticObservation | null): ParsedCapture {
  if (!profile) return { ...parsed, acoustic_profile: null };
  let sentiment = parsed.dominant_sentiment;
  let energy = parsed.energy_score;
  if (profile.confidence >= 0.55) {
    energy = Math.max(1, Math.min(10, Math.round((energy * 2 + profile.arousal) / 3)));
    if (sentiment === "NEUTRAL" && profile.arousal <= 3 && (profile.speaking_rate_wpm || 999) < 95) sentiment = "EXHAUSTED";
    if (sentiment === "NEUTRAL" && profile.arousal >= 8 && (profile.speaking_rate_wpm || 0) > 180) sentiment = "ANXIOUS";
  }
  return { ...parsed, dominant_sentiment: sentiment, energy_score: energy, acoustic_profile: profile };
}
