package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

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

func CastVoteHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		log.Printf("Incoming Vote Attempt: %+v\n", payload)

		ballotID := uuid.New().String()
		query := "INSERT INTO ballots (id, voter_id, voter_email, voter_name, candidate_id, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"

		_, err := db.Exec(query, ballotID, payload.VoterID, payload.VoterEmail, payload.VoterName, payload.CandidateID, payload.Category, time.Now())

		if err != nil {
			log.Printf("MySQL Insert Error: %v\n", err)

			if len(err.Error()) >= 10 && err.Error()[:10] == "Error 1062" {
				http.Error(w, "already_voted", http.StatusConflict)
				return
			}
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		log.Printf("Vote successfully recorded for %s\n", payload.VoterName)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

func GetAllBallotsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.Query(`SELECT id, voter_id, voter_email, voter_name, candidate_id, category, created_at FROM ballots ORDER BY created_at DESC`)
		if err != nil {
			log.Printf("Ballots query error: %v\n", err)
			http.Error(w, "Failed to query ballots", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var ballots []BallotRecord = []BallotRecord{}
		for rows.Next() {
			var b BallotRecord
			rows.Scan(&b.ID, &b.VoterID, &b.VoterEmail, &b.VoterName, &b.CandidateID, &b.Category, &b.CreatedAt)
			ballots = append(ballots, b)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ballots)
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
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
					name = ?,
					nickname = ?,
					department = ?,
					academic_year = ?,
					category = ?,
					bio = ?,
					talent = ?,
					photo = ?,
					is_active = ?
				WHERE id = ?
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
					SET type = ?
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
				SET status = ?, opens_at = ?, closes_at = ?
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
			db.Exec("INSERT INTO audit_logs (id, actor, action, details, created_at) VALUES (?, ?, ?, ?, ?)",
				logID, l.Actor, l.Action, l.Details, time.Now())
			json.NewEncoder(w).Encode(map[string]string{"message": "Audit recorded"})
			return
		}
	}
}

// --- MAIN FUNCTION ---

func main() {
 dsn := os.Getenv("DATABASE_URL")
 if dsn == "" {
  dsn = "root:root10&Htet@tcp(127.0.0.1:3306)/mtu_voting?parseTime=true"
 }

 db, err := sql.Open("mysql", dsn)
 if err != nil {
  log.Fatalf("Error connecting to database: %v", err)
 }
 defer db.Close()

 if err := db.Ping(); err != nil {
  log.Fatalf("Error verifying database connection: %v", err)
 }
 fmt.Println("Successfully connected to MySQL database!")

 // Create a router
 mux := http.NewServeMux()

 // Register handlers directly without individual CORS wrappers
 mux.HandleFunc("/api/votes", CastVoteHandler(db))
 mux.HandleFunc("/api/ballots", GetAllBallotsHandler(db))
 mux.HandleFunc("/api/candidates", CandidatesHandler(db))
 mux.HandleFunc("/api/election", ElectionHandler(db))
 mux.HandleFunc("/api/audit", AuditHandler(db))

 port := os.Getenv("PORT")
 if port == "" {
  port = "8081"
 }

 fmt.Printf("Server running on port %s...\n", port)

 // FIX: Wrap the entire 'mux' with your 'enableCORS' middleware and pass it into ListenAndServe
 log.Fatal(http.ListenAndServe(":"+port, enableCORS(mux)))
}