// Command hashpw prints a bcrypt hash for an admin password.
//
//	go run ./cmd/hashpw 'my-password'
//
// Paste the output into an INSERT against admin_users. The plaintext password
// is never stored anywhere.
package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/hashpw <password>")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(os.Args[1]), 12)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(hash))
}
