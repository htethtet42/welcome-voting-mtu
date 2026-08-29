package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

// TallyHandler returns aggregate vote counts per candidate.
//
// This is the public replacement for GET /api/ballots, which is now
// admin-only. The old endpoint shipped every ballot row — including each
// voter's name and email — to anyone who asked, and the results and
// livestream pages are displayed publicly. Aggregates carry no PII.
func TallyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.Query(`
			SELECT candidate_id, count(*)
			FROM ballots
			GROUP BY candidate_id
		`)
		if err != nil {
			log.Printf("Tally query error: %v\n", err)
			http.Error(w, "Failed to load tally", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		counts := map[string]int{}
		total := 0

		for rows.Next() {
			var candidateID string
			var n int
			if err := rows.Scan(&candidateID, &n); err != nil {
				log.Printf("Tally scan error: %v\n", err)
				http.Error(w, "Failed to read tally", http.StatusInternalServerError)
				return
			}
			counts[candidateID] = n
			total += n
		}

		if err := rows.Err(); err != nil {
			log.Printf("Tally rows error: %v\n", err)
			http.Error(w, "Failed while reading tally", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"counts": counts,
			"total":  total,
		})
	}
}

// MyBallotsHandler returns which categories the AUTHENTICATED voter has already
// voted in, so the ballot UI can mark them as done.
//
// The voter is identified by their session, not by a query parameter: an
// earlier version read ?voterId= straight from the caller, which let anyone
// look up anyone else's picks. Only (category, candidate_id) is returned —
// never names or emails.
func MyBallotsHandler(db *sql.DB) http.HandlerFunc {
	return requireVoter(db, func(w http.ResponseWriter, r *http.Request, voter Voter) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.Query(
			"SELECT category, candidate_id FROM ballots WHERE voter_id = $1",
			"email:"+voter.Email,
		)
		if err != nil {
			log.Printf("My-ballots query error: %v\n", err)
			http.Error(w, "Failed to load ballots", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type entry struct {
			Category    string `json:"category"`
			CandidateID string `json:"candidateId"`
		}

		entries := []entry{}
		for rows.Next() {
			var e entry
			if err := rows.Scan(&e.Category, &e.CandidateID); err != nil {
				log.Printf("My-ballots scan error: %v\n", err)
				http.Error(w, "Failed to read ballots", http.StatusInternalServerError)
				return
			}
			entries = append(entries, e)
		}

		if err := rows.Err(); err != nil {
			log.Printf("My-ballots rows error: %v\n", err)
			http.Error(w, "Failed while reading ballots", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(entries)
	})
}
