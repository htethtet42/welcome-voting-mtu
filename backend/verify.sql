-- Post-migration verification. Safe to run repeatedly; cleans up after itself.
--
--   psql "$DATABASE_URL" -f verify.sql
--
-- Run WITHOUT -v ON_ERROR_STOP=1: the duplicate-vote test below is EXPECTED to
-- raise an error, and psql must keep going so you can see it.

\echo '=== 1. Tables present (expect: audit_logs, ballots, candidates, election_settings) ==='
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

\echo ''
\echo '=== 2. The one-vote-per-category constraint (expect exactly one row) ==='
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'ballots'::regclass AND conname = 'one_vote_per_category';

\echo ''
\echo '=== 3. election_settings singleton (expect one row: id=1, fresher, scheduled) ==='
SELECT id, type, status FROM election_settings;

\echo ''
\echo '=== 4. DUPLICATE VOTE TEST ==='
\echo '--- setup ---'
INSERT INTO candidates (id, name, category)
VALUES ('__verify__', 'Verify Candidate', 'king')
ON CONFLICT (id) DO NOTHING;

\echo '--- first vote: MUST SUCCEED (expect INSERT 0 1) ---'
INSERT INTO ballots (id, voter_id, voter_email, voter_name, candidate_id, category)
VALUES ('__verify_b1__', '__verify_v1__', 'v@test.local', 'Verifier', '__verify__', 'king');

\echo ''
\echo '--- second vote, same voter + category: MUST FAIL with SQLSTATE 23505 ---'
\echo '--- (an error here is SUCCESS; "INSERT 0 1" means the rule is BROKEN) ---'
INSERT INTO ballots (id, voter_id, voter_email, voter_name, candidate_id, category)
VALUES ('__verify_b2__', '__verify_v1__', 'v@test.local', 'Verifier', '__verify__', 'king');

\echo ''
\echo '--- different category, same voter: MUST SUCCEED (6 categories per voter) ---'
INSERT INTO ballots (id, voter_id, voter_email, voter_name, candidate_id, category)
VALUES ('__verify_b3__', '__verify_v1__', 'v@test.local', 'Verifier', '__verify__', 'queen');

\echo ''
\echo '=== 5. Ballots for test voter (expect exactly 2: king + queen) ==='
SELECT category, candidate_id FROM ballots
WHERE voter_id = '__verify_v1__' ORDER BY category;

\echo ''
\echo '=== 6. Cleanup (cascades to ballots) ==='
DELETE FROM candidates WHERE id = '__verify__';

\echo ''
\echo '=== 7. Residue check (expect 0) ==='
SELECT count(*) AS leftover_test_ballots FROM ballots WHERE voter_id = '__verify_v1__';
