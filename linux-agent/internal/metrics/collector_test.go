package metrics

import (
	"context"
	"testing"
)

func TestRateCalculatesCounterDeltaPerSecond(t *testing.T) {
	if got := rate(1_500, 500, 2, true); got != 500 {
		t.Fatalf("rate = %v, want 500", got)
	}
}

func TestRateRejectsCounterReset(t *testing.T) {
	if got := rate(100, 500, 1, true); got != 0 {
		t.Fatalf("rate = %v, want 0", got)
	}
}

func TestCollectorCollectsOptionalMetrics(t *testing.T) {
	collector := NewCollector()
	snapshot, err := collector.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Timestamp.IsZero() {
		t.Fatal("missing timestamp")
	}
}
