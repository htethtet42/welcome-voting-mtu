package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// sessionTTL bounds how long an admin login stays valid. Sized for a single
// event night; admins re-login the next day.
const sessionTTL = 12 * time.Hour

type loginPayload struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token     string    `json:"token"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// newSessionToken returns 32 bytes of cryptographic randomness, hex encoded.
// Opaque tokens (rather than JWTs) keep sessions revocable: deleting the row
// immediately invalidates the token, with no signing key to manage or leak.
func newSessionToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// bearerToken extracts the token from an "Authorization: Bearer <token>" header.
func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

// LoginHandler authenticates an admin and issues a session token.
//
// Credentials are checked against a bcrypt hash in admin_users. Failures are
// deliberately indistinguishable from one another so the response cannot be
// used to enumerate which admin emails exist.
func LoginHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload loginPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(payload.Email))

		var hash, name string
		err := db.QueryRow(
			"SELECT password_hash, name FROM admin_users WHERE email = $1",
			email,
		).Scan(&hash, &name)

		if err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Admin lookup error: %v\n", err)
			}
			// Spend comparable time on a missing user so response latency does
			// not reveal whether the email exists.
			bcrypt.CompareHashAndPassword(
				[]byte("$2a$12$vVGQ9YQ5t5jUx7wWk8pQeOZ2m5rN8xK9lJ7hG6fD5sA4bC3dE2fGa"),
				[]byte(payload.Password),
			)
			http.Error(w, "invalid_credentials", http.StatusUnauthorized)
			return
		}

		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(payload.Password)) != nil {
			log.Printf("Failed admin login attempt for %s\n", email)
			http.Error(w, "invalid_credentials", http.StatusUnauthorized)
			return
		}

		token, err := newSessionToken()
		if err != nil {
			log.Printf("Token generation error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		expiresAt := time.Now().Add(sessionTTL)
		if _, err := db.Exec(
			"INSERT INTO admin_sessions (token, email, expires_at) VALUES ($1, $2, $3)",
			token, email, expiresAt,
		); err != nil {
			log.Printf("Session insert error: %v\n", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Opportunistically clear expired rows so the table cannot grow forever.
		if _, err := db.Exec("DELETE FROM admin_sessions WHERE expires_at < now()"); err != nil {
			log.Printf("Session cleanup error: %v\n", err)
		}

		log.Printf("Admin login: %s\n", email)
		json.NewEncoder(w).Encode(loginResponse{
			Token:     token,
			Email:     email,
			Name:      name,
			ExpiresAt: expiresAt,
		})
	}
}

// LogoutHandler revokes the caller's session token.
func LogoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if token := bearerToken(r); token != "" {
			if _, err := db.Exec("DELETE FROM admin_sessions WHERE token = $1", token); err != nil {
				log.Printf("Logout error: %v\n", err)
			}
		}

		// Always report success: logging out an already-invalid token is not an
		// error from the caller's perspective.
		json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
	}
}

// requireAdmin wraps a handler so only requests carrying a valid, unexpired
// admin session token reach it.
//
// This is the actual authorization boundary. The frontend's isAdmin check is a
// UI convenience only and cannot be relied upon: anyone can call these
// endpoints directly with curl.
func requireAdmin(db *sql.DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Preflight is handled by the CORS middleware before this point, but
		// guard anyway so an OPTIONS request never 401s.
		if r.Method == http.MethodOptions {
			next(w, r)
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
			"SELECT email, expires_at FROM admin_sessions WHERE token = $1",
			token,
		).Scan(&email, &expiresAt)

		if err != nil {
			if err != sql.ErrNoRows {
				log.Printf("Session lookup error: %v\n", err)
			}
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if time.Now().After(expiresAt) {
			db.Exec("DELETE FROM admin_sessions WHERE token = $1", token)
			http.Error(w, "session_expired", http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}

// adminForMethods applies requireAdmin only to the listed HTTP methods,
// leaving the rest public. Used where one path mixes public reads with
// privileged writes (e.g. GET /api/candidates is public, POST/PUT are not).
func adminForMethods(db *sql.DB, next http.HandlerFunc, methods ...string) http.HandlerFunc {
	guarded := make(map[string]bool, len(methods))
	for _, m := range methods {
		guarded[m] = true
	}
	protected := requireAdmin(db, next)

	return func(w http.ResponseWriter, r *http.Request) {
		if guarded[r.Method] {
			protected(w, r)
			return
		}
		next(w, r)
	}
}
