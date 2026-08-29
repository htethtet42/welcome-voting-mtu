package main

import (
	"os"
	"regexp"
	"strings"
)

// rollNumberPattern matches MTU student roll numbers, e.g.
//
//	III.BE-CEIT-23
//	I.BE-CEIT-21
//	II.BE-Che-1
//	IV.BE-Me-9
//
// Shape: <year>.<degree>-<department>-<number>
//   - year:       Roman numerals (I, II, III, IV, V, VI, …)
//   - degree:     1–6 letters (BE, BTech, ME, …)
//   - department: 1–15 letters (CEIT, Che, Me, Civil, EP, Mechatronic, …)
//   - number:     1–5 digits
//
// Deliberately permissive: this checks SHAPE ONLY, so any well-formed roll
// number is accepted. There is no list of valid departments or numbers to
// keep in sync, and no student is turned away for an unusual department code.
//
// Case-insensitive, since students type these on phone keyboards.
var rollNumberPattern = regexp.MustCompile(
	`^(?i)[IVX]{1,5}\.[A-Za-z]{1,6}-[A-Za-z]{1,15}-\d{1,5}$`,
)

// validRollFormat reports whether s looks like a roll number.
func validRollFormat(s string) bool {
	return rollNumberPattern.MatchString(strings.TrimSpace(s))
}

// eligibilityMode selects how voters are admitted.
//
//	"format" (default) — any verified Google account may vote, provided the
//	   roll number they enter is well-formed. Suitable for a demo, where no
//	   official student list exists yet.
//
//	"roll" — the email must appear in eligible_voters AND the roll number must
//	   match that row exactly. This is the real-election mode: import the
//	   registrar's list (see import_roll.sql) and set VOTER_ELIGIBILITY=roll.
//
// NOTE: in "format" mode the roll number is NOT a second factor. It is a
// well-formedness check only — anyone can invent a conforming value. Voter
// identity rests entirely on the Google account.
func eligibilityMode() string {
	if strings.ToLower(strings.TrimSpace(os.Getenv("VOTER_ELIGIBILITY"))) == "roll" {
		return "roll"
	}
	return "format"
}
