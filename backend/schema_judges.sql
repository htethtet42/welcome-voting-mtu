-- Teacher / judge ballots with admin-assigned vote weight.
-- Apply after schema_voters.sql:  psql "$DATABASE_URL" -f schema_judges.sql
--
-- Nobody is pre-registered as a judge. Any Google account may REQUEST judge
-- access; the request grants nothing until an organiser approves it and sets a
-- multiplier. The admin's decision is the gate — the name a judge types is a
-- label so the organiser can recognise them, not a credential.
--
--   Google verified ──► judge_requests (pending) ──► admin approves at N×
--                              │                            │
--                              │                            ▼
--                              │                    eligible_voters
--                              │                    role='judge', vote_weight=N
--                              │                            │
--                              └──── poll status ◄──── voter_sessions
--
-- ---------------------------------------------------------------------------
-- eligible_voters: role + weight
-- ---------------------------------------------------------------------------
-- A judge IS a voter with a role and a multiplier. Modelling it this way keeps
-- the voter_sessions.email and voter_challenges.email foreign keys intact — a
-- separate judges table would force requireVoter (the hottest path in the app)
-- to query two tables and merge on every single request.
ALTER TABLE eligible_voters
  ADD COLUMN IF NOT EXISTS role        TEXT    NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS vote_weight INTEGER NOT NULL DEFAULT 1;

-- Weight is the one input that most directly decides who wins, so it is
-- constrained here rather than trusted to handlers — the same posture as
-- candidates_category_valid and election_settings_status_valid.
-- A weight of 100 instead of 10 would decide the election on its own.
DO $$ BEGIN
  ALTER TABLE eligible_voters
    ADD CONSTRAINT eligible_voters_role_valid CHECK (role IN ('student', 'judge'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE eligible_voters
    ADD CONSTRAINT eligible_voters_weight_valid CHECK (vote_weight IN (1, 3, 5, 10));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- voter_challenges: judge_only flag
-- ---------------------------------------------------------------------------
-- In roll mode an email that is NOT on the student roll may now sign in, but
-- only far enough to request judge access. This flag is what stops such a
-- challenge from being spent on the roll-number step instead: without it, the
-- new door for teachers would also be a new door into the student ballot.
ALTER TABLE voter_challenges
  ADD COLUMN IF NOT EXISTS judge_only BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- judge_requests — the approval queue
-- ---------------------------------------------------------------------------
-- Carries its OWN token and lifetime. It deliberately does not reuse
-- voter_challenges: that table's 10-minute TTL exists for "type your roll
-- number now" and is actively swept on every sign-in, so student traffic would
-- delete a waiting judge's place in the queue exactly when the night is
-- busiest and the organiser is most behind.
CREATE TABLE IF NOT EXISTS judge_requests (
  token        TEXT PRIMARY KEY,
  -- Short human code (J-07) the judge shows an organiser across a table.
  code         TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL REFERENCES eligible_voters(email) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  department   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending',
  -- NULL until approved. Approve-with-weight is one action, so a judge can
  -- never exist at an undefined multiplier.
  vote_weight  INTEGER,
  -- The voting session minted at approval, handed to the polling screen once.
  session_token TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  decided_by   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,

  CONSTRAINT judge_requests_status_valid
    CHECK (status IN ('pending', 'approved', 'declined')),
  CONSTRAINT judge_requests_weight_valid
    CHECK (vote_weight IS NULL OR vote_weight IN (1, 3, 5, 10)),
  -- An approved request must carry the weight it was approved at.
  CONSTRAINT judge_requests_approved_has_weight
    CHECK (status <> 'approved' OR vote_weight IS NOT NULL)
);

-- One live request per email: re-requesting replaces the previous pending row
-- rather than filling the organiser's queue with duplicates of one person.
CREATE UNIQUE INDEX IF NOT EXISTS judge_requests_one_pending_per_email
  ON judge_requests (email) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS judge_requests_status_idx  ON judge_requests (status, requested_at);
CREATE INDEX IF NOT EXISTS judge_requests_expires_idx ON judge_requests (expires_at);

-- ---------------------------------------------------------------------------
-- ballots: weight stamped at cast time
-- ---------------------------------------------------------------------------
-- The multiplier is copied onto the ballot when it is cast, NOT joined from
-- eligible_voters at tally time. Changing a judge's weight later therefore
-- affects only ballots cast afterwards, and can never silently rewrite a result
-- that has already been announced. The ledger stays immutable, which is the
-- posture audit_logs already takes.
ALTER TABLE ballots
  ADD COLUMN IF NOT EXISTS vote_weight INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE ballots
    ADD CONSTRAINT ballots_weight_valid CHECK (vote_weight IN (1, 3, 5, 10));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
