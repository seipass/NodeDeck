package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadParsesDurationAndToken(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("listen:\n  host: 127.0.0.1\n  port: '9000'\ntoken: secret\nupdate_interval: 2s\nintervals:\n  temperature: 3s\n  docker: 4s\n  services: 6s\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	config, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if config.Listen.Port != "9000" || config.Token != "secret" || config.Update != 2*time.Second {
		t.Fatalf("unexpected config: %+v", config)
	}
	if config.Intervals.Temperature != 3*time.Second || config.Intervals.Docker != 4*time.Second || config.Intervals.Services != 6*time.Second {
		t.Fatalf("unexpected intervals: %+v", config.Intervals)
	}
}

func TestLoadRejectsMissingToken(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("listen:\n  port: '9000'\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("expected missing token error")
	}
}

func TestLoadRejectsRelativeCustomCommand(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	contents := []byte("token: secret\ncustom_metrics:\n  players:\n    command: [get-players]\n    interval: 1s\n    timeout: 1s\n")
	if err := os.WriteFile(path, contents, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("expected absolute command validation error")
	}
}
