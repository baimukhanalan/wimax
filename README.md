# WIMAX

Voice-first personal productivity OS for web, iOS, and Android. Record, import or forward a thought and WIMAX turns it into strict tasks, habits, financial transactions, confirmation-gated actions, connected knowledge, energy patterns, cited search results and audio briefings.

## Stack

- Next.js 16 web dashboard and server API
- Expo 57 mobile app for iOS and Android
- OpenAI Audio Transcriptions + Responses API Structured Outputs
- PostgreSQL with pgvector hybrid retrieval, transcript chapters and a dynamic knowledge graph
- Shared Zod contracts across server, web, and mobile
- Signed single-owner web sessions, native bearer authentication, durable rate limiting and auditable privacy workflows
- iOS Siri/App Shortcut and Android one-tap capture widget
- Background Meeting Mode with resumable checksummed upload and retryable diarized processing
- Bidirectional Notion, Todoist and Google Calendar adapters plus on-device Apple Reminders

## Local setup

1. Copy `.env.example` to `.env.local` and set private values locally. Never commit or paste them into chat.
2. Generate separate random values for the API token, session secret and encryption key.
3. Start PostgreSQL: `docker compose up -d`.
4. Install and run:

   ```sh
   pnpm install
   pnpm dev:web
   ```

5. For mobile, copy `apps/mobile/.env.example` to `apps/mobile/.env.local`, use your computer's LAN URL instead of `localhost` on a physical device, then run `pnpm dev:mobile`.

`pnpm dev:web` creates private ignored symlinks for the web environment; it never copies or prints secrets. Run `pnpm check` for the full lint, types, tests, web build and iOS/Android bundle gate.

## Security boundary

- Browser capture is accepted only same-origin.
- Production responses enforce CSP, HSTS, frame isolation, strict referrer handling, MIME sniffing protection, and a microphone-only Permissions Policy.
- Public web access uses `MIRROR_WEB_ACCOUNT` (default `mirror`) plus `MIRROR_WEB_PASSWORD`. A signed HttpOnly device cookie remembers the account label for one year, but never authenticates on its own; returning devices still need the password after the seven-day signed session expires. `MIRROR_SESSION_SECRET` must be at least 32 bytes.
- `/` is the public product landing page, `/desk` is the protected web app, `/downloads/cognitive-mirror-android.apk` serves the tested Android build, and `/download/ios` reports TestFlight readiness until Apple signing is complete.
- Native mobile login exchanges the owner password for a signed, expiring bearer token. The token is stored in iOS Keychain/Android Keystore through Expo SecureStore; no server API token is compiled into the app.
- Raw audio is transient by default. Set `MIRROR_STORE_ENCRYPTED_AUDIO=true` only with a 32-byte base64 `MIRROR_ENCRYPTION_KEY` to retain AES-256-GCM source audio for playback.
- `.env*` files are ignored. Never send keys through chat or commit them.
- Multi-account email/password sessions are enabled, API reads and writes are owner-scoped, and scheduled coaching, meeting processing, sync jobs and weekly briefings preserve each account owner. Database-enforced row-level security and optional social/OIDC login remain launch-hardening items before unrestricted public onboarding.

## API

`POST /api/capture` accepts either:

- `multipart/form-data`: `audio`, `current_datetime`, `source`
- JSON: `{ "transcript": "...", "current_datetime": "ISO-8601", "source": "..." }`

The response matches `captureResponseSchema` in `packages/contracts`.

Meeting Mode uses `POST /api/meetings`, idempotent `PUT /api/meetings/:id/chunks/:index`, and `POST /api/meetings/:id/complete`. External commands are persisted first and run only through the explicit confirmation endpoint. The recurring meeting, sync, coaching, and weekly briefing workers require `CRON_SECRET`.

## Production operations

- Apply migrations with `DATABASE_URL=... pnpm db:migrate`.
- Vercel runs the weekly briefing on Monday and daily retry workers for meetings, sync, and coaching; set `CRON_SECRET`. Meeting completion also starts processing immediately, so the daily worker is a recovery path rather than the primary path.
- Optional Telegram and WhatsApp imports require provider tokens and webhook secrets only when those extra capture channels are enabled. They are not required for web or native voice capture.
- ElevenLabs is optional; OpenAI TTS is the verified fallback.
- `LOCAL_AI_BASE_URL` switches private captures to an OpenAI-compatible local runtime.
- Native projects are authoritative because they contain the Android widget. After changing `app.json`, run Expo Prebuild and review the native diff before release.

See `docs/PRODUCTION_SCOPE.md` for verified release gates and the remaining external-provider/store acceptance work.
