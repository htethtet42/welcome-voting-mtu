-- Admin authentication tables.
-- Apply after schema.sql:  psql "$DATABASE_URL" -f schema_auth.sql

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
-- Passwords are stored ONLY as bcrypt hashes. Never insert a plaintext
-- password here. Generate a hash with:  go run ./cmd/hashpw <password>
CREATE TABLE IF NOT EXISTS admin_users (
  email         TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT 'Event Admin',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- admin_sessions
-- ---------------------------------------------------------------------------
-- Opaque bearer tokens. Deleting a row revokes that session immediately,
-- which a stateless JWT could not do without extra machinery.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL REFERENCES admin_users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);
