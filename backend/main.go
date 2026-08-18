package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

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

// enableCORS intercepts ALL incoming HTTP requests (including OPTIONS preflights)
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		origin := r.Header.Get("Origin")

		allowedOrigins := map[string]bool{
			"http://localhost:5175":               true,
			"http://127.0.0.1:5175":               true,
			"https://welcome-voting-mtu-2q1t-a9zh6qi5g-group-ii.vercel.app/":true,
			"https://welcome-voting-mtu-p9la-1u5uaw5pr-group-ii.vercel.app/": true,
			"https://welcome-voting-mtu-p9la.vercel.app/":true,
		}

		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			)
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization",
			)
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
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

		if r.Method == http.MethodGet {
			rows, _ := db.Query("SELECT id, name, nickname, department, academic_year, category, bio, talent, photo, is_active FROM candidates")
			defer rows.Close()

			var candidates []Candidate = []Candidate{}
			for rows.Next() {
				var c Candidate
				rows.Scan(&c.ID, &c.Name, &c.Nickname, &c.Department, &c.Year, &c.Category, &c.Bio, &c.Talent, &c.Photo, &c.IsActive)
				candidates = append(candidates, c)
			}
			json.NewEncoder(w).Encode(candidates)
			return
		}

		if r.Method == http.MethodPost {
			var c Candidate
			json.NewDecoder(r.Body).Decode(&c)
			c.ID = c.Category + "-" + uuid.New().String()[:8]

			db.Exec(`INSERT INTO candidates (id, name, nickname, department, academic_year, category, bio, talent, photo, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				c.ID, c.Name, c.Nickname, c.Department, c.Year, c.Category, c.Bio, c.Talent, c.Photo, c.IsActive)

			json.NewEncoder(w).Encode(c)
			return
		}
	}
}

func ElectionHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodGet {
			var e ElectionStatus
			db.QueryRow("SELECT status, opens_at, closes_at FROM election_settings WHERE id = 1").Scan(&e.Status, &e.OpensAt, &e.ClosesAt)
			json.NewEncoder(w).Encode(e)
			return
		}

		if r.Method == http.MethodPut {
			var e ElectionStatus
			json.NewDecoder(r.Body).Decode(&e)
			db.Exec("UPDATE election_settings SET status = ?, opens_at = ?, closes_at = ? WHERE id = 1", e.Status, e.OpensAt, e.ClosesAt)
			json.NewEncoder(w).Encode(map[string]string{"message": "Election status updated"})
			return
		}
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