import { createConnection, createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import { AgentConnection } from "./agent-connection.js";

describe("Linux Agent end-to-end", () => {
  it("starts the Go agent and receives a subscribed metric snapshot", async () => {
    const port = await freePort();
    const directory = await mkdtemp(join(tmpdir(), "node-deck-agent-"));
    const configPath = join(directory, "config.yaml");
    const process = await startAgent(configPath, port);
    const connection = new AgentConnection(`ws://127.0.0.1:${port}/ws`, "integration-token");
    try {
      const snapshot = await new Promise<NonNullable<ReturnType<AgentConnection["getSnapshot"]>>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("agent snapshot timeout")), 15_000);
        const unsubscribe = connection.on((state, value) => {
          if (state === "agent-error" || state === "authentication-error") {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error(`agent connection state: ${state}`));
            return;
          }
          if (value !== undefined) {
            clearTimeout(timeout);
            unsubscribe();
            resolve(value);
          }
        });
        connection.start();
      });
      expect(snapshot.data.cpu.usagePercent).toBeGreaterThanOrEqual(0);
      expect(snapshot.data.memory.availableBytes).toBeGreaterThanOrEqual(0);
    } finally {
      connection.stop();
      stopAgent(process);
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("could not allocate a port");
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  return port;
}

async function startAgent(configPath: string, port: number): Promise<ChildProcess> {
  await writeFile(configPath, `listen:\n  host: 127.0.0.1\n  port: '${port}'\ntoken: integration-token\nupdate_interval: 100ms\nintervals:\n  temperature: 2s\n  docker: 2s\n  services: 5s\ndocker: false\n`, "utf8");
  const child = spawn("go", ["run", "./cmd/agent", "-config", configPath], { cwd: join(globalThis.process.cwd(), "..", "linux-agent"), stdio: "ignore" });
  await waitForProcessListening(port, child);
  return child;
}

async function waitForProcessListening(port: number, process: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`agent exited with code ${process.exitCode}`);
    try {
      await connect(port);
      return;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("agent listen timeout");
}

async function connect(port: number): Promise<void> {
  const socket = createConnection({ port, host: "127.0.0.1" });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  socket.destroy();
}

function stopAgent(process: ChildProcess): void {
  if (process.exitCode === null) process.kill();
}
