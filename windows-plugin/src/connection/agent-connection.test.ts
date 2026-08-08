import { describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { AgentConnection, type ConnectionState } from "./agent-connection.js";

function metricSnapshot(usagePercent: number): string {
  return JSON.stringify({
    type: "metrics", protocol: "streamdeck-monitor", version: 1,
    timestamp: "2026-01-01T00:00:00Z",
    data: {
      cpu: { usagePercent, cores: [], load1: 1, load5: 1, load15: 1 },
      memory: { usedBytes: 1, availableBytes: 2, usedPercent: 3, swapUsedBytes: 0, swapUsedPercent: 0 },
    },
  });
}

describe("AgentConnection integration", () => {
  it("reconnects after disconnect and receives metrics again", async () => {
    const server = new WebSocketServer({ port: 0 });
    let finish: (() => void) | undefined;
    let fail: ((error: Error) => void) | undefined;
    const complete = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
    const states: ConnectionState[] = [];
    let connectionCount = 0;
    server.on("connection", (socket) => {
      connectionCount += 1;
      socket.on("message", (raw) => {
        const text = raw.toString();
        if (text.includes('"type":"hello"')) {
          socket.send(JSON.stringify({ type: "hello_ack", protocol: "streamdeck-monitor", version: 1, capabilities: ["cpu", "memory"] }));
          return;
        }
        if (!text.includes('"type":"subscribe"')) return;
        if (!text.includes('"docker"')) {
          fail?.(new Error("plugin did not subscribe to the shared metric families"));
          return;
        }
        socket.send(metricSnapshot(connectionCount));
        if (connectionCount === 1) socket.close();
      });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("test server did not expose a port");
    const connection = new AgentConnection(`ws://127.0.0.1:${address.port}`, "secret");
    const unsubscribe = connection.on((state, snapshot) => {
      states.push(state);
      if (snapshot?.data.cpu.usagePercent === 2) finish?.();
    });
    connection.start();
    await Promise.race([complete, new Promise<void>((_, reject) => setTimeout(() => reject(new Error("reconnect timed out")), 8_000))]);
    expect(connectionCount).toBe(2);
    expect(states).toContain("offline");
    expect(connection.getSnapshot()?.data.cpu.usagePercent).toBe(2);
    unsubscribe();
    connection.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 10_000);
});
