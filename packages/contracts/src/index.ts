import { z } from "zod";

export const sentimentSchema = z.enum([
  "POSITIVE",
  "NEUTRAL",
  "ANXIOUS",
  "EXHAUSTED",
  "MOTIVATED",
]);

export const processingModeSchema = z.enum(["CLOUD", "PRIVATE"]);
export const captureSourceSchema = z.enum([
  "WEB_VOICE",
  "WEB_TEXT",
  "MOBILE_VOICE",
  "MOBILE_SHARE",
  "TELEGRAM",
  "WHATSAPP",
  "IMPORT",
]);

export const taskSchema = z.object({
  title: z.string().min(1),
  project: z.string().min(1),
  due_date: z.string().datetime().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  action_items: z.array(z.string()),
});

export const habitSchema = z.object({
  habit_name: z.string().min(1),
  status: z.enum(["COMPLETED", "FAILED", "PARTIAL"]),
  metric_value: z.number().nullable(),
  metric_unit: z.string().nullable(),
  notes: z.string(),
});

export const knowledgeSchema = z.object({
  topic: z.string().min(1),
  category: z.enum([
    "IDEA",
    "REFLECTIONS",
    "INSIGHT",
    "MEETING_NOTES",
    "BOOK_SUMMARY",
  ]),
  content: z.string().min(1),
  tags: z.array(z.string()),
});

export const financialTransactionSchema = z.object({
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3,8}$/),
  direction: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  category: z.string().min(1),
  occurred_at: z.string().datetime().nullable(),
  account: z.string().nullable(),
  merchant: z.string().nullable(),
  notes: z.string(),
});

export const commandTypeSchema = z.enum([
  "CREATE_CALENDAR_EVENT",
  "CREATE_REMINDER",
  "CREATE_TASK",
  "SEND_TO_NOTION",
  "SYNC_NOW",
]);

export const commandProviderSchema = z.enum([
  "NOTION",
  "TODOIST",
  "GOOGLE_CALENDAR",
  "APPLE_REMINDERS",
]);

export const commandParametersSchema = z.object({
  content: z.string().nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  due_date: z.string().nullable(),
  due_datetime: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  start_datetime: z.string().nullable(),
  end_datetime: z.string().nullable(),
  location: z.string().nullable(),
  calendar_id: z.string().nullable(),
  project_id: z.string().nullable(),
  priority: z.number().int().min(1).max(4).nullable(),
  data_source_id: z.string().nullable(),
  title_property: z.string().nullable(),
});

export const commandDraftSchema = z.object({
  type: commandTypeSchema,
  title: z.string().min(1),
  provider: commandProviderSchema,
  requires_confirmation: z.boolean().default(true),
  parameters: commandParametersSchema,
});

