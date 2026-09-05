package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"google.golang.org/api/idtoken"
)

const (
	// challengeTTL bounds how long a verified Google sign-in may sit waiting
	// for its roll number before the user must sign in again.
	challengeTTL = 10 * time.Minute

	// voterSessionTTL covers an event evening.
	voterSessionTTL = 12 * time.Hour

	// maxRollAttempts caps guesses per challenge. Roll numbers are
	// low-entropy and often sequential, so an unbounded endpoint would let
	// someone enumerate their way into another student's ballot.
	maxRollAttempts = 5
)

// voterCtxKey carries the authenticated voter through the request context.
// Handlers must read identity from here, never from the request body.
type voterCtxKey struct{}

// Voter is the authenticated identity attached to a request by requireVoter.
//
// Role and Weight come from eligible_voters on every request, not from the
// session token, so revoking a judge takes effect on their very next action
// rather than whenever their session happens to expire.
type Voter struct {
	Email     string
	StudentID string
	Name      string
	Role      string // "student" or "judge"
	Weight    int    // ballot multiplier; 1 for students
}

// issueVoterSession mints a voting session for an already-authenticated email.
//
// Extracted because two paths now reach this point — a student passing the
// roll-number step, and a judge being approved by an organiser — and session
// minting is exactly the code that must not drift between them.
func issueVoterSession(db *sql.DB, email string) (string, time.Time, error) {
	token, err := newSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}

	expires := time.Now().Add(voterSessionTTL)
	if _, err := db.Exec(
		"INSERT INTO voter_sessions (token, email, expires_at) VALUES ($1, $2, $3)",
		token, email, expires,
	); err != nil {
		return "", time.Time{}, err
	}

	db.Exec("DELETE FROM voter_sessions WHERE expires_at < now()")
	return token, expires, nil
}

type googleLoginPayload struct {
	Credential string `json:"credential"`
}

type verifyRollPayload struct {
	ChallengeToken string `json:"challengeToken"`
	StudentID      string `json:"studentId"`
}

