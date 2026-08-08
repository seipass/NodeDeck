export type MetricSnapshot = Readonly<{
  type: "metrics";
  protocol: "streamdeck-monitor";
  version: 1;
  timestamp: string;
  data: Readonly<{
    cpu: Readonly<{ usagePercent: number; cores: readonly number[] }>;
    memory: Readonly<{ usedBytes: number; availableBytes: number; usedPercent: number }>;
    temperature?: readonly Readonly<{ sensor: string; celsius: number }>[];
    disks?: readonly Readonly<{ mountpoint: string; usedBytes: number; freeBytes: number; usedPercent: number; readBytesPerSecond: number; writeBytesPerSecond: number }>[];
    network?: readonly Readonly<{ interface: string; rxBytesPerSecond: number; txBytesPerSecond: number; rxBytes: number; txBytes: number }>[];
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
