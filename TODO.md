# MTU Voting — TODO

## Done

- [x] **Migrate MySQL → Supabase Postgres** — pgx driver, `$n` placeholders, SQLSTATE 23505
      duplicate detection. Verified end to end (duplicate vote returns HTTP 409).
- [x] **Schema as code** — `backend/schema.sql`, including the `one_vote_per_category`
      constraint that the whole one-vote rule depends on.
- [x] **Seed candidates** — `backend/seed_candidates.sql`, generated from `src/data.ts` (18 candidates).
- [x] **`VITE_API_URL`** — replaced the hardcoded tunnelmole URL, de-duplicated into `src/lib/api.ts`.
- [x] **Server-side admin auth** — bcrypt hashes in `admin_users`, revocable session tokens
      in `admin_sessions`, `requireAdmin` middleware. Admin password removed from the frontend bundle.
- [x] **Voter PII fix** — `/api/tally` (aggregates) and `/api/my-ballots` are public;
      the full ledger with names and emails is now admin-only.

## Next

### 1. Voter authentication — BUILT, needs a Google client ID
Two factors, both required before a voting session is issued:
  1. Google OAuth verifies the email (backend checks the ID token signature + audience).
  2. The student roll number must match that email's record in `eligible_voters`.

Remaining before it can be used:
- [ ] Create an OAuth client ID (Google Cloud Console → Credentials → OAuth client ID →
      Web application). Add authorized JavaScript origins: `http://localhost:5173`
      and the production URL.
- [ ] Set `VITE_GOOGLE_CLIENT_ID` (frontend `.env`) and `GOOGLE_CLIENT_ID` (backend `.env`)
      to that same value. Voter login returns 503 until the backend one is set.
- [ ] Import the real student roll — see `backend/import_roll.sql`. Emails must be lowercase.
- [ ] End-to-end test with a real Google account (could not be tested without a client ID).

### 2. Deploy the Go backend
Vercel supports Go servers that listen on `$PORT`, which `main.go` already does
(https://vercel.com/docs/functions/runtimes/go).

- Second Vercel project, root directory `backend/` (frontend project stays at repo root).
- Set `DATABASE_URL` in project env (Production + Preview).
- Pin region to `icn1` (Seoul) to sit next to Supabase in `ap-northeast-2`.
- **Lower the connection pool before deploying**: `SetMaxOpenConns(10)` is sized for one
  long-lived process. Serverless runs many instances, each with its own pool — use 2-3.
- Alternative worth considering: Fly.io / Railway / Render give one persistent process,
  no cold starts and no per-instance pool math. Better fit for a long-running server.

### 3. Rotate exposed credentials
- Supabase database password (shared in a chat session).
- `sb_secret_…` service-role key (same) — bypasses RLS, so rotate regardless.
- Old MySQL root password and the old admin password remain in git history.

### 4. Livestream page
Currently a mockup. See analysis for detail.
- `activeVideoId` is hardcoded `null` with no setter — make it an admin-editable
  field on `election_settings` so the operator can paste a YouTube ID on the night.
- Replace the simulated chat (scripted array on a 4s timer, fake viewer counter)
  with the YouTube live-chat iframe — it brings identity, moderation and banning for free.
- Schedule block is hardcoded, including which items are marked done.

### 5. Cleanup
- Delete `src/pages/database.txt` and `src/imports/pasted_text/university-voting-srs.md` —
  both describe an abandoned Supabase/Next.js design and contradict the real schema.
- `EligibleVoter` in `src/types.ts` is defined but never used.
