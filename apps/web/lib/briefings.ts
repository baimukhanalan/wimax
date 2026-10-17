import { generateWeeklyBriefing, synthesizeBriefing } from "./ai";
import { getWeeklyBriefingContext, saveBriefing } from "./db";
import { sendPushToUser } from "./push";

export function previousWeek(reference = new Date()) {
  const end = new Date(reference);
  const weekday = (end.getUTCDay() + 6) % 7;
  end.setUTCDate(end.getUTCDate() - weekday - 1);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function runWeeklyBriefing(options: { audio?: boolean; reference?: Date; userId?: string } = {}) {
  const period = previousWeek(options.reference);
  const context = await getWeeklyBriefingContext(period.start, period.end, options.userId);
  if (!context) return null;
  const draft = await generateWeeklyBriefing(context);
  let audio: Awaited<ReturnType<typeof synthesizeBriefing>> | null = null;
  if (options.audio !== false) {
    audio = await synthesizeBriefing(`${draft.title}. ${draft.summary}. ${draft.insights.join(" ")}`);
  }
  const briefing = await saveBriefing({
    periodStart: period.start,
    periodEnd: period.end,
    title: draft.title,
    summary: draft.summary,
    insights: draft.insights,
    audioBytes: audio?.bytes || null,
    audioMimeType: audio?.mimeType || null,
  }, options.userId);
  if (briefing && options.userId) {
    await sendPushToUser(options.userId, {
      title: briefing.title,
      body: briefing.summary,
      data: { kind: "WEEKLY_BRIEFING", screen: "Inbox", briefing_id: String(briefing.id), audio_path: `/api/briefings/${briefing.id}/audio` },
    });
  }
  return briefing;
}
