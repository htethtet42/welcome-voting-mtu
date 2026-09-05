package main

import "testing"

// The cases documented in README.md. This function is the student gate and had
// no test until judges arrived; a regression here silently locks out voters or
// silently admits anyone.
func TestValidRollFormat(t *testing.T) {
	valid := []string{
		"III.BE.CEIT-23",
		"I.BE.CEIT-21",
		"II.BE.Che-1",
		"IV.BE.Me-9",
		"iii.be.ceit-23",  // students type these on phone keyboards
		"III.BE-CEIT-23",  // hyphen tolerated where the second dot belongs
		" III.BE.CEIT-23", // leading space from autocomplete
	}
	for _, s := range valid {
		if !validRollFormat(s) {
			t.Errorf("validRollFormat(%q) = false, want true", s)
		}
	}

	invalid := []string{
		"MTU-2026-0001", // wrong scheme entirely
		"III.BE.CEIT",   // no number
		"3.BE.CEIT-23",  // arabic year, not roman
		"III.BE.CEIT-23x",
		"",
		"   ",
		"III.BE.CEIT-",
	}
	for _, s := range invalid {
		if validRollFormat(s) {
			t.Errorf("validRollFormat(%q) = true, want false", s)
		}
	}
}
