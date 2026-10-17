import type { IntegrationStatus } from "@cognitive-mirror/contracts";

export function integrationStatuses(): IntegrationStatus[] {
  const configured = (value: string | undefined) => Boolean(value?.trim());
  return [
    status("TELEGRAM", configured(process.env.TELEGRAM_BOT_TOKEN), ["voice_import", "capture_confirmation"], "Set TELEGRAM_BOT_TOKEN and the webhook secret."),
    status("WHATSAPP", configured(process.env.WHATSAPP_ACCESS_TOKEN) && configured(process.env.WHATSAPP_PHONE_NUMBER_ID), ["voice_import", "capture_confirmation"], "Configure a Meta WhatsApp Business app and webhook."),
    status("NOTION", configured(process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN) && configured(process.env.NOTION_DATA_SOURCE_ID || process.env.NOTION_DATABASE_ID), ["tasks_read", "tasks_write", "knowledge_export", "bidirectional_sync"], "Connect a Notion integration and target data source."),
    status("TODOIST", configured(process.env.TODOIST_API_TOKEN), ["tasks_read", "tasks_write", "bidirectional_sync"], "Set a scoped Todoist API token."),
    status("GOOGLE_CALENDAR", configured(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) || (configured(process.env.GOOGLE_CLIENT_ID) && configured(process.env.GOOGLE_CLIENT_SECRET) && configured(process.env.GOOGLE_CALENDAR_REFRESH_TOKEN)), ["events_read", "events_write", "bidirectional_sync"], "Complete OAuth consent and calendar authorization."),
    { provider: "APPLE_REMINDERS", status: "NEEDS_CONFIGURATION", capabilities: ["tasks_read", "tasks_write", "on_device_only"], last_synced_at: null, message: "Requires an iOS EventKit entitlement and on-device consent." },
    status("ELEVENLABS", configured(process.env.ELEVENLABS_API_KEY), ["weekly_audio_briefing"], "Set ELEVENLABS_API_KEY and an optional voice ID; OpenAI TTS remains available as fallback."),
  ];
}

function status(provider: IntegrationStatus["provider"], ready: boolean, capabilities: string[], message: string): IntegrationStatus {
  return { provider, status: ready ? "CONNECTED" : "NEEDS_CONFIGURATION", capabilities, last_synced_at: null, message: ready ? null : message };
}
