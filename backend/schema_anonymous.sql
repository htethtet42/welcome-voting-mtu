-- Anonymous voting.
-- Apply after schema.sql:  psql "$DATABASE_URL" -f schema_anonymous.sql
--
-- When a voter opts in, the ballot is stored WITHOUT their name or email —
-- those columns are left empty rather than filled in and hidden later.
--
-- voter_id is still recorded, because the one_vote_per_category constraint
-- depends on it. It therefore remains possible for someone with direct
-- database access to link an anonymous ballot back to a voter. This hides
-- identity from the admin console, not from the database owner.
ALTER TABLE ballots
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
