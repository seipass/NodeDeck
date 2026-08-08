#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "run this installer as root" >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
AGENT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
CONFIG_DIR=/etc/streamdeck-monitor
CONFIG_FILE="$CONFIG_DIR/config.yaml"
UNIT_FILE=/etc/systemd/system/streamdeck-monitor.service
BUILD_FILE=$(mktemp)
trap 'rm -f "$BUILD_FILE"' EXIT

command -v go >/dev/null 2>&1 || { echo "go is required to build the agent" >&2; exit 1; }
command -v systemctl >/dev/null 2>&1 || { echo "systemctl is required" >&2; exit 1; }

(cd "$AGENT_DIR" && go build -trimpath -ldflags="-s -w" -o "$BUILD_FILE" ./cmd/agent)
install -Dm755 "$BUILD_FILE" /usr/local/bin/node-deck-agent
install -d -m755 "$CONFIG_DIR"
if [ ! -e "$CONFIG_FILE" ]; then
  install -m600 "$AGENT_DIR/config.example.yaml" "$CONFIG_FILE"
  echo "created $CONFIG_FILE; set token and metric settings before production use"
fi
install -Dm644 "$SCRIPT_DIR/streamdeck-monitor.service" "$UNIT_FILE"
systemctl daemon-reload
systemctl enable --now streamdeck-monitor.service
echo "NodeDeck Linux Agent installed and started"
