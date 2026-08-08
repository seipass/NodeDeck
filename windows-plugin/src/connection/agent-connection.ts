import WebSocket from "ws";
import { parseAgentMessage, type MetricSnapshot } from "../protocol/messages.js";
import { MetricStore } from "../metrics/metric-store.js";

const SUBSCRIBED_METRICS = ["cpu", "memory", "temperature", "disk", "network", "services", "docker", "custom"] as const;

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
  private generation = 0;
  private readonly metricStore = new MetricStore();

  public constructor(private readonly url: string, private readonly token: string) {}

  public getToken(): string { return this.token; }

  public start(): void { if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return; this.connect(); }

  public reconnect(): void {
    this.clearReconnectTimer();
    this.clearStaleTimer();
    this.socket?.close();
    this.socket = undefined;
    this.authenticated = false;
    this.start();
  }

  public stop(): void {
    this.generation += 1;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = undefined;
    this.authenticated = false;
    this.clearStaleTimer();
  }

  public on(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  public getSnapshot(): MetricSnapshot | undefined { return this.metricStore.get(); }

  private connect(): void {
    const generation = ++this.generation;
    this.state = "connecting";
    this.notify();
    const socket = new WebSocket(this.url, { maxPayload: 1 << 20 });
    this.socket = socket;
    socket.on("open", () => {
      if (generation !== this.generation) return;
      socket.send(JSON.stringify({ type: "hello", protocol: "streamdeck-monitor", version: 1, token: this.token }));
      this.staleTimer = setInterval(() => { if (this.state === "online") { this.state = "metric-unavailable"; this.notify(); } }, 5_000);
    });
    socket.on("message", (raw: Buffer) => {
      if (generation !== this.generation) return;
      let message; try { message = parseAgentMessage(JSON.parse(raw.toString()) as unknown); } catch { this.state = "agent-error"; this.notify(); return; }
      if (message?.type === "hello_ack") {
        this.authenticated = true;
        this.retryMs = 1_000;
        this.state = "online";
        this.notify();
        const metrics = SUBSCRIBED_METRICS.filter((metric) => message.capabilities.includes(metric));
        socket.send(JSON.stringify({ type: "subscribe", metrics }));
      }
      if (message?.type === "metrics" && this.authenticated) {
        this.metricStore.update(message);
        this.state = "online";
        this.notify(this.metricStore.get());
      }
      if (message?.type === "error") { this.state = message.code === "AUTH_FAILED" ? "authentication-error" : "agent-error"; this.notify(); if (message.code === "AUTH_FAILED") socket.close(); }
    });
    socket.on("close", () => { if (generation === this.generation) this.scheduleReconnect(); });
    socket.on("error", () => { if (generation === this.generation) this.notify(); });
  }

  private scheduleReconnect(): void {
    if (this.state === "authentication-error" || this.timer !== undefined) return;
    this.state = "offline";
    this.notify();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.connect();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 30_000);
  }

  private notify(snapshot?: MetricSnapshot): void { for (const listener of this.listeners) listener(this.state, snapshot); }

  private clearStaleTimer(): void {
    if (this.staleTimer !== undefined) {
      clearInterval(this.staleTimer);
      this.staleTimer = undefined;
    }
  }

  private clearReconnectTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
