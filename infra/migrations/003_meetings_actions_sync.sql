CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'RECORDING',
  source text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,
  chunk_duration_seconds integer NOT NULL DEFAULT 300,
  expected_chunks integer,
  total_bytes bigint NOT NULL DEFAULT 0,
  consent_confirmed_at timestamptz NOT NULL,
  capture_id uuid REFERENCES captures(id) ON DELETE SET NULL,
  error text,
  processing_attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('RECORDING', 'UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED')),
  CHECK (chunk_duration_seconds BETWEEN 30 AND 600),
  CHECK (expected_chunks IS NULL OR expected_chunks BETWEEN 1 AND 240),
  CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 28800)
);

CREATE TABLE IF NOT EXISTS meeting_chunks (
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  mime_type text NOT NULL,
  filename text NOT NULL,
  checksum_sha256 text NOT NULL,
  byte_length integer NOT NULL,
  payload bytea NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, chunk_index),
  CHECK (chunk_index BETWEEN 0 AND 239),
  CHECK (byte_length > 0 AND byte_length <= 12582912)
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  description text NOT NULL,
  amount numeric(18, 4) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('EXPENSE', 'INCOME', 'TRANSFER')),
  category text NOT NULL,
  occurred_at timestamptz,
  account text,
  merchant text,
  notes text NOT NULL DEFAULT '',
  external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audio_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  arousal double precision NOT NULL CHECK (arousal BETWEEN 1 AND 10),
  valence double precision NOT NULL CHECK (valence BETWEEN -1 AND 1),
  speaking_rate_wpm double precision,
  pause_ratio double precision CHECK (pause_ratio IS NULL OR pause_ratio BETWEEN 0 AND 1),
  pitch_variability double precision,
  confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capture_id)
);

CREATE TABLE IF NOT EXISTS commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid REFERENCES captures(id) ON DELETE SET NULL,
  user_id text NOT NULL,
  command_type text NOT NULL,
  provider text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  requires_confirmation boolean NOT NULL DEFAULT true,
  idempotency_key text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  executed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  CHECK (status IN ('PENDING_CONFIRMATION', 'QUEUED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS external_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL,
  entity_type text NOT NULL,
  local_id text NOT NULL,
  external_id text NOT NULL,
  external_updated_at timestamptz,
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, entity_type, local_id),
  UNIQUE (user_id, provider, entity_type, external_id)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('PUSH', 'PULL', 'BIDIRECTIONAL')),
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  cursor text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('IOS', 'ANDROID')),
  token text NOT NULL,
  locale text,
  timezone text,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE TABLE IF NOT EXISTS coaching_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  trigger_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio_bytes bytea,
  audio_mime_type text,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'OPENED', 'SKIPPED', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS meetings_user_updated_idx ON meetings (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS meetings_processing_idx ON meetings (status, next_attempt_at) WHERE status IN ('QUEUED', 'FAILED');
CREATE INDEX IF NOT EXISTS financial_transactions_user_time_idx ON financial_transactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS commands_user_status_idx ON commands (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS sync_jobs_queue_idx ON sync_jobs (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS coaching_notifications_user_created_idx ON coaching_notifications (user_id, created_at DESC);
