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
	collector := NewCollector(nil, false, nil)
	snapshot, err := collector.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Timestamp.IsZero() {
		t.Fatal("missing timestamp")
	}
}

func TestCappedBufferLimitsOutputWithoutFailingProcess(t *testing.T) {
	buffer := &cappedBuffer{limit: 4}
	if _, err := buffer.Write([]byte("abcdef")); err != nil {
		t.Fatal(err)
	}
	if buffer.String() != "abcd" || !buffer.exceeded {
		t.Fatalf("unexpected buffer: %q exceeded=%v", buffer.String(), buffer.exceeded)
	}
}
