package main

import "testing"

// The weighted tally is the arithmetic that decides who wins. A wrong tally is
// not a visible crash: it shows a plausible winner on stage and nobody in the
// room can tell it was wrong. These tests are the only thing that catches that.

func TestComputeTally_StudentsOnly(t *testing.T) {
	got := computeTally([]weightBucket{
		{CandidateID: "king-1", Weight: 1, Ballots: 284},
		{CandidateID: "king-2", Weight: 1, Ballots: 191},
	})

	// With no judges, weighted and raw must agree exactly — otherwise every
	// election held before judges existed would change its own result.
	if got.Counts["king-1"] != 284 {
		t.Errorf("weighted king-1 = %d, want 284", got.Counts["king-1"])
	}
	if got.RawCounts["king-1"] != 284 {
		t.Errorf("raw king-1 = %d, want 284", got.RawCounts["king-1"])
	}
	if got.JudgeCounts["king-1"] != 0 || got.JudgeWeight["king-1"] != 0 {
		t.Errorf("judge maps should be empty, got counts=%d weight=%d",
			got.JudgeCounts["king-1"], got.JudgeWeight["king-1"])
	}
	if got.Total != 475 {
		t.Errorf("total = %d, want 475", got.Total)
	}
}

func TestComputeTally_JudgesOnly(t *testing.T) {
	// One 10×, two 5×, two 3× = 10 + 10 + 6 = 26 from 5 ballots.
	got := computeTally([]weightBucket{
		{CandidateID: "queen-1", Weight: 10, Ballots: 1},
		{CandidateID: "queen-1", Weight: 5, Ballots: 2},
		{CandidateID: "queen-1", Weight: 3, Ballots: 2},
	})

	if got.Counts["queen-1"] != 26 {
		t.Errorf("weighted = %d, want 26", got.Counts["queen-1"])
	}
	if got.JudgeCounts["queen-1"] != 5 {
		t.Errorf("judge ballots = %d, want 5", got.JudgeCounts["queen-1"])
	}
	if got.JudgeWeight["queen-1"] != 26 {
		t.Errorf("judge weight = %d, want 26", got.JudgeWeight["queen-1"])
	}
	if got.RawCounts["queen-1"] != 0 {
		t.Errorf("raw should be 0 with no student ballots, got %d", got.RawCounts["queen-1"])
	}
}

// TestComputeTally_JudgesFlipTheResult is the scenario the whole feature has to
// survive: the candidate with FEWER student votes wins on judge weight. If this
// arithmetic is wrong, the reveal screen crowns the wrong person and the room
// has no way to know.
func TestComputeTally_JudgesFlipTheResult(t *testing.T) {
	got := computeTally([]weightBucket{
		// Aung Kyaw Moe: 268 students + 5 judges worth 26 = 294
		{CandidateID: "aung", Weight: 1, Ballots: 268},
		{CandidateID: "aung", Weight: 10, Ballots: 1},
		{CandidateID: "aung", Weight: 5, Ballots: 2},
		{CandidateID: "aung", Weight: 3, Ballots: 2},
		// Zaw Min Htet: 284 students + 2 judges worth 8 = 292
		{CandidateID: "zaw", Weight: 1, Ballots: 284},
		{CandidateID: "zaw", Weight: 5, Ballots: 1},
		{CandidateID: "zaw", Weight: 3, Ballots: 1},
	})

	if got.Counts["aung"] != 294 {
		t.Errorf("aung weighted = %d, want 294", got.Counts["aung"])
	}
	if got.Counts["zaw"] != 292 {
		t.Errorf("zaw weighted = %d, want 292", got.Counts["zaw"])
	}
	if got.Counts["aung"] <= got.Counts["zaw"] {
		t.Fatalf("aung (%d) must outrank zaw (%d) on judge weight",
			got.Counts["aung"], got.Counts["zaw"])
	}
	// And the loser must still have MORE student ballots, or the fixture no
	// longer tests the case it claims to.
	if got.RawCounts["zaw"] <= got.RawCounts["aung"] {
		t.Fatalf("fixture broken: zaw raw (%d) should exceed aung raw (%d)",
			got.RawCounts["zaw"], got.RawCounts["aung"])
	}
	// The breakdown line under each bar reads from these.
	if got.JudgeCounts["aung"] != 5 || got.JudgeWeight["aung"] != 26 {
		t.Errorf("aung breakdown = %d judges/+%d, want 5/+26",
			got.JudgeCounts["aung"], got.JudgeWeight["aung"])
	}
	if got.JudgeCounts["zaw"] != 2 || got.JudgeWeight["zaw"] != 8 {
		t.Errorf("zaw breakdown = %d judges/+%d, want 2/+8",
			got.JudgeCounts["zaw"], got.JudgeWeight["zaw"])
	}
}

// A judge approved at 1× counts exactly as much as a student, so their ballot
// belongs in the student column. Anything else would inflate the visible judge
// influence without changing the score.
func TestComputeTally_WeightOneCountsAsStudent(t *testing.T) {
	got := computeTally([]weightBucket{
		{CandidateID: "smart-1", Weight: 1, Ballots: 3},
	})

	if got.JudgeCounts["smart-1"] != 0 {
		t.Errorf("weight-1 ballots must not count as judge ballots, got %d",
			got.JudgeCounts["smart-1"])
	}
	if got.RawCounts["smart-1"] != 3 {
		t.Errorf("raw = %d, want 3", got.RawCounts["smart-1"])
	}
}

// Before voting opens, the results page calls this with nothing. It must return
// usable empty maps, not nil ones that panic on read.
func TestComputeTally_NoBallots(t *testing.T) {
	got := computeTally(nil)

	if got.Total != 0 {
		t.Errorf("total = %d, want 0", got.Total)
	}
	if got.Counts == nil || got.RawCounts == nil || got.JudgeCounts == nil || got.JudgeWeight == nil {
		t.Fatal("all maps must be non-nil so the client can index them safely")
	}
	if len(got.Counts) != 0 {
		t.Errorf("counts should be empty, got %v", got.Counts)
	}
}
