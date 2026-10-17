# Cognitive Mirror production contract

This document turns the original product brief into verifiable release gates. A
feature is only considered shipped when its API, persistence, client workflow,
and tests are present. External providers additionally require a live credential
and an end-to-end verification run.

## Capture engine

- [x] Web and iOS/Android one-tap recording.
- [x] Text transcript fallback for deterministic testing.
- [x] Import shared audio directly in web/iOS/Android. Telegram/WhatsApp webhook imports remain supported as optional add-on channels and are not a launch dependency.
- [x] Provider chunking plus indexed transcript chapters for long sessions.
- [x] Speaker-aware transcripts when the selected provider supports diarization.
- [x] iOS Siri/App Shortcut and Android one-tap home/lock-screen widget.
- [x] Consent-gated Meeting Mode with continuous low-bitrate recording, screen-lock/background support, durable local queue, checksummed resumable network chunks, and retryable server processing.
- [x] “Hi Cognitive Mirror” App Shortcut phrases for capture and Meeting Mode.
- [ ] Dedicated watch app/complication (the iOS shortcut remains available through system surfaces).
- [ ] Arbitrary always-listening wake phrase in an explicitly enabled foreground local/private mode.

## AI layer

- [x] Strict schema extraction for tasks, habits, knowledge, financial transactions, commands, sentiment, and energy.
- [x] Relative-date resolution using the capture timezone.
- [x] Transcript segments, speakers, language, duration, and confidence-ready metadata.
- [x] Knowledge embeddings and hybrid semantic/lexical retrieval.
- [x] Automatic links between captures, projects, topics, and tags.
- [x] Provider-selectable cloud and private OpenAI-compatible processing policy.
- [x] Measured speaking-rate, pause-ratio, loudness-aware arousal support with conservative text/acoustic fusion; pitch remains null unless a native pitch measurement is supplied.

## Life dashboard

- [x] Persisted task timeline with completion and rescheduling API.
- [x] Habit definitions, daily events, streaks, and metric normalization.
- [x] Energy/productivity heatmaps backed by stored captures.
- [x] Weekly written and audio briefing generation with scheduled Monday job.
- [x] Data-backed three-day coaching signals with conservative, non-diagnostic language.
- [x] Scheduled coaching push pipeline with generated audio briefing playback after the user opens the notification.

## Knowledge and projects

- [x] Search returning the source capture, transcript segment, and answer citations.
- [x] Project/task/knowledge database views with filters and bulk task actions.
- [x] Bidirectional, idempotent task adapters and retryable sync jobs for Notion, Todoist, and Google Calendar.
- [x] Apple Reminders write/sync completion through consent-gated on-device EventKit.
- [x] Confirmation-gated execution layer for Notion, Todoist, Google Calendar, and Apple Reminders commands.

## Privacy and operations

- [x] Raw audio is transient and is not stored by the server.
- [x] Server-side size, origin/token, and schema validation.
- [x] Signed per-account web sessions and scoped native bearer authentication.
- [x] Multi-account email/password sessions with owner-scoped API reads and writes.
- [x] Multi-account background coaching, meeting processing, sync jobs and weekly briefings.
- [ ] Database-enforced PostgreSQL row-level security and optional social/OIDC login before unrestricted public onboarding.
- [x] Optional AES-256-GCM source-audio retention and auditable deletion/export workflows.
- [x] Durable PostgreSQL rate limiting and idempotent provider event processing.
- [x] Durable provider retries with exponential backoff and dead-letter handling after five failed attempts.
- [x] Structured failure events and health/readiness endpoint.
- [ ] Hosted tracing/error-reporting destination.
- [x] Live production web, database, mobile authentication, capture, and cleanup E2E.
- [x] Android 36 ARM64 emulator acceptance for secure login, production data, deep-link recording start, navigation safe areas, and widget registration.
- [ ] Apple/Google store signing, privacy disclosures, meeting-recording consent review, and live external-provider E2E.

## UI variants

- [x] Web A: operational Voice Command Desk.
- [x] Web B: Reflective Spatial Journal.
- [x] Mobile A: one-thumb capture timeline.
- [x] Mobile B: Daily Mirror ritual.
- [x] Responsive, accessible, interactive, and visually verified at target sizes (`design-qa.md`).

## Platform boundary

Custom always-listening wake words are deliberately not enabled in the public mobile build. iOS does not provide a public third-party API for an ordinary productivity app to replace the system wake word with an unrestricted background microphone listener, and doing so would contradict the product's privacy promise. The production-safe path implemented here is the “Hi Cognitive Mirror” App Shortcut through Siri/system surfaces plus the Android widget; an arbitrary wake word may only be added inside an explicitly enabled, foreground, on-device private runtime.
