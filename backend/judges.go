package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// judgeRequestTTL covers a whole event evening.
//
// Deliberately NOT reused from challengeTTL (10 minutes). That timer exists for
// "type your roll number now", and GoogleLoginHandler actively sweeps expired
// challenges on every sign-in — so with 300 students signing in, a judge
// waiting on a busy organiser would have their place in the queue deleted by
// student traffic, exactly when the night is busiest.
const judgeRequestTTL = 8 * time.Hour

// allowedJudgeWeights mirrors the CHECK constraint in schema_judges.sql and the
// segmented control in the admin UI. Kept in all three places on purpose: the
// UI stops honest mistakes, the handler stops crafted requests, and the
// constraint stops anything that reaches the database another way.
var allowedJudgeWeights = []int{1, 3, 5, 10}

// judgeWeightValid reports whether w is a multiplier an organiser may assign.
//
// This is the one input that most directly decides who wins. A weight of 100
// where 10 was meant would decide the election on its own, and nothing else in
// the app would notice.
func judgeWeightValid(w int) bool {
	for _, allowed := range allowedJudgeWeights {
		if w == allowed {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Request lifecycle
// ---------------------------------------------------------------------------
//
//	   Google verified (voter_challenges)
//	              │
//	              ▼  POST /auth/request-judge  (name + department)
//	        ┌───────────┐
//	        │  pending  │──── poll ────► "waiting for approval"  (J-07)
//	        └─────┬─────┘
//	              │  POST /judges/decide  (admin, weight required to approve)
//	      ┌───────┴────────┐
//	      ▼                ▼
//	┌──────────┐     ┌──────────┐
//	│ approved │     │ declined │
//	└────┬─────┘     └────┬─────┘
//	     │                └──► "not approved" → offer the student path
//	     │
//	     ├─► eligible_voters.role = 'judge', vote_weight = N
//	     └─► voter_sessions row; token handed to the polling screen

type requestJudgePayload struct {
	ChallengeToken string `json:"challengeToken"`
	Name           string `json:"name"`
	Department     string `json:"department"`
}

type judgeStatusPayload struct {
	RequestToken string `json:"requestToken"`
}

type decideJudgePayload struct {
	Token    string `json:"token"`
	Decision string `json:"decision"`
	Weight   int    `json:"weight"`
}

// nextJudgeCode returns the next short human code (J-01, J-02, ...).
//
// The organiser reads this off a phone held across a desk, so it has to be
// short and unambiguous — an email address or a UUID is unusable for that.
// Codes are unique-constrained; the caller retries on collision.
func nextJudgeCode(db *sql.DB) (string, error) {
	var n int
	err := db.QueryRow(`
		SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^J-', ''), '')::INTEGER), 0) + 1
		FROM judge_requests
	`).Scan(&n)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("J-%02d", n), nil
}

// RequestJudgeHandler is step 2 of the judge path: the caller has already
// proved control of their email via Google, and now names themselves for an
// organiser to recognise.
//
// This grants NOTHING. It creates a pending row and returns a token the
// waiting screen polls. Only an admin decision issues a voting session.
func RequestJudgeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload requestJudgePayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(payload.Name)
		if payload.ChallengeToken == "" || name == "" {
			http.Error(w, "name_required", http.StatusBadRequest)
			return
		}

		// The challenge proves Google verified this email moments ago.
		var email string
		var expiresAt time.Time
		err := db.QueryRow(
			"SELECT email, expires_at FROM voter_challenges WHERE token = $1",
			payload.ChallengeToken,
		).Scan(&email, &expiresAt)
		if err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Judge challenge lookup error: %v\n", err)
			}
			http.Error(w, "invalid_challenge", http.StatusUnauthorized)
			return
		}
		if time.Now().After(expiresAt) {
			db.Exec("DELETE FROM voter_challenges WHERE token = $1", payload.ChallengeToken)
			http.Error(w, "challenge_expired", http.StatusUnauthorized)
			return
		}

		// One live request per person. Re-requesting replaces the previous
		// pending row rather than filling the organiser's queue with duplicates
		// of the same teacher (enforced by judge_requests_one_pending_per_email).
		if _, err := db.Exec(
			"DELETE FROM judge_requests WHERE email = $1 AND status = 'pending'", email,
		); err != nil {
			log.Printf("Judge request cleanup error: %v\n", err)
		}

		requestToken, err := newSessionToken()
		if err != nil {
			log.Printf("Judge request token error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Codes are assigned from MAX+1, so two teachers submitting at the same
		// instant can collide on the unique index. Retry rather than fail: the
		// person is standing at the desk waiting.
		var code string
		for attempt := 0; attempt < 5; attempt++ {
			code, err = nextJudgeCode(db)
			if err != nil {
				log.Printf("Judge code generation error: %v\n", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			_, err = db.Exec(`
				INSERT INTO judge_requests (token, code, email, name, department, expires_at)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, requestToken, code, email, name, strings.TrimSpace(payload.Department),
				time.Now().Add(judgeRequestTTL))
			if err == nil {
				break
			}
			if !uniqueViolation(err) {
				log.Printf("Judge request insert error: %v\n", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		}
		if err != nil {
			log.Printf("Judge code collision could not be resolved: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// The challenge has been spent. The request token is the credential now,
		// and it has its own, much longer, lifetime.
		db.Exec("DELETE FROM voter_challenges WHERE token = $1", payload.ChallengeToken)
		db.Exec("DELETE FROM judge_requests WHERE expires_at < now() AND status = 'pending'")

		log.Printf("Judge access requested by %s as %q (%s)\n", email, name, code)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       "pending",
			"requestToken": requestToken,
			"code":         code,
			"email":        email,
			"name":         name,
		})
	}
}

// JudgeStatusHandler is polled by the waiting screen.
//
// It is the ONLY way an approved judge receives their voting session, which is
// what lets the pending screen advance into the ballot on its own instead of
// asking a teacher to sign in a second time.
func JudgeStatusHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload judgeStatusPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.RequestToken == "" {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		var status, code, email, name string
		var weight sql.NullInt64
		var sessionToken sql.NullString
		var requestedAt, expiresAt time.Time

		err := db.QueryRow(`
			SELECT status, code, email, name, vote_weight, session_token, requested_at, expires_at
			FROM judge_requests WHERE token = $1
		`, payload.RequestToken).Scan(
			&status, &code, &email, &name, &weight, &sessionToken, &requestedAt, &expiresAt,
		)
		if err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Judge status lookup error: %v\n", err)
			}
			http.Error(w, "invalid_request_token", http.StatusUnauthorized)
			return
		}

		if status == "pending" && time.Now().After(expiresAt) {
			http.Error(w, "request_expired", http.StatusUnauthorized)
			return
		}

		out := map[string]interface{}{
			"status":      status,
			"code":        code,
			"email":       email,
			"name":        name,
			"requestedAt": requestedAt,
		}
		if status == "approved" {
			out["weight"] = weight.Int64
			out["token"] = sessionToken.String
		}
		json.NewEncoder(w).Encode(out)
	}
}

// pendingJudge is one row of the organiser's approval queue.
type pendingJudge struct {
	Token       string    `json:"token"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	Department  string    `json:"department"`
	RequestedAt time.Time `json:"requestedAt"`
}

// approvedJudge is one row of the roster, with what their ballots have
// actually contributed so far.
type approvedJudge struct {
	Email       string `json:"email"`
	Name        string `json:"name"`
	Weight      int    `json:"weight"`
	Ballots     int    `json:"ballots"`
	Contributed int    `json:"contributed"`
}

// ListJudgesHandler returns the queue and the roster for the admin Judges tab.
func ListJudgesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		pending := []pendingJudge{}
		rows, err := db.Query(`
			SELECT token, code, name, email, department, requested_at
			FROM judge_requests
			WHERE status = 'pending' AND expires_at > now()
			ORDER BY requested_at ASC
		`)
		if err != nil {
			log.Printf("Judge queue query error: %v\n", err)
			http.Error(w, "Failed to load judges", http.StatusInternalServerError)
			return
		}
		for rows.Next() {
			var p pendingJudge
			if err := rows.Scan(&p.Token, &p.Code, &p.Name, &p.Email, &p.Department, &p.RequestedAt); err != nil {
				rows.Close()
				log.Printf("Judge queue scan error: %v\n", err)
				http.Error(w, "Failed to read judges", http.StatusInternalServerError)
				return
			}
			pending = append(pending, p)
		}
		rows.Close()

		// Contributed is summed from the ballots themselves, not computed as
		// weight × ballots: a judge's current weight may differ from the weight
		// stamped on ballots they cast earlier.
		approved := []approvedJudge{}
		rows, err = db.Query(`
			SELECT v.email, v.name, v.vote_weight,
			       COALESCE(b.n, 0), COALESCE(b.contributed, 0)
			FROM eligible_voters v
			LEFT JOIN (
				SELECT voter_id, count(*) AS n, sum(vote_weight) AS contributed
				FROM ballots GROUP BY voter_id
			) b ON b.voter_id = 'email:' || v.email
			WHERE v.role = 'judge'
			ORDER BY v.vote_weight DESC, v.name ASC
		`)
		if err != nil {
			log.Printf("Judge roster query error: %v\n", err)
			http.Error(w, "Failed to load judges", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var a approvedJudge
			if err := rows.Scan(&a.Email, &a.Name, &a.Weight, &a.Ballots, &a.Contributed); err != nil {
				log.Printf("Judge roster scan error: %v\n", err)
				http.Error(w, "Failed to read judges", http.StatusInternalServerError)
				return
			}
			approved = append(approved, a)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"pending":  pending,
			"approved": approved,
		})
	}
}

// DecideJudgeHandler approves or declines one queued request.
//
// Approval and weight are ONE action: the handler refuses to approve without a
// valid multiplier, so a judge can never exist at an undefined weight. This is
// the only action in the app that hands one person more power than everyone
// else, so both outcomes are written to the audit log.
func DecideJudgeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload decideJudgePayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Token == "" {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		var status, email, name string
		if err := db.QueryRow(
			"SELECT status, email, name FROM judge_requests WHERE token = $1", payload.Token,
		).Scan(&status, &email, &name); err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Judge decide lookup error: %v\n", err)
			}
			http.Error(w, "unknown_request", http.StatusNotFound)
			return
		}
		if status != "pending" {
			http.Error(w, "already_decided", http.StatusConflict)
			return
		}

		actor := adminEmailFromRequest(db, r)

		if payload.Decision == "decline" {
			if _, err := db.Exec(`
				UPDATE judge_requests
				SET status = 'declined', decided_at = now(), decided_by = $2
				WHERE token = $1
			`, payload.Token, actor); err != nil {
				log.Printf("Judge decline error: %v\n", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			writeAudit(db, actor, "judge_declined", fmt.Sprintf("%s <%s>", name, email))
			log.Printf("Judge request declined for %s by %s\n", email, actor)
			json.NewEncoder(w).Encode(map[string]string{"status": "declined"})
			return
		}

		if payload.Decision != "approve" {
			http.Error(w, "unknown_decision", http.StatusBadRequest)
			return
		}

		// Refuse to approve without a weight. The UI disables the button until
		// one is picked; this is the same rule enforced where it counts.
		if !judgeWeightValid(payload.Weight) {
			http.Error(w, "invalid_weight", http.StatusBadRequest)
			return
		}

		if _, err := db.Exec(
			"UPDATE eligible_voters SET role = 'judge', vote_weight = $2, name = $3 WHERE email = $1",
			email, payload.Weight, name,
		); err != nil {
			log.Printf("Judge promotion error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		token, _, err := issueVoterSession(db, email)
		if err != nil {
			log.Printf("Judge session error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if _, err := db.Exec(`
			UPDATE judge_requests
			SET status = 'approved', vote_weight = $2, session_token = $3,
			    decided_at = now(), decided_by = $4
			WHERE token = $1
		`, payload.Token, payload.Weight, token, actor); err != nil {
			log.Printf("Judge approval error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		writeAudit(db, actor, "judge_approved",
			fmt.Sprintf("%s <%s> at %d×", name, email, payload.Weight))
		log.Printf("Judge approved: %s at %d× by %s\n", email, payload.Weight, actor)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "approved",
			"weight": payload.Weight,
		})
	}
}

// RevokeJudgeHandler demotes a judge back to an ordinary voter and kills their
// session. Ballots they already cast keep the weight stamped on them — revoking
// access must not retroactively rewrite a result that has been announced.
func RevokeJudgeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Email == "" {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(payload.Email))
		actor := adminEmailFromRequest(db, r)

		if _, err := db.Exec(
			"UPDATE eligible_voters SET role = 'student', vote_weight = 1 WHERE email = $1", email,
		); err != nil {
			log.Printf("Judge revoke error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		db.Exec("DELETE FROM voter_sessions WHERE email = $1", email)

		writeAudit(db, actor, "judge_revoked", email)
		log.Printf("Judge access revoked for %s by %s\n", email, actor)
		json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
	}
}

// adminEmailFromRequest names the acting admin for the audit log.
//
// requireAdmin has already authorized the request by the time this runs; this
// only resolves WHO, so a failed lookup degrades to "admin" rather than
// rejecting an action that was already permitted.
func adminEmailFromRequest(db *sql.DB, r *http.Request) string {
	token := bearerToken(r)
	if token == "" {
		return "admin"
	}
	var email string
	if err := db.QueryRow(
		"SELECT email FROM admin_sessions WHERE token = $1", token,
	).Scan(&email); err != nil || email == "" {
		return "admin"
	}
	return email
}

// writeAudit appends one immutable record. Failures are logged, never fatal:
// losing the audit line must not also lose the approval it describes.
func writeAudit(db *sql.DB, actor, action, details string) {
	if _, err := db.Exec(
		"INSERT INTO audit_logs (id, actor, action, details, created_at) VALUES ($1, $2, $3, $4, $5)",
		uuid.New().String(), actor, action, details, time.Now(),
	); err != nil {
		log.Printf("Audit write error (%s): %v\n", action, err)
	}
}
