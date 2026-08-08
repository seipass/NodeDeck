package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadParsesDurationAndToken(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("listen:\n  host: 127.0.0.1\n  port: '9000'\ntoken: secret\nupdate_interval: 2s\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	config, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if config.Listen.Port != "9000" || config.Token != "secret" || config.Update != 2*time.Second {
		t.Fatalf("unexpected config: %+v", config)
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
