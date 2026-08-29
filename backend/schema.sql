-- MTU Voting — PostgreSQL / Supabase schema
--
-- Apply with:  psql "$DATABASE_URL" -f schema.sql
-- or paste into the Supabase SQL Editor.
--
-- NOTE: the backend connects as the `postgres` role, which BYPASSES row level
-- security. RLS is deliberately not enabled here — it would give a false sense
-- of protection. Authorization must be enforced in the Go handlers.

-- ---------------------------------------------------------------------------
-- candidates
-- ---------------------------------------------------------------------------
-- IDs are application-generated strings (e.g. 'king-1', 'candidate-1712...'),
-- not UUIDs, to stay compatible with the existing frontend seed data.
CREATE TABLE IF NOT EXISTS candidates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  nickname      TEXT NOT NULL DEFAULT '',
  department    TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL,
  bio           TEXT NOT NULL DEFAULT '',
  talent        TEXT NOT NULL DEFAULT '',
  photo         TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT candidates_category_valid CHECK (category IN (
    'king', 'queen', 'style', 'smart', 'popular_man', 'popular_woman'
  ))
);

-- ---------------------------------------------------------------------------
-- ballots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ballots (
  id           TEXT PRIMARY KEY,
  voter_id     TEXT NOT NULL,
  voter_email  TEXT NOT NULL,
  voter_name   TEXT NOT NULL,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CRITICAL: this constraint IS the one-vote-per-category rule.
  -- CastVoteHandler has no application-level duplicate check; it relies
  -- entirely on Postgres raising SQLSTATE 23505 here, which the handler
  -- translates into HTTP 409 "already_voted".
  -- Drop this constraint and duplicate voting silently succeeds.
  CONSTRAINT one_vote_per_category UNIQUE (voter_id, category)
);

CREATE INDEX IF NOT EXISTS ballots_candidate_idx  ON ballots (candidate_id);
CREATE INDEX IF NOT EXISTS ballots_created_at_idx ON ballots (created_at DESC);

-- ---------------------------------------------------------------------------
-- election_settings  (singleton row, always id = 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS election_settings (
  id        INTEGER PRIMARY KEY DEFAULT 1,
  type      TEXT NOT NULL DEFAULT 'fresher',
  status    TEXT NOT NULL DEFAULT 'scheduled',
  opens_at  TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,

  -- Enforce the singleton: only id = 1 may ever exist.
  CONSTRAINT election_settings_singleton CHECK (id = 1),
  CONSTRAINT election_settings_type_valid CHECK (type IN ('fresher', 'major')),
  CONSTRAINT election_settings_status_valid CHECK (status IN (
    'scheduled', 'open', 'closed', 'published'
  ))
);

-- The API reads `WHERE id = 1` unconditionally and errors if the row is
-- missing, so seed it here.
INSERT INTO election_settings (id, type, status)
VALUES (1, 'fresher', 'scheduled')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
