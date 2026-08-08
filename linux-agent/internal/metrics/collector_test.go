package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hasilan/node-deck/linux-agent/internal/config"
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

func TestCollectDockerReturnsEmptyWhenDockerIsUnavailable(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	if values := collectDocker(context.Background(), true); len(values) != 0 {
		t.Fatalf("docker values = %+v, want empty", values)
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

func TestParseMemoryPairConvertsDockerUnits(t *testing.T) {
	used, limit := parseMemoryPair("12.5MiB / 1GiB")
	if used != 13_107_200 || limit != 1_073_741_824 {
		t.Fatalf("got %d/%d", used, limit)
	}
}

func TestParsePercentRemovesSuffix(t *testing.T) {
	if got := parsePercent("4.25%"); got != 4.25 {
		t.Fatalf("got %v", got)
	}
}

func TestUptimeSecondsUsesWholeElapsedSeconds(t *testing.T) {
	started := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	now := started.Add(65*time.Second + 900*time.Millisecond)
	if got := uptimeSeconds(started, now); got != 65 {
		t.Fatalf("uptime = %d, want 65", got)
	}
}

func TestContainerJSONPreservesZeroResourceValues(t *testing.T) {
	payload, err := json.Marshal(Container{ID: "id", Name: "web", State: "running"})
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{`"uptimeSeconds":0`, `"cpuPercent":0`, `"memoryUsageBytes":0`, `"memoryLimitBytes":0`} {
		if !strings.Contains(string(payload), field) {
			t.Fatalf("payload %s is missing %s", payload, field)
		}
	}
}

func TestRunCustomExecutesArgvAndCapturesOutput(t *testing.T) {
	definition := helperDefinition(t, 2*time.Second, "success")
	result := runCustom(context.Background(), "players", definition)
	if result.Status != "ok" || !strings.HasPrefix(result.Value, "42") || result.ExitCode != 0 || result.LastSuccessAt == nil {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestRunCustomReportsTimeout(t *testing.T) {
	result := runCustom(context.Background(), "players", helperDefinition(t, 20*time.Millisecond, "timeout"))
	if result.Status != "timeout" {
		t.Fatalf("status = %q", result.Status)
	}
}

func TestRunCustomReportsExitError(t *testing.T) {
	result := runCustom(context.Background(), "players", helperDefinition(t, 2*time.Second, "error"))
	if result.Status != "error" || result.ExitCode != 7 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestRunCustomReportsOutputLimit(t *testing.T) {
	definition := helperDefinition(t, 2*time.Second, "large")
	definition.MaxOutputBytes = 4
	result := runCustom(context.Background(), "players", definition)
	if result.Status != "output_limit" || len(result.Stdout) != 4 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func helperDefinition(t *testing.T, timeout time.Duration, mode string) config.CustomMetric {
	t.Helper()
	t.Setenv("NODEDECK_CUSTOM_HELPER", "1")
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	return config.CustomMetric{Command: []string{filepath.Clean(executable), "-test.run=TestCustomMetricHelperProcess", "--", mode}, Interval: time.Second, Timeout: timeout, MaxOutputBytes: 64}
}

func TestCustomMetricHelperProcess(t *testing.T) {
	if os.Getenv("NODEDECK_CUSTOM_HELPER") != "1" {
		return
	}
	args := os.Args
	mode := args[len(args)-1]
	switch mode {
	case "success":
		fmt.Fprintln(os.Stdout, "42")
	case "timeout":
		time.Sleep(500 * time.Millisecond)
	case "error":
		os.Exit(7)
	case "large":
		fmt.Fprint(os.Stdout, "1234567890")
	}
}
