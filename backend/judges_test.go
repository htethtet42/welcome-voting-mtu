package main

import "testing"

// judgeWeightValid guards the single input that most directly decides who wins.
// A weight of 100 where 10 was meant would decide the election on its own, and
// nothing else in the app would notice.
func TestJudgeWeightValid(t *testing.T) {
	cases := []struct {
		weight int
		want   bool
		why    string
	}{
		{1, true, "students and judges demoted to parity"},
		{3, true, "lowest judge tier in DESIGN.md"},
		{5, true, "middle judge tier"},
		{10, true, "highest judge tier"},

		{0, false, "zero would silently discard a judge's ballot"},
		{-1, false, "negative would subtract from a candidate's score"},
		{2, false, "not an offered tier; the UI cannot produce it"},
		{7, false, "not an offered tier"},
		{11, false, "just past the ceiling"},
		{100, false, "the typo that would decide the election on its own"},
	}

	for _, c := range cases {
		if got := judgeWeightValid(c.weight); got != c.want {
			t.Errorf("judgeWeightValid(%d) = %v, want %v — %s", c.weight, got, c.want, c.why)
		}
	}
}

// The allowed set must stay in step with the CHECK constraint in
// schema_judges.sql and the segmented control in the admin UI. If this fails,
// one of those three has drifted.
func TestAllowedJudgeWeightsMatchesSchema(t *testing.T) {
	want := []int{1, 3, 5, 10}
	if len(allowedJudgeWeights) != len(want) {
		t.Fatalf("allowedJudgeWeights = %v, want %v", allowedJudgeWeights, want)
	}
	for i, v := range want {
		if allowedJudgeWeights[i] != v {
			t.Fatalf("allowedJudgeWeights = %v, want %v", allowedJudgeWeights, want)
		}
	}
}