// normalizeRoll makes roll-number comparison forgiving of case and stray
// whitespace, which students routinely get wrong on a phone keyboard.
func normalizeRoll(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// GoogleLoginHandler is step 1 of voter login.
//
// It verifies the Google ID token, confirms the email appears on the official
// roll, and issues a short-lived CHALLENGE token. That token does not
// authorize voting — the roll number must still be supplied in step 2.
func GoogleLoginHandler(db *sql.DB) http.HandlerFunc {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if clientID == "" {
			log.Println("GOOGLE_CLIENT_ID is not set; voter login is disabled")
			http.Error(w, "login_unavailable", http.StatusServiceUnavailable)
			return
		}

		var payload googleLoginPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Credential == "" {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate verifies the token's signature against Google's public keys
		// and checks that it was issued for THIS application. Without the
		// audience check, a token minted for any other site would be accepted.
		tokenInfo, err := idtoken.Validate(r.Context(), payload.Credential, clientID)
		if err != nil {
			log.Printf("Google token validation failed: %v\n", err)
			http.Error(w, "invalid_google_token", http.StatusUnauthorized)
			return
		}

		email, _ := tokenInfo.Claims["email"].(string)
		emailVerified, _ := tokenInfo.Claims["email_verified"].(bool)
		email = strings.ToLower(strings.TrimSpace(email))

		if email == "" || !emailVerified {
			http.Error(w, "email_not_verified", http.StatusUnauthorized)
			return
		}

		googleName, _ := tokenInfo.Claims["name"].(string)

		var name string

		// judgeOnly marks a challenge that may be spent ONLY on a judge access
		// request, never on the roll-number step.
		judgeOnly := false

		err = db.QueryRow(
			"SELECT name FROM eligible_voters WHERE email = $1", email,
		).Scan(&name)

		switch {
		case err == nil:
			// Already known — nothing to do.

		case err != sql.ErrNoRows:
			log.Printf("Eligibility lookup error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return

		default:
			// Not on the roll.
			//
			// In roll mode this used to be a flat 403, which locked teachers out
			// of the judge flow entirely: a teacher is not on the student roll by
			// definition, so they were rejected here before they could ever reach
			// the judge request screen. The feature worked in demo mode and
			// silently vanished the moment the election went live.
			//
			// They are now admitted, but only far enough to make that request.
			// The row is created with an EMPTY student_id, which is what keeps
			// the student gate intact: VerifyRollHandler in roll mode compares
			// the supplied roll number against that stored value, and an empty
			// one matches nothing. judgeOnly is the explicit belt to that braces.
			judgeOnly = eligibilityMode() == "roll"

			name = googleName
			if name == "" {
				name = strings.SplitN(email, "@", 2)[0]
			}
			if _, err := db.Exec(
				"INSERT INTO eligible_voters (email, student_id, name) VALUES ($1, '', $2) ON CONFLICT (email) DO NOTHING",
				email, name,
			); err != nil {
				log.Printf("Voter registration error: %v\n", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			if judgeOnly {
				log.Printf("Admitted off-roll account for judge request only: %s\n", email)
			} else {
				log.Printf("Registered new voter (demo mode): %s\n", email)
			}
		}

		challenge, err := newSessionToken()
		if err != nil {
			log.Printf("Challenge token generation error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// One live challenge per voter: starting a new sign-in invalidates any
		// previous half-finished attempt and its accumulated guesses.
		if _, err := db.Exec("DELETE FROM voter_challenges WHERE email = $1", email); err != nil {
			log.Printf("Challenge cleanup error: %v\n", err)
		}

		if _, err := db.Exec(
			"INSERT INTO voter_challenges (token, email, expires_at, judge_only) VALUES ($1, $2, $3, $4)",
			challenge, email, time.Now().Add(challengeTTL), judgeOnly,
		); err != nil {
			log.Printf("Challenge insert error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		db.Exec("DELETE FROM voter_challenges WHERE expires_at < now()")

		log.Printf("Google sign-in accepted for %s (judgeOnly=%t)\n", email, judgeOnly)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "needs_identity",
			"challengeToken": challenge,
			"email":          email,
			"name":           name,
			"attemptsLeft":   maxRollAttempts,
			// The sign-in screen hides the Student option when this is true:
			// the account is not on the roll, so the roll-number step would
			// reject it no matter what they typed.
			"judgeOnly": judgeOnly,
		})
	}
}

// VerifyRollHandler is step 2 of voter login: it checks the roll number
// against the record for the email Google verified, and only then issues a
// voting session.
func VerifyRollHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload verifyRollPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if payload.ChallengeToken == "" || strings.TrimSpace(payload.StudentID) == "" {
			http.Error(w, "Challenge token and student ID are required", http.StatusBadRequest)
			return
		}

		var email string
		var attempts int
		var expiresAt time.Time
		var judgeOnly bool
		err := db.QueryRow(
			"SELECT email, attempts, expires_at, judge_only FROM voter_challenges WHERE token = $1",
			payload.ChallengeToken,
		).Scan(&email, &attempts, &expiresAt, &judgeOnly)

		if err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Challenge lookup error: %v\n", err)
			}
			http.Error(w, "invalid_challenge", http.StatusUnauthorized)
			return
		}

		if time.Now().After(expiresAt) {
			db.Exec("DELETE FROM voter_challenges WHERE token = $1", payload.ChallengeToken)
			http.Error(w, "challenge_expired", http.StatusUnauthorized)
			return
		}

		if attempts >= maxRollAttempts {
			db.Exec("DELETE FROM voter_challenges WHERE token = $1", payload.ChallengeToken)
			http.Error(w, "too_many_attempts", http.StatusTooManyRequests)
			return
		}

		// SECURITY GUARD. This challenge belongs to an account that is not on
		// the student roll, admitted solely so a teacher could request judge
		// access. Letting it reach the roll-number check would turn the judge
		// door into a second, unguarded door into the student ballot.
		//
		// The stored roll number is empty for these accounts so the comparison
		// below would fail anyway; this refuses explicitly rather than relying
		// on that coincidence holding true after a future edit.
		if judgeOnly {
			log.Printf("Refused roll-number step for off-roll account: %s\n", email)
			http.Error(w, "not_eligible", http.StatusForbidden)
			return
		}

		var storedRoll, name string
		if err := db.QueryRow(
			"SELECT student_id, name FROM eligible_voters WHERE email = $1", email,
		).Scan(&storedRoll, &name); err != nil {
			log.Printf("Roll lookup error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// How the roll number is judged depends on the mode:
		//   format — must merely look like a roll number (demo).
		//   roll   — must match the registrar's record exactly.
		var accepted bool
		if eligibilityMode() == "roll" {
			accepted = normalizeRoll(storedRoll) == normalizeRoll(payload.StudentID)
		} else {
			accepted = validRollFormat(payload.StudentID)
		}

		if !accepted {
			// Count the failure before responding, so the cap cannot be evaded
			// by abandoning the response.
			db.Exec(
				"UPDATE voter_challenges SET attempts = attempts + 1 WHERE token = $1",
				payload.ChallengeToken,
			)
			remaining := maxRollAttempts - (attempts + 1)
			log.Printf("Incorrect roll number for %s (%d attempts left)\n", email, remaining)

			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":        "incorrect_roll_number",
				"attemptsLeft": remaining,
			})
			return
		}

		// In demo mode the supplied roll number becomes this voter's record, so
		// it shows on their ballot and in the admin ledger.
		if eligibilityMode() != "roll" {
			roll := strings.TrimSpace(payload.StudentID)
			if _, err := db.Exec(
				"UPDATE eligible_voters SET student_id = $1 WHERE email = $2", roll, email,
			); err != nil {
				log.Printf("Roll update error: %v\n", err)
			}
			storedRoll = roll
		}

		// Checks passed — issue the voting session.
		token, expires, err := issueVoterSession(db, email)
		if err != nil {
			log.Printf("Voter session error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		db.Exec("DELETE FROM voter_challenges WHERE token = $1", payload.ChallengeToken)

		log.Printf("Voter authenticated: %s\n", email)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"token":     token,
			"email":     email,
			"name":      name,
			"studentId": storedRoll,
			"role":      "student",
			"weight":    1,
			"expiresAt": expires,
		})
	}
}

// VoterLogoutHandler revokes the caller's voting session.
func VoterLogoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if token := bearerToken(r); token != "" {
			if _, err := db.Exec("DELETE FROM voter_sessions WHERE token = $1", token); err != nil {
				log.Printf("Voter logout error: %v\n", err)
			}
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
	}
}

// requireVoter authenticates a voting request and attaches the voter's
// identity to the request context.
//
// Identity comes from the session, never from the request body: previously a
// caller could put any voterId/email/name in the JSON and the server believed
// it, which made one-vote-per-category trivially bypassable.
func requireVoter(db *sql.DB, next func(http.ResponseWriter, *http.Request, Voter)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		token := bearerToken(r)
		if token == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var email string
		var expiresAt time.Time
		err := db.QueryRow(
			"SELECT email, expires_at FROM voter_sessions WHERE token = $1", token,
		).Scan(&email, &expiresAt)

		if err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Voter session lookup error: %v\n", err)
			}
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if time.Now().After(expiresAt) {
			db.Exec("DELETE FROM voter_sessions WHERE token = $1", token)
			http.Error(w, "session_expired", http.StatusUnauthorized)
			return
		}

		// Role and weight are read here, on every request, rather than baked
		// into the session at login: revoking a judge then takes effect on
		// their next action instead of whenever their 12-hour session lapses.
		var voter Voter
		voter.Email = email
		if err := db.QueryRow(
			"SELECT student_id, name, role, vote_weight FROM eligible_voters WHERE email = $1", email,
		).Scan(&voter.StudentID, &voter.Name, &voter.Role, &voter.Weight); err != nil {
			// Removed from the roll after the session was issued.
			log.Printf("Voter no longer on roll: %s (%v)\n", email, err)
			http.Error(w, "not_eligible", http.StatusForbidden)
			return
		}

		next(w, r.WithContext(context.WithValue(r.Context(), voterCtxKey{}, voter)), voter)
	}
}
