# NodeDeck

NodeDeck displays Linux host metrics on an Elgato Stream Deck.

## Phase 1

The current implementation provides:

- Go Linux Agent with CPU and memory collection.
- Token-authenticated WebSocket endpoint at `/ws`.
- One-second metric push after subscription.
- TypeScript Stream Deck plugin using one shared connection per host.
- Dynamic SVG CPU rendering and reconnect backoff.

### Run the agent

```sh
cd linux-agent
go run ./cmd/agent -port 8765 -token replace-with-a-long-token
```

The Windows plugin connects to `ws://HOST:8765/ws`.

### Build the plugin

```sh
cd windows-plugin
npm install
npm run build
```

The generated `com.nodedeck.monitor.sdPlugin/plugin.js` is the file referenced by the SDK manifest and can be copied into the Stream Deck plugins directory.

The plugin source uses `@elgato/streamdeck` SDK 2 and targets the Node.js 24 runtime supported by Stream Deck 7.1+.
