-- Voter authentication: Google OAuth + student roll number.
-- Apply after schema.sql:  psql "$DATABASE_URL" -f schema_voters.sql
--
-- Two factors, both required before a voting session is issued:
--   1. Google proves the person controls that email address.
--   2. The roll number proves they are the student that email belongs to on
--      the official roll (something only that student should know).

-- ---------------------------------------------------------------------------
-- eligible_voters — the official student roll
-- ---------------------------------------------------------------------------
-- Populated before the event from the registrar's list. An email that is not
-- in this table cannot vote, no matter how valid its Google account is.
CREATE TABLE IF NOT EXISTS eligible_voters (
  email      TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roll numbers are compared case-insensitively and trimmed, so index the
-- normalized form for lookups.
CREATE INDEX IF NOT EXISTS eligible_voters_student_id_idx
  ON eligible_voters (lower(trim(student_id)));

-- ---------------------------------------------------------------------------
-- voter_challenges — short-lived state between step 1 and step 2
-- ---------------------------------------------------------------------------
-- Issued once Google has verified the email, consumed when the correct roll
-- number is supplied. Holding this token does NOT authorize voting.
CREATE TABLE IF NOT EXISTS voter_challenges (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL REFERENCES eligible_voters(email) ON DELETE CASCADE,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Bound guessing: a roll number is low-entropy, so cap attempts per
  -- challenge. Exhausting them forces a fresh Google sign-in.
  CONSTRAINT voter_challenges_attempts_bounded CHECK (attempts >= 0 AND attempts <= 5)
);

CREATE INDEX IF NOT EXISTS voter_challenges_expires_idx ON voter_challenges (expires_at);

-- ---------------------------------------------------------------------------
-- voter_sessions — issued only after BOTH factors pass
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voter_sessions (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL REFERENCES eligible_voters(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voter_sessions_expires_idx ON voter_sessions (expires_at);
