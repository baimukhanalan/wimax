import { describe, expect, it } from "vitest";
import { dashboardResponseSchema, parsedCaptureSchema } from "@cognitive-mirror/contracts";
import { createDemoDashboard } from "./demo-data";

describe("production contracts", () => {
  it("keeps demo dashboard data schema-valid", () => {
    expect(dashboardResponseSchema.parse(createDemoDashboard()).tasks).toHaveLength(2);
  });

  it("rejects unsupported energy values and malformed deadlines", () => {
    const result = parsedCaptureSchema.safeParse({ summary: "x", dominant_sentiment: "NEUTRAL", energy_score: 11, tasks: [{ title: "x", project: "Inbox", due_date: "tomorrow", priority: "HIGH", action_items: [] }], habits: [], knowledge_base: [], raw_text_cleaned: "x" });
    expect(result.success).toBe(false);
  });

  it("extracts financial transactions and confirmation-gated commands", () => {
    const parsed = parsedCaptureSchema.parse({
      summary: "Paid and scheduled", dominant_sentiment: "NEUTRAL", energy_score: 5,
      tasks: [], habits: [], knowledge_base: [], raw_text_cleaned: "Paid 20 USD and add a reminder",
      financial_transactions: [{ description: "Coffee", amount: 20, currency: "USD", direction: "EXPENSE", category: "Food", occurred_at: null, account: null, merchant: "Cafe", notes: "" }],
      commands: [{ type: "CREATE_REMINDER", title: "Call Alex", provider: "APPLE_REMINDERS", parameters: { content: null, description: null, notes: null, due_date: null, due_datetime: null, start: null, end: null, start_datetime: null, end_datetime: null, location: null, calendar_id: null, project_id: null, priority: null, data_source_id: null, title_property: null }, requires_confirmation: true }],
      acoustic_profile: null,
    });
    expect(parsed.financial_transactions[0]?.currency).toBe("USD");
    expect(parsed.commands[0]?.requires_confirmation).toBe(true);
  });
});
