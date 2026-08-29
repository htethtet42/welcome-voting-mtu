package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
)

// uniqueViolation reports whether err is a Postgres unique-constraint
// violation (SQLSTATE 23505).
//
// This is how the one-vote-per-category rule is detected: there is no
// application-level duplicate check, so the ballots.one_vote_per_category
// constraint firing here is the only thing preventing double voting.
func uniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// --- STRUCTS ---

type VotePayload struct {
	VoterID     string `json:"voterId"`
	VoterEmail  string `json:"voterEmail"`
	VoterName   string `json:"voterName"`
	CandidateID string `json:"candidateId"`
	Category    string `json:"category"`
}

type BallotRecord struct {
	ID          string    `json:"id"`
	VoterID     string    `json:"voterId"`
	VoterEmail  string    `json:"voterEmail"`
	VoterName   string    `json:"voterName"`
	CandidateID string    `json:"candidateId"`
	Category    string    `json:"category"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Candidate struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Nickname   string `json:"nickname"`
	Department string `json:"department"`
	Year       string `json:"year"`
	Category   string `json:"category"`
	Bio        string `json:"bio"`
	Talent     string `json:"talent"`
	Photo      string `json:"photo"`
	IsActive   bool   `json:"isActive"`
}

type ElectionStatus struct {
	Type     string     `json:"type"`
	Status   string     `json:"status"`
	OpensAt  *time.Time `json:"opensAt,omitempty"`
	ClosesAt *time.Time `json:"closesAt,omitempty"`
}

type AuditLog struct {
	ID        string    `json:"id"`
	Actor     string    `json:"actor"`
	Action    string    `json:"action"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"timestamp"`
}

// --- GLOBAL CORS MIDDLEWARE ---

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Check exact matches or allowed domain suffixes (.vercel.app)
		if isAllowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			)
			// Added 'Bypass-Tunnel-Reminder' to allowed headers
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization, Bypass-Tunnel-Reminder , Cache-Control",
			)
		}

		// Handle OPTIONS preflight requests immediately
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}

	// Static Allowed Origins
	allowed := map[string]bool{
		"http://localhost:5173": true, // Added default Vite port
		"http://localhost:5174": true,
		"http://localhost:5175": true,
		"http://127.0.0.1:5175": true,
	}

	if allowed[origin] {
		return true
	}

	// Dynamic Vercel deployment matching (*.vercel.app)
	if strings.HasSuffix(origin, ".vercel.app") {
		return true
	}

	return false
}

// --- HANDLERS ---

// CastVoteHandler records a ballot for the AUTHENTICATED voter.
//
// Voter identity is taken from the session (the `voter` argument), not from the
// request body. Any voterId/voterEmail/voterName the client sends is ignored:
// trusting those let a caller vote as anyone, which defeated
// one-vote-per-category entirely.
func CastVoteHandler(db *sql.DB) http.HandlerFunc {
	return requireVoter(db, func(w http.ResponseWriter, r *http.Request, voter Voter) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload VotePayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			log.Printf("Payload Decode Error: %v\n", err)
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if payload.CandidateID == "" || payload.Category == "" {
			http.Error(w, "candidateId and category are required", http.StatusBadRequest)
			return
		}

		// Voting must be open. Checked server-side because the frontend's
		// disabled buttons are only a UI affordance.
		var status string
		if err := db.QueryRow("SELECT status FROM election_settings WHERE id = 1").Scan(&status); err != nil {
			log.Printf("Election status lookup error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if status != "open" {
			http.Error(w, "closed", http.StatusForbidden)
			return
		}

		// The candidate must exist, be active, and belong to the category the
		// vote claims — otherwise a crafted request could move a vote between
		// categories and dodge the per-category unique constraint.
		var candidateCategory string
		var isActive bool
		if err := db.QueryRow(
			"SELECT category, is_active FROM candidates WHERE id = $1", payload.CandidateID,
		).Scan(&candidateCategory, &isActive); err != nil {
			http.Error(w, "unknown_candidate", http.StatusBadRequest)
			return
		}
		if !isActive || candidateCategory != payload.Category {
			http.Error(w, "invalid_candidate_for_category", http.StatusBadRequest)
			return
		}

		voterID := "email:" + voter.Email
		log.Printf("Vote attempt by %s for %s (%s)\n", voter.Email, payload.CandidateID, payload.Category)

		ballotID := uuid.New().String()
		query := "INSERT INTO ballots (id, voter_id, voter_email, voter_name, candidate_id, category, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)"

		_, err := db.Exec(query, ballotID, voterID, voter.Email, voter.Name, payload.CandidateID, payload.Category, time.Now())

		if err != nil {
			log.Printf("Postgres Insert Error: %v\n", err)

			if uniqueViolation(err) {
				http.Error(w, "already_voted", http.StatusConflict)
				return
			}
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		log.Printf("Vote successfully recorded for %s\n", voter.Email)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	})
}

func GetAllBallotsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		w.Header().Set("Content-Type", "application/json")
		
		// GET - Get all ballots
		if r.Method == http.MethodGet {

			rows, err := db.Query(`
				SELECT
					id,
					voter_id,
					voter_email,
					voter_name,
					candidate_id,
					category,
					created_at
				FROM ballots
				ORDER BY created_at DESC
			`)

			if err != nil {
				log.Printf("Ballots query error: %v\n", err)
				http.Error(
					w,
					"Failed to query ballots",
					http.StatusInternalServerError,
				)
				return
			}

			defer rows.Close()

			var ballots []BallotRecord = []BallotRecord{}

			for rows.Next() {
				var b BallotRecord

				err := rows.Scan(
					&b.ID,
					&b.VoterID,
					&b.VoterEmail,
					&b.VoterName,
					&b.CandidateID,
					&b.Category,
					&b.CreatedAt,
				)

				if err != nil {
					log.Printf(
						"Ballot scan error: %v\n",
						err,
					)
					http.Error(
						w,
						"Failed to read ballot data",
						http.StatusInternalServerError,
					)
					return
				}

				ballots = append(ballots, b)
			}

			if err := rows.Err(); err != nil {
				log.Printf(
					"Ballot rows error: %v\n",
					err,
				)
				http.Error(
					w,
					"Failed while reading ballots",
					http.StatusInternalServerError,
				)
				return
			}

			json.NewEncoder(w).Encode(ballots)
			return
		}
		
		// DELETE - Reset ALL votes
		if r.Method == http.MethodDelete {

			result, err := db.Exec(`
				DELETE FROM ballots
			`)

			if err != nil {
				log.Printf(
					"Ballot reset error: %v\n",
					err,
				)

				http.Error(
					w,
					"Failed to reset votes",
					http.StatusInternalServerError,
				)
				return
			}

			rowsAffected, err := result.RowsAffected()

			if err != nil {
				log.Printf(
					"Rows affected error: %v\n",
					err,
				)
			}

			log.Printf(
				"⚠️ ALL VOTES RESET. Deleted %d ballots.\n",
				rowsAffected,
			)

			w.WriteHeader(http.StatusOK)

			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "success",
				"message": "All votes have been reset",
				"deleted": rowsAffected,
			})

			return
		}
		http.Error(
			w,
			"Method not allowed",
			http.StatusMethodNotAllowed,
		)
	}
}

func CandidatesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// =====================================================
		// GET - Get all candidates
		// =====================================================
		if r.Method == http.MethodGet {
			rows, err := db.Query(`
				SELECT
					id,
					name,
					nickname,
					department,
					academic_year,
					category,
					bio,
					talent,
					photo,
					is_active
				FROM candidates
				ORDER BY id
			`)

			if err != nil {
				log.Printf("Candidate SELECT error: %v\n", err)
				http.Error(
					w,
					"Failed to load candidates",
					http.StatusInternalServerError,
				)
				return
			}

			defer rows.Close()

			candidates := []Candidate{}

			for rows.Next() {
				var c Candidate

				err := rows.Scan(
					&c.ID,
					&c.Name,
					&c.Nickname,
					&c.Department,
					&c.Year,
					&c.Category,
					&c.Bio,
					&c.Talent,
					&c.Photo,
					&c.IsActive,
				)

				if err != nil {
					log.Printf("Candidate scan error: %v\n", err)
					http.Error(
						w,
						"Failed to read candidate data",
						http.StatusInternalServerError,
					)
					return
				}

				candidates = append(candidates, c)
			}

			if err := rows.Err(); err != nil {
				log.Printf("Candidate rows error: %v\n", err)
				http.Error(
					w,
					"Failed while reading candidates",
					http.StatusInternalServerError,
				)
				return
			}

			json.NewEncoder(w).Encode(candidates)
			return
		}

		// =====================================================
		// POST - Add candidate
		// =====================================================
		if r.Method == http.MethodPost {
			var c Candidate

			if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
				http.Error(
					w,
					"Invalid candidate data",
					http.StatusBadRequest,
				)
				return
			}

			// Generate ID if frontend didn't provide one.
			if c.ID == "" {
				c.ID = fmt.Sprintf(
					"candidate-%d",
					time.Now().UnixNano(),
				)
			}

			_, err := db.Exec(`
				INSERT INTO candidates (
					id,
					name,
					nickname,
					department,
					academic_year,
					category,
					bio,
					talent,
					photo,
					is_active
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`,
				c.ID,
				c.Name,
				c.Nickname,
				c.Department,
				c.Year,
				c.Category,
				c.Bio,
				c.Talent,
				c.Photo,
				c.IsActive,
			)

			if err != nil {
				log.Printf("Candidate INSERT error: %v\n", err)

				http.Error(
					w,
					"Failed to add candidate",
					http.StatusInternalServerError,
				)
				return
			}

			log.Printf(
				"Candidate added: %s (%s), active=%t\n",
				c.Name,
				c.Category,
				c.IsActive,
			)

			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(c)
			return
		}

		// =====================================================
		// PUT - Edit / Activate / Deactivate candidate
		// =====================================================
		if r.Method == http.MethodPut {
			var c Candidate

			if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
				http.Error(
					w,
					"Invalid candidate data",
					http.StatusBadRequest,
				)
				return
			}

			if c.ID == "" {
				http.Error(
					w,
					"Candidate ID is required",
					http.StatusBadRequest,
				)
				return
			}

			result, err := db.Exec(`
				UPDATE candidates
				SET
					name = $1,
					nickname = $2,
					department = $3,
					academic_year = $4,
					category = $5,
					bio = $6,
					talent = $7,
					photo = $8,
					is_active = $9
				WHERE id = $10
			`,
				c.Name,
				c.Nickname,
				c.Department,
				c.Year,
				c.Category,
				c.Bio,
				c.Talent,
				c.Photo,
				c.IsActive,
				c.ID,
			)

			if err != nil {
				log.Printf(
					"Candidate UPDATE error: %v\n",
					err,
				)

				http.Error(
					w,
					"Failed to update candidate",
					http.StatusInternalServerError,
				)
				return
			}

			rowsAffected, err := result.RowsAffected()

			if err != nil {
				log.Printf(
					"Rows affected error: %v\n",
					err,
				)

				http.Error(
					w,
					"Failed to verify candidate update",
					http.StatusInternalServerError,
				)
				return
			}

			if rowsAffected == 0 {
				http.Error(
					w,
					"Candidate not found",
					http.StatusNotFound,
				)
				return
			}

			log.Printf(
				"Candidate updated: %s (%s), active=%t\n",
				c.Name,
				c.Category,
				c.IsActive,
			)

			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(c)
			return
		}

		// =====================================================
		// Unsupported method
		// =====================================================
		http.Error(
			w,
			"Method not allowed",
			http.StatusMethodNotAllowed,
		)
	}
}

func ElectionHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// GET /api/election
		if r.Method == http.MethodGet {
			var e ElectionStatus

			err := db.QueryRow(`
				SELECT type, status, opens_at, closes_at
				FROM election_settings
				WHERE id = 1
			`).Scan(
				&e.Type,
				&e.Status,
				&e.OpensAt,
				&e.ClosesAt,
			)

			if err != nil {
				log.Printf("Election GET error: %v\n", err)
				http.Error(w, "Failed to get election settings", http.StatusInternalServerError)
				return
			}

			json.NewEncoder(w).Encode(e)
			return
		}

		// PUT /api/election
		if r.Method == http.MethodPut {
			var e ElectionStatus

			if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}

			// Admin changed Election Type
			if e.Type != "" {
				_, err := db.Exec(`
					UPDATE election_settings
					SET type = $1
					WHERE id = 1
				`, e.Type)

				if err != nil {
					log.Printf("Election type update error: %v\n", err)
					http.Error(w, "Failed to update election type", http.StatusInternalServerError)
					return
				}

				log.Printf("Election type changed to: %s\n", e.Type)

				json.NewEncoder(w).Encode(map[string]interface{}{
					"message": "Election type updated",
					"type":    e.Type,
				})
				return
			}

			// Admin changed Election Status
			_, err := db.Exec(`
				UPDATE election_settings
				SET status = $1, opens_at = $2, closes_at = $3
				WHERE id = 1
			`, e.Status, e.OpensAt, e.ClosesAt)

			if err != nil {
				log.Printf("Election status update error: %v\n", err)
				http.Error(w, "Failed to update election status", http.StatusInternalServerError)
				return
			}

			log.Printf("Election status changed to: %s\n", e.Status)

			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "Election status updated",
				"type":    e.Type,
				"status":  e.Status,
			})
			return
		}

		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func AuditHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodGet {
			rows, _ := db.Query("SELECT id, actor, action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200")
			defer rows.Close()

			var logs []AuditLog = []AuditLog{}
			for rows.Next() {
				var l AuditLog
				rows.Scan(&l.ID, &l.Actor, &l.Action, &l.Details, &l.CreatedAt)
				logs = append(logs, l)
			}
			json.NewEncoder(w).Encode(logs)
			return
		}

		if r.Method == http.MethodPost {
			var l AuditLog
			json.NewDecoder(r.Body).Decode(&l)
			logID := uuid.New().String()
			db.Exec("INSERT INTO audit_logs (id, actor, action, details, created_at) VALUES ($1, $2, $3, $4, $5)",
				logID, l.Actor, l.Action, l.Details, time.Now())
			json.NewEncoder(w).Encode(map[string]string{"message": "Audit recorded"})
			return
		}
	}
}

// --- MAIN FUNCTION ---

func main() {
 // Supabase connection string. Use the CONNECTION POOLER (port 6543,
 // transaction mode), not the direct connection on 5432 — Supabase caps
 // direct connections and a burst of voters will exhaust them.
 //
 //   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 //
 // No credentials are hardcoded: the server refuses to start without
 // DATABASE_URL rather than silently falling back to a dev database.
 dsn := os.Getenv("DATABASE_URL")
 if dsn == "" {
  log.Fatal("DATABASE_URL is not set. Export your Supabase pooler connection string (port 6543).")
 }

 // Supabase's transaction pooler multiplexes client connections across shared
 // backends, so pgx's default prepared-statement cache breaks: a statement
 // prepared on one physical connection is not visible on the next, and reusing
 // a cached name raises "prepared statement already exists" (SQLSTATE 42P05).
 // Simple protocol sends each query unprepared, which is what the pooler needs.
 config, err := pgx.ParseConfig(dsn)
 if err != nil {
  log.Fatalf("Invalid DATABASE_URL: %v", err)
 }
 config.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

 db := stdlib.OpenDB(*config)
 defer db.Close()

 // Bound the pool explicitly. On serverless (Vercel Fluid Compute) MANY
 // instances run concurrently and each keeps its own pool, so a per-instance
 // limit of 10 would multiply out and exhaust Supabase's pooler. Keep it small
 // and let the pooler do the multiplexing.
 //
 // Override with DB_MAX_CONNS when running as a single long-lived process,
 // where a larger pool is both safe and faster.
 maxConns := 3
 if v := os.Getenv("DB_MAX_CONNS"); v != "" {
  if n, err := strconv.Atoi(v); err == nil && n > 0 {
   maxConns = n
  }
 }
 db.SetMaxOpenConns(maxConns)
 db.SetMaxIdleConns(1)
 // Short lifetime so idle instances release connections back to the pooler.
 db.SetConnMaxLifetime(1 * time.Minute)
 db.SetConnMaxIdleTime(30 * time.Second)

 if err := db.Ping(); err != nil {
  log.Fatalf("Error verifying database connection: %v", err)
 }
 fmt.Println("Successfully connected to Supabase Postgres!")

 // Create a router
 mux := http.NewServeMux()

 // --- Public endpoints ---
 mux.HandleFunc("/api/admin/login", LoginHandler(db))
 mux.HandleFunc("/api/admin/logout", LogoutHandler(db))
 mux.HandleFunc("/api/tally", TallyHandler(db))

 // --- Voter authentication (Google OAuth + student roll number) ---
 mux.HandleFunc("/api/auth/google", GoogleLoginHandler(db))
 mux.HandleFunc("/api/auth/verify-roll", VerifyRollHandler(db))
 mux.HandleFunc("/api/auth/logout", VoterLogoutHandler(db))

 // --- Voter-only endpoints (identity comes from the session, not the body) ---
 mux.HandleFunc("/api/votes", CastVoteHandler(db))
 mux.HandleFunc("/api/my-ballots", MyBallotsHandler(db))

 // --- Admin-only endpoints ---
 // GET leaks voter PII and DELETE wipes the election, so both need auth.
 mux.HandleFunc("/api/ballots", requireAdmin(db, GetAllBallotsHandler(db)))
 mux.HandleFunc("/api/audit", requireAdmin(db, AuditHandler(db)))

 // --- Mixed: public reads, admin writes ---
 mux.HandleFunc("/api/candidates", adminForMethods(db, CandidatesHandler(db), "POST", "PUT"))
 mux.HandleFunc("/api/election", adminForMethods(db, ElectionHandler(db), "PUT"))

 port := os.Getenv("PORT")
 if port == "" {
  port = "8081"
 }

 fmt.Printf("Server running on port %s...\n", port)

 // FIX: Wrap the entire 'mux' with your 'enableCORS' middleware and pass it into ListenAndServe
 log.Fatal(http.ListenAndServe(":"+port, enableCORS(mux)))
}