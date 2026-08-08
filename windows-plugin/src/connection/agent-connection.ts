import WebSocket from "ws";
import { parseAgentMessage, type MetricSnapshot } from "../protocol/messages.js";

export type ConnectionState = "connecting" | "online" | "offline" | "authentication-error" | "agent-error" | "metric-unavailable";
type Listener = (state: ConnectionState, snapshot?: MetricSnapshot) => void;

export class AgentConnection {
  private socket: WebSocket | undefined;
  private retryMs = 1_000;
  private timer: NodeJS.Timeout | undefined;
  private state: ConnectionState = "offline";
  private readonly listeners = new Set<Listener>();
  private authenticated = false;
  private staleTimer: NodeJS.Timeout | undefined;

  public constructor(private readonly url: string, private readonly token: string) {}

  public start(): void { this.connect(); }

  public stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.socket?.close();
    this.socket = undefined;
    this.authenticated = false;
    if (this.staleTimer !== undefined) clearInterval(this.staleTimer);
  }

  public on(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private connect(): void {
    this.state = "connecting";
    this.notify();
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "hello", protocol: "streamdeck-monitor", version: 1, token: this.token }));
      socket.send(JSON.stringify({ type: "subscribe", metrics: ["cpu", "memory"] }));
      this.staleTimer = setInterval(() => { if (this.state === "online") { this.state = "metric-unavailable"; this.notify(); } }, 5_000);
    });
    socket.on("message", (raw: Buffer) => {
      let message; try { message = parseAgentMessage(JSON.parse(raw.toString()) as unknown); } catch { this.state = "agent-error"; this.notify(); return; }
      if (message?.type === "hello_ack") {
        this.authenticated = true;
        this.retryMs = 1_000;
        this.state = "online";
        this.notify();
      }
      if (message?.type === "metrics" && this.authenticated) { this.state = "online"; this.notify(message); }
      if (message?.type === "error") { this.state = message.code === "AUTH_FAILED" ? "authentication-error" : "agent-error"; this.notify(); if (message.code === "AUTH_FAILED") socket.close(); }
    });
    socket.on("close", () => this.scheduleReconnect());
    socket.on("error", () => this.notify());
  }

  private scheduleReconnect(): void {
    if (this.state === "authentication-error") return;
    this.state = "offline";
    this.notify();
    this.timer = setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 30_000);
  }

  private notify(snapshot?: MetricSnapshot): void { for (const listener of this.listeners) listener(this.state, snapshot); }
}
