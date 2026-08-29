-- Import the official student voter roll.
--
-- Only emails in this table can sign in and vote. The student_id is the second
-- factor: after Google verifies the email, the student must type the matching
-- roll number.
--
-- OPTION A — bulk import from CSV (recommended for a real roll).
-- CSV columns, with a header row:  email,student_id,name,department
--
--   psql "$DATABASE_URL" \
--     -c "\copy eligible_voters (email, student_id, name, department) \
--         FROM 'students.csv' WITH (FORMAT csv, HEADER true)"
--
-- Emails MUST be lowercase — sign-in lowercases the address from Google before
-- looking it up, so a roll entry with capitals will never match. Normalize
-- after import with:
--
--   UPDATE eligible_voters SET email = lower(trim(email));
--
-- OPTION B — add individual students by hand:

INSERT INTO eligible_voters (email, student_id, name, department) VALUES
  ('student.one@gmail.com', 'MTU-2026-0001', 'Student One', 'Civil Engineering'),
  ('student.two@gmail.com', 'MTU-2026-0002', 'Student Two', 'Architecture')
ON CONFLICT (email) DO UPDATE SET
  student_id = EXCLUDED.student_id,
  name       = EXCLUDED.name,
  department = EXCLUDED.department;

-- Sanity checks before the event:
--   SELECT count(*) FROM eligible_voters;
--   SELECT count(*) FROM eligible_voters WHERE email <> lower(trim(email));  -- must be 0
--   SELECT count(*) FROM eligible_voters WHERE trim(student_id) = '';        -- must be 0
