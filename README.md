<div align="center">

# 🪞 WIMAX

### Think out loud. Leave with clarity. — a voice-first OS for your tasks, habits, meetings &amp; knowledge.

_Also known as **Cognitive Mirror**._

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Expo](https://img.shields.io/badge/Expo_/_React_Native-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://platform.openai.com/)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)](https://turbo.build/)

[![Live Demo](https://img.shields.io/badge/Live_Demo-▶_Open_App-22C55E?style=for-the-badge)](https://cognitive-mirror-two.vercel.app)

</div>

---

## 📖 About

**WIMAX** is a voice-first operating system for personal effectiveness. Record,
import, or forward a thought and WIMAX turns it into structured tasks, habits,
financial entries, confirmation-gated actions, a connected knowledge graph,
energy signals, cited search results, and audio briefings.

Speech is transcribed with OpenAI Audio, then parsed into strict, schema-validated
entities with the OpenAI Responses API. Everything is persisted in PostgreSQL with
`pgvector` for hybrid semantic + lexical retrieval. The same [Zod](https://zod.dev/)
contracts are shared across the server, web, and mobile clients, so the data shape
is guaranteed end to end.

> **Status &amp; honesty note:** The product scope is ambitious and some capabilities
> are further along than others. Features below reflect what the code implements;
> items that are partial or external-provider–gated live in the [Roadmap](#-roadmap),
> not in the feature list. See `docs/PRODUCTION_SCOPE.md` for the per-feature release gates.

## ✨ Features

- 🎙️ **One-tap voice capture** on web, iOS, and Android — plus a text transcript fallback for deterministic testing.
- 🧠 **Structured extraction** — one capture becomes tasks, habits, knowledge notes, financial transactions, commands, sentiment, and energy, all validated against shared schemas.
- 🗓️ **Timezone-aware dates** — "next Tuesday" resolves against the capture's own timezone.
- 📊 **Life dashboard** — persisted task timeline, habit streaks &amp; metrics, and energy/productivity heatmaps built from your captures.
- 📝 **Weekly briefings &amp; coaching** — scheduled written and audio briefings, plus conservative, non-diagnostic three-day coaching signals.
- 🔎 **Cited search** — answers that link back to the source capture and transcript segment.
- 🕸️ **Knowledge graph** — automatic links between captures, projects, topics, and tags over `pgvector` embeddings.
- 🔗 **Integrations** — bidirectional, idempotent adapters for **Notion**, **Todoist**, and **Google Calendar**, plus on-device **Apple Reminders**, behind a confirmation-gated execution layer.
- 🎧 **Meeting Mode** — consent-gated long recording with a durable local queue, checksummed resumable uploads, and retryable server-side diarized processing.
- 🔐 **Privacy by default** — raw audio is transient unless you opt into AES-256-GCM encrypted retention; signed per-account web sessions and scoped native bearer tokens stored in Keychain/Keystore.

<!-- 📸 Screenshots: add images/GIFs of the Voice Command Desk, Reflective Journal, and mobile capture timeline here. -->
<!-- Example: ![Voice Command Desk](docs/screenshots/desk.png) -->

## 🏗️ Architecture

A [pnpm](https://pnpm.io/) + [Turborepo](https://turbo.build/) monorepo:

```
wimax/
├─ apps/
│  ├─ web/          # Next.js 16 dashboard + server API (App Router, route handlers)
│  │  ├─ app/       # /desk (app), /journal, /login, /register, /api/* route handlers
│  │  └─ lib/       # capture, AI parsing, meetings, sync, coaching, security, db
│  └─ mobile/       # Expo 57 / React Native app (iOS + Android, native widget module)
├─ packages/
│  └─ contracts/    # Shared Zod schemas + types (single source of truth)
├─ infra/
│  └─ migrations/   # Ordered SQL migrations (pgvector, meetings, sync, accounts)
├─ scripts/         # link-web-env.mjs (local env symlinking)
├─ docker-compose.yml  # PostgreSQL 17 + pgvector
└─ turbo.json       # build / dev / lint / typecheck / test pipeline
```

The web app hosts both the UI and the HTTP API (`/api/capture`, `/api/meetings`,
`/api/search`, `/api/integrations`, cron workers, and more). The mobile app talks
to the same API over a signed bearer token.

## 🧰 Tech Stack

| Layer        | Technology |
| ------------ | ---------- |
| Web          | Next.js 16, React 19, TypeScript, Tailwind-free CSS, lucide-react |
| Mobile       | Expo 57, React Native 0.86, expo-audio, SecureStore, background tasks |
| Shared       | TypeScript, Zod 4 contracts package |
| AI           | OpenAI Audio Transcriptions + Responses (Structured Outputs); optional local OpenAI-compatible runtime; ElevenLabs/OpenAI TTS |
| Data         | PostgreSQL 17 + pgvector, `postgres` client, SQL migrations |
| Tooling      | pnpm workspaces, Turborepo, Vitest, ESLint |
| Deploy       | Vercel (web + cron) and docker-compose (local Postgres) |

## 🚀 Getting Started

**Prerequisites:** Node.js, [pnpm](https://pnpm.io/) 11+, Docker, and an OpenAI API key.

```sh
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Set OPENAI_API_KEY and generate separate random values for
# MIRROR_API_TOKEN, MIRROR_SESSION_SECRET (>= 32 bytes), and MIRROR_ENCRYPTION_KEY.
# Never commit secrets or paste them into chat.

# 3. Start PostgreSQL (pgvector) and apply migrations
docker compose up -d
DATABASE_URL="postgresql://mirror:mirror@localhost:5432/mirror" pnpm db:migrate

# 4. Run the web app
pnpm dev:web      # http://localhost:3000  (/desk is the app)
```

For mobile, copy `apps/mobile/.env.example` to `apps/mobile/.env.local` (use your
machine's LAN URL instead of `localhost` on a physical device), then:

```sh
pnpm dev:mobile
```

Run the full gate — lint, types, tests, web build, and iOS/Android bundle — with:

```sh
pnpm check
```

## 🗺️ Roadmap

Honest view of what is partial or gated — see `docs/PRODUCTION_SCOPE.md` for detail.

- [ ] Database-enforced PostgreSQL row-level security + optional social/OIDC login before unrestricted public onboarding
- [ ] Apple/Google store signing, privacy disclosures, and live external-provider (Notion/Todoist/Calendar) end-to-end verification
- [ ] Hosted tracing / error-reporting destination
- [ ] Dedicated watch app / complication
- [ ] Arbitrary always-listening wake phrase in an explicitly enabled, on-device private mode
- [x] Core capture → structured extraction → dashboard pipeline
- [x] Meeting Mode with resumable, diarized processing
- [x] Multi-account sessions with owner-scoped reads/writes and background workers

## 📄 License

Released under the [MIT License](LICENSE).

---

<div align="center">
<sub>Built with Next.js, Expo, and OpenAI · <a href="https://cognitive-mirror-two.vercel.app">Live Demo</a></sub>
</div>
