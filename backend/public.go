package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

// weightBucket is one (candidate, weight) group straight from the database:
// "candidate king-1 received 4 ballots that each count 5×".
type weightBucket struct {
	CandidateID string
	Weight      int
	Ballots     int
}

// Tally is what the results and livestream screens read.
//
// `counts` is the WEIGHTED score and is authoritative for rank. That matters:
// ElectionContext picks winners by sorting this map and Results sizes its bars
// from it, so if it held raw ballots while the bars showed weighted totals, the
// gold-medal banner could name one candidate while the longest bar belonged to
// another — on the reveal screen, in front of the hall.
//
// The other three maps are display-only, feeding the breakdown line under each
// bar ("268 students · 5 judges +26"). Nothing ranks by them.
type Tally struct {
	Counts      map[string]int `json:"counts"`      // weighted — decides rank
	RawCounts   map[string]int `json:"rawCounts"`   // ballots cast at 1×
	JudgeCounts map[string]int `json:"judgeCounts"` // ballots cast above 1×
	JudgeWeight map[string]int `json:"judgeWeight"` // weight those ballots added
	Total       int            `json:"total"`       // weighted grand total
}

// computeTally folds the grouped rows into the four maps.
//
// Pure on purpose. This is the arithmetic that decides who wins, and a wrong
// tally is not a visible crash — it shows a plausible winner on stage and
// nobody can tell it was wrong. Keeping it free of database and HTTP lets
// tally_test.go prove it in milliseconds.
//
// A ballot counts as a judge ballot when its weight exceeds 1. A judge approved
// at 1× therefore displays among the student ballots, which is correct: their
// vote counts exactly the same as a student's.
func computeTally(buckets []weightBucket) Tally {
	t := Tally{
		Counts:      map[string]int{},
		RawCounts:   map[string]int{},
		JudgeCounts: map[string]int{},
		JudgeWeight: map[string]int{},
	}

	for _, b := range buckets {
		contributed := b.Weight * b.Ballots
		t.Counts[b.CandidateID] += contributed
		t.Total += contributed

		if b.Weight > 1 {
			t.JudgeCounts[b.CandidateID] += b.Ballots
			t.JudgeWeight[b.CandidateID] += contributed
		} else {
			t.RawCounts[b.CandidateID] += b.Ballots
		}
	}

	return t
}

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

		// Grouped by weight as well as candidate, so the aggregation below can
		// separate student ballots from judge ballots. At most four weights
		// exist, so this returns a handful of rows more than the old query and
		// still costs one round trip.
		rows, err := db.Query(`
			SELECT candidate_id, vote_weight, count(*)
			FROM ballots
			GROUP BY candidate_id, vote_weight
		`)
		if err != nil {
			log.Printf("Tally query error: %v\n", err)
			http.Error(w, "Failed to load tally", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		buckets := []weightBucket{}
		for rows.Next() {
			var b weightBucket
			if err := rows.Scan(&b.CandidateID, &b.Weight, &b.Ballots); err != nil {
				log.Printf("Tally scan error: %v\n", err)
				http.Error(w, "Failed to read tally", http.StatusInternalServerError)
				return
			}
			buckets = append(buckets, b)
		}

		if err := rows.Err(); err != nil {
			log.Printf("Tally rows error: %v\n", err)
			http.Error(w, "Failed while reading tally", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(computeTally(buckets))
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
