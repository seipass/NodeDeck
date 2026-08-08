export type MetricSnapshot = Readonly<{
  type: "metrics";
  protocol: "streamdeck-monitor";
  version: 1;
  timestamp: string;
  data: Readonly<{
    cpu: Readonly<{ usagePercent: number; cores: readonly number[] }>;
    memory: Readonly<{ usedBytes: number; availableBytes: number; usedPercent: number }>;
  }>;
}>;

export type HelloAck = Readonly<{
  type: "hello_ack";
  protocol: "streamdeck-monitor";
  version: 1;
  capabilities: readonly string[];
}>;

export type AgentMessage = MetricSnapshot | HelloAck;

export function parseAgentMessage(value: unknown): AgentMessage | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) return undefined;
  const candidate = value as { type?: unknown };
  if (candidate.type === "hello_ack" || candidate.type === "metrics") return value as AgentMessage;
  return undefined;
}
