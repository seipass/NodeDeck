# NodeDeck

NodeDeck displays Linux host metrics on an Elgato Stream Deck.

## Features

- Go Linux Agent distributed as a single binary.
- Token-authenticated JSON WebSocket endpoint at `/ws`.
- One shared Windows WebSocket connection per Linux host.
- CPU, per-core CPU, 1/5/15-minute load average, memory, temperature, disk, network,
  systemd service, Docker, and allowlisted Custom Metrics.
- Cached slow collectors: temperature and Docker at 2 seconds, systemd at 5
  seconds, and Custom Metrics at their configured intervals.
- Dynamic SVG rendering with value, unit, gauge, warning/critical thresholds,
  and explicit connecting/offline/authentication-error states.
- The wire contract is documented in [docs/protocol.md](docs/protocol.md).
- Exponential reconnect backoff, heartbeat, sleep/wake reconnect, optional TLS,
  and bounded WebSocket/custom-command input.

## Configuration

Copy `linux-agent/config.example.yaml` to
`/etc/streamdeck-monitor/config.yaml` and set a long random `token`. Custom
commands are argv arrays and must use an absolute executable path; the agent
never executes them through a shell. Docker and systemd collection are
optional, so their absence does not stop the agent.

### Run the agent

```sh
cd linux-agent
go run ./cmd/agent -config /etc/streamdeck-monitor/config.yaml
```

The Windows plugin connects to `ws://HOST:8765/ws`.

### Build the plugin

```sh
cd windows-plugin
npm install
npm test
npm run typecheck
npm run pack
```

The generated `com.nodedeck.monitor.sdPlugin/plugin.js` is the file referenced
by the SDK manifest. The Property Inspector configures host, port, token,
metric type, device/service/container/custom ID, formatting, refresh interval,
and thresholds.

To validate and create the installable plugin package, install the official Stream Deck CLI and run:

```sh
npm install -g @elgato/cli@latest
npm run pack
```

The resulting `.streamDeckPlugin` file is written to `windows-plugin/dist/`.

### Linux agent verification

```sh
cd linux-agent
go test -race -shuffle=on -count=1 ./...
go build ./...
```

The systemd unit is `linux-agent/deploy/streamdeck-monitor.service`.

For a Linux host with Go and systemd installed, run the installer as root:

```sh
cd linux-agent
sudo deploy/install.sh
```

The installer never overwrites an existing
`/etc/streamdeck-monitor/config.yaml`; edit that file and restart the service
after changing settings.

The plugin source uses `@elgato/streamdeck` SDK 2 and targets the Node.js 24 runtime supported by Stream Deck 7.1+.