export const acousticProfileSchema = z.object({
  arousal: z.number().min(1).max(10),
  valence: z.number().min(-1).max(1),
  speaking_rate_wpm: z.number().nonnegative().nullable(),
  pause_ratio: z.number().min(0).max(1).nullable(),
  pitch_variability: z.number().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export const parsedCaptureSchema = z.object({
  summary: z.string().min(1),
  dominant_sentiment: sentimentSchema,
  energy_score: z.number().int().min(1).max(10),
  tasks: z.array(taskSchema),
  habits: z.array(habitSchema),
  knowledge_base: z.array(knowledgeSchema),
  financial_transactions: z.array(financialTransactionSchema).default([]),
  commands: z.array(commandDraftSchema).default([]),
  acoustic_profile: acousticProfileSchema.nullable().default(null),
  raw_text_cleaned: z.string().min(1),
});

export type ParsedCapture = z.infer<typeof parsedCaptureSchema>;

export const captureResponseSchema = z.object({
  capture_id: z.string().nullable(),
  parsed: parsedCaptureSchema,
  transcript: z.string(),
  persisted: z.boolean(),
});

export type CaptureResponse = z.infer<typeof captureResponseSchema>;

export const meetingStatusSchema = z.enum([
  "RECORDING",
  "UPLOADING",
  "QUEUED",
  "PROCESSING",
  "READY",
  "FAILED",
  "CANCELLED",
]);

export const meetingCreateSchema = z.object({
  title: z.string().trim().min(1).max(240).default("Meeting"),
  started_at: z.string().datetime({ offset: true }),
  source: z.enum(["IOS", "ANDROID", "WEB", "IMPORT"]),
  consent_confirmed: z.literal(true),
  chunk_duration_seconds: z.number().int().min(30).max(600).default(300),
});

export const meetingRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: meetingStatusSchema,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  duration_seconds: z.number().int().nonnegative().nullable(),
  chunk_duration_seconds: z.number().int().positive(),
  expected_chunks: z.number().int().nonnegative().nullable(),
  uploaded_chunks: z.array(z.number().int().nonnegative()),
  total_bytes: z.number().int().nonnegative(),
  capture_id: z.string().uuid().nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type MeetingRecord = z.infer<typeof meetingRecordSchema>;

export const meetingCompleteSchema = z.object({
  expected_chunks: z.number().int().min(1).max(240),
  ended_at: z.string().datetime({ offset: true }),
  duration_seconds: z.number().int().min(1).max(8 * 60 * 60),
});

export const commandStatusSchema = z.enum([
  "PENDING_CONFIRMATION",
  "QUEUED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const commandRecordSchema = commandDraftSchema.extend({
  id: z.string().uuid(),
  capture_id: z.string().uuid().nullable(),
  status: commandStatusSchema,
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const captureSegmentSchema = z.object({
  id: z.string(),
  chapter_index: z.number().int().nonnegative(),
  speaker_label: z.string().nullable(),
  started_at_ms: z.number().int().nonnegative().nullable(),
  ended_at_ms: z.number().int().nonnegative().nullable(),
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const taskRecordSchema = taskSchema.extend({
  id: z.string(),
  capture_id: z.string(),
  status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
});

export const habitRecordSchema = habitSchema.extend({
  id: z.string(),
  capture_id: z.string(),
  event_date: z.string(),
  occurred_at: z.string().datetime(),
});

export const knowledgeRecordSchema = knowledgeSchema.extend({
  id: z.string(),
  capture_id: z.string(),
  created_at: z.string().datetime(),
});

export const financialTransactionRecordSchema = financialTransactionSchema.extend({
  id: z.string(),
  capture_id: z.string(),
  created_at: z.string().datetime(),
});

export const captureRecordSchema = z.object({
  id: z.string(),
  summary: z.string(),
  dominant_sentiment: sentimentSchema,
  energy_score: z.number().int().min(1).max(10),
  raw_text_cleaned: z.string(),
  transcript: z.string().nullable(),
  source: z.string(),
  processing_mode: processingModeSchema,
  audio_available: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export const dashboardResponseSchema = z.object({
  captures: z.array(captureRecordSchema),
  tasks: z.array(taskRecordSchema),
  habits: z.array(habitRecordSchema),
  knowledge: z.array(knowledgeRecordSchema),
  financial_transactions: z.array(financialTransactionRecordSchema),
  energy: z.array(z.object({
    date: z.string(),
    average: z.number(),
    captures: z.number().int().nonnegative(),
  })),
  stats: z.object({
    open_tasks: z.number().int().nonnegative(),
    completed_habits: z.number().int().nonnegative(),
    knowledge_notes: z.number().int().nonnegative(),
    current_streak: z.number().int().nonnegative(),
  }),
  persisted: z.boolean(),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(2_000),
  limit: z.number().int().min(1).max(20).default(8),
});

export const searchHitSchema = z.object({
  id: z.string(),
  capture_id: z.string(),
  kind: z.enum(["CAPTURE", "KNOWLEDGE", "TRANSCRIPT"]),
  title: z.string(),
  excerpt: z.string(),
  score: z.number(),
  created_at: z.string().datetime(),
  source: z.string().nullable(),
});

export const searchResponseSchema = z.object({
  answer: z.string(),
  hits: z.array(searchHitSchema),
  persisted: z.boolean(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const taskUpdateSchema = z.object({
  status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).optional(),
  due_date: z.string().datetime().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export const habitUpdateSchema = z.object({
  status: z.enum(["COMPLETED", "FAILED", "PARTIAL"]),
  metric_value: z.number().nullable().optional(),
  metric_unit: z.string().nullable().optional(),
  notes: z.string().max(2_000).optional(),
});

export const briefingDraftSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  insights: z.array(z.string().min(1)).min(1).max(6),
});

export const briefingSchema = briefingDraftSchema.extend({
  id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  audio_available: z.boolean(),
  created_at: z.string().datetime(),
});

export type Briefing = z.infer<typeof briefingSchema>;

export const integrationProviderSchema = z.enum([
  "TELEGRAM",
  "WHATSAPP",
  "NOTION",
  "TODOIST",
  "GOOGLE_CALENDAR",
  "APPLE_REMINDERS",
  "ELEVENLABS",
]);

export const integrationStatusSchema = z.object({
  provider: integrationProviderSchema,
  status: z.enum(["CONNECTED", "DISCONNECTED", "NEEDS_CONFIGURATION", "ERROR"]),
  capabilities: z.array(z.string()),
  last_synced_at: z.string().datetime().nullable(),
  message: z.string().nullable(),
});

export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
