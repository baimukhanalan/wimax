import type { DashboardResponse } from "@cognitive-mirror/contracts";

function at(daysAgo: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 10, 0, 0);
  return date.toISOString();
}

export function createDemoDashboard(): DashboardResponse {
  const today = at(0, 8).slice(0, 10);
  return {
    captures: [
      { id: "demo-capture-1", summary: "Morning run completed and the marketing report is the next priority.", dominant_sentiment: "MOTIVATED", energy_score: 7, raw_text_cleaned: "I ran five kilometres this morning. Send the marketing report by two. The voice tracker review should stay frictionless.", transcript: null, source: "DEMO", processing_mode: "CLOUD", audio_available: false, created_at: at(0, 8) },
      { id: "demo-capture-2", summary: "Launch pressure has appeared repeatedly, while movement improves clarity.", dominant_sentiment: "ANXIOUS", energy_score: 5, raw_text_cleaned: "I feel clearer after movement but I am still carrying pressure about the launch.", transcript: null, source: "DEMO", processing_mode: "CLOUD", audio_available: false, created_at: at(1, 20) },
    ],
    tasks: [
      { id: "demo-task-1", capture_id: "demo-capture-1", title: "Send marketing report", project: "Marketing", due_date: at(0, 14), priority: "HIGH", action_items: ["Check campaign totals", "Send the final PDF"], status: "OPEN", created_at: at(0, 8), completed_at: null },
      { id: "demo-task-2", capture_id: "demo-capture-2", title: "Review launch scope", project: "WIMAX", due_date: at(1, 18), priority: "MEDIUM", action_items: ["Remove non-essential launch work"], status: "OPEN", created_at: at(1, 20), completed_at: null },
    ],
    habits: [
      { id: "demo-habit-1", capture_id: "demo-capture-1", habit_name: "Run", status: "COMPLETED", metric_value: 5, metric_unit: "km", notes: "Clearer after morning movement.", event_date: today, occurred_at: at(0, 7) },
      { id: "demo-habit-2", capture_id: "demo-capture-2", habit_name: "Meditation", status: "COMPLETED", metric_value: 12, metric_unit: "minutes", notes: "Short evening reset.", event_date: at(1, 20).slice(0, 10), occurred_at: at(1, 20) },
    ],
    knowledge: [
      { id: "demo-note-1", capture_id: "demo-capture-1", topic: "Frictionless capture", category: "INSIGHT", content: "Users value capture most when review requires one clear action and no manual categorisation.", tags: ["voice", "capture", "ux"], created_at: at(0, 8) },
      { id: "demo-note-2", capture_id: "demo-capture-2", topic: "Launch pressure pattern", category: "REFLECTIONS", content: "Launch-related thoughts have appeared for three days, while morning movement consistently lifts energy.", tags: ["launch", "energy", "pattern"], created_at: at(1, 20) },
    ],
    financial_transactions: [],
    energy: Array.from({ length: 14 }, (_, index) => ({
      date: at(13 - index, 12).slice(0, 10),
      average: [4, 5, 6, 5, 7, 6, 4][index % 7] ?? 5,
      captures: index % 4 === 0 ? 2 : 1,
    })),
    stats: { open_tasks: 2, completed_habits: 2, knowledge_notes: 2, current_streak: 4 },
    persisted: false,
  };
}
