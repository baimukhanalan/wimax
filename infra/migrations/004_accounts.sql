CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash bytea NOT NULL,
  password_salt bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_name_unique_idx ON accounts (lower(account_name));
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique_idx ON accounts (lower(email));

