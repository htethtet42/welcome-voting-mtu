#!/usr/bin/env bash
# Add or update one student on the voter roll.
#
#   ./add_voter.sh <email> <roll-number> [full name] [department]
#
# Example:
#   ./add_voter.sh aung.aung@gmail.com MTU-2026-0123 "Aung Aung" "Civil Engineering"
#
# The email must match the Google account the student signs in with.
# The roll number is the second factor they type after signing in.
set -euo pipefail

cd "$(dirname "$0")"
[ -f .env ] || { echo "error: backend/.env not found"; exit 1; }
set -a; . ./.env; set +a

if [ $# -lt 2 ]; then
  echo "usage: $0 <email> <roll-number> [full name] [department]" >&2
  exit 1
fi

EMAIL="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | xargs)"
ROLL="$2"
NAME="${3:-}"
DEPT="${4:-}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v email="$EMAIL" -v roll="$ROLL" -v name="$NAME" -v dept="$DEPT" <<'SQL'
INSERT INTO eligible_voters (email, student_id, name, department)
VALUES (:'email', :'roll', :'name', :'dept')
ON CONFLICT (email) DO UPDATE SET
  student_id = EXCLUDED.student_id,
  name       = EXCLUDED.name,
  department = EXCLUDED.department;

SELECT email, student_id, name, department FROM eligible_voters WHERE email = :'email';
SQL
