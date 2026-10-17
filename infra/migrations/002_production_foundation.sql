CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE captures
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS processing_mode text NOT NULL DEFAULT 'CLOUD',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_envelope text,
  ADD COLUMN IF NOT EXISTS audio_mime_type text,
  ADD COLUMN IF NOT EXISTS audio_filename text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS event_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS external_refs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  chapter_index integer NOT NULL DEFAULT 0,
  speaker_label text,
  started_at_ms integer,
  ended_at_ms integer,
  text text NOT NULL,
  confidence double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  from_note_id uuid NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  to_note_id uuid NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_note_id, to_note_id, relation)
);

CREATE TABLE IF NOT EXISTS habit_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  normalized_name text NOT NULL,
  target_value double precision,
  target_unit text,
  cadence text NOT NULL DEFAULT 'DAILY',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_name)
);

INSERT INTO habit_definitions (user_id, normalized_name, target_unit)
SELECT user_id, habit_name, max(metric_unit)
FROM habits
GROUP BY user_id, habit_name
ON CONFLICT (user_id, normalized_name) DO UPDATE SET
  target_unit = COALESCE(habit_definitions.target_unit, EXCLUDED.target_unit);

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'DISCONNECTED',
  encrypted_credentials text,
  sync_cursor text,
  last_synced_at timestamptz,
  last_error text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_url text,
  audio_bytes bytea,
  audio_mime_type text,
  status text NOT NULL DEFAULT 'READY',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, period_end)
);

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS audio_bytes bytea,
  ADD COLUMN IF NOT EXISTS audio_mime_type text;

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  key_hash text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  status text NOT NULL DEFAULT 'PROCESSING',
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_id)
);

ALTER TABLE provider_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE INDEX IF NOT EXISTS captures_user_active_created_idx
  ON captures (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS captures_transcript_trgm_idx
  ON captures USING gin (transcript gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS transcript_segments_capture_idx
  ON transcript_segments (capture_id, chapter_index, started_at_ms);
CREATE INDEX IF NOT EXISTS transcript_segments_text_trgm_idx
  ON transcript_segments USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_notes_content_trgm_idx
  ON knowledge_notes USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_notes_embedding_idx
  ON knowledge_notes USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS knowledge_edges_user_score_idx
  ON knowledge_edges (user_id, score DESC);
CREATE INDEX IF NOT EXISTS habits_user_event_date_idx
  ON habits (user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS audit_events_user_created_idx
  ON audit_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_rate_limits_reset_idx
  ON api_rate_limits (reset_at);
CREATE INDEX IF NOT EXISTS provider_events_status_created_idx
  ON provider_events (status, created_at);
CREATE INDEX IF NOT EXISTS provider_events_retry_idx
  ON provider_events (next_attempt_at) WHERE status = 'FAILED';
