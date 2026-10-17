CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  summary text NOT NULL,
  dominant_sentiment text NOT NULL,
  energy_score smallint NOT NULL CHECK (energy_score BETWEEN 1 AND 10),
  raw_text_cleaned text NOT NULL,
  source text NOT NULL DEFAULT 'VOICE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS captures_user_created_idx ON captures (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  title text NOT NULL,
  project text NOT NULL DEFAULT 'Inbox',
  due_date timestamptz,
  priority text NOT NULL,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  habit_name text NOT NULL,
  status text NOT NULL,
  metric_value double precision,
  metric_unit text,
  notes text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  topic text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS habits_user_occurred_idx ON habits (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_user_created_idx ON knowledge_notes (user_id, created_at DESC);
