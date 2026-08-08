# NodeDeck Monitor WebSocket Protocol

The Linux Agent exposes a JSON WebSocket endpoint at `/ws`. The protocol is
versioned independently from the plugin and currently uses protocol version
`1`.

## Connection and authentication

The client must send `hello` as its first JSON message. The token is only
accepted in this message and is never echoed by the agent.

```json
{
  "type": "hello",
  "protocol": "streamdeck-monitor",
  "version": 1,
  "token": "TOKEN"
}
```

On success, the agent returns its supported metric families:

```json
{
  "type": "hello_ack",
  "protocol": "streamdeck-monitor",
  "version": 1,
  "capabilities": ["cpu", "memory", "temperature", "disk", "network"]
}
```

Authentication failure returns `AUTH_FAILED` and closes the connection.

## Subscription

After `hello_ack`, the client sends the metric families it wants. The list
must contain only capabilities advertised by the agent.

```json
{
  "type": "subscribe",
  "metrics": ["cpu", "memory", "network"]
}
```

An unknown or unavailable family returns `INVALID_SUBSCRIPTION`. The agent
does not execute commands received through this protocol.

Supported families are:

- `cpu`
- `memory`
- `temperature`
- `disk`
- `network`
- `services`
- `docker`
- `custom`

CPU and memory are always present in a metrics payload. Other families are
optional and are omitted when they are not subscribed or unavailable.

## Metrics payload

The agent pushes the latest cached snapshot at the configured update interval.
The timestamp is an RFC 3339 UTC timestamp.

```json
{
  "type": "metrics",
  "protocol": "streamdeck-monitor",
  "version": 1,
  "timestamp": "2026-08-09T00:00:00Z",
  "data": {
    "cpu": {
      "usagePercent": 21.4,
      "cores": [18.2, 24.6],
      "load1": 0.42,
      "load5": 0.38,
      "load15": 0.31
    },
    "memory": {
      "usedBytes": 4294967296,
      "availableBytes": 12884901888,
      "usedPercent": 25.0,
      "swapUsedBytes": 0,
      "swapUsedPercent": 0
    },
    "temperature": [{"sensor": "Package id 0", "celsius": 54.2}],
    "disks": [{
      "mountpoint": "/",
      "usedBytes": 21474836480,
      "freeBytes": 107374182400,
      "usedPercent": 16.7,
      "readBytesPerSecond": 1048576,
      "writeBytesPerSecond": 524288
    }],
    "network": [{
      "interface": "eth0",
      "rxBytesPerSecond": 2097152,
      "txBytesPerSecond": 524288,
      "rxBytes": 123456789,
      "txBytes": 9876543
    }]
  }
}
```

The remaining optional object shapes are:

```json
{
  "services": [{
    "name": "sshd.service",
    "loadState": "loaded",
    "activeState": "active",
    "subState": "running"
  }],
  "docker": [{
    "id": "abc123",
    "name": "web",
    "state": "running",
    "uptimeSeconds": 65,
    "cpuPercent": 2.5,
    "memoryUsageBytes": 104857600,
    "memoryLimitBytes": 1073741824
  }],
  "custom": [{
    "id": "minecraft_players",
    "status": "ok",
    "value": "42",
    "exitCode": 0,
    "stdout": "42\n",
    "lastSuccessAt": "2026-08-09T00:00:00Z"
  }]
}
```

Docker numeric fields are sent even when their value is zero. Custom metrics
are defined and allowlisted in the Linux configuration; the client supplies
only the configured metric ID.

## Heartbeat and errors

The client may send an application-level heartbeat:

```json
{"type": "ping"}
```

The agent responds with:

```json
{"type": "pong"}
```

The WebSocket transport also uses native ping frames. Protocol errors use:

```json
{
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "optional diagnostic",
  "retryable": true
}
```

Known codes include `AUTH_FAILED`, `INVALID_SUBSCRIPTION`, and
`INVALID_MESSAGE`. Clients must treat unknown error codes as agent errors and
must not assume that an error message is safe to display without escaping.

## Compatibility and reconnect

Clients must reject messages with an unknown protocol or version and ignore
unknown optional fields. The plugin reconnects with exponential backoff of
1, 2, 4, 8, ... seconds up to 30 seconds. A successful `hello_ack` resets the
backoff. After sleep/wake, the plugin explicitly reconnects all shared host
connections.
