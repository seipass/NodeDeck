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
    services?: readonly Readonly<{ name: string; loadState: string; activeState: string; subState: string }>[];
    docker?: readonly Readonly<{ id: string; name: string; state: string; uptimeSeconds?: number; cpuPercent?: number; memoryUsageBytes?: number; memoryLimitBytes?: number }>[];
    custom?: readonly Readonly<{ id: string; status: string; value?: string; exitCode: number; stdout?: string; stderr?: string; lastSuccessAt?: string }>[];
  }>;
}>;

export type HelloAck = Readonly<{
  type: "hello_ack";
  protocol: "streamdeck-monitor";
  version: 1;
  capabilities: readonly string[];
}>;

export type AgentError = Readonly<{ type: "error"; code: string; message?: string; retryable?: boolean }>;

export type AgentMessage = MetricSnapshot | HelloAck | AgentError;

export function parseAgentMessage(value: unknown): AgentMessage | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) return undefined;
  const candidate = value as { type?: unknown };
  if (candidate.type === "hello_ack" || candidate.type === "metrics" || candidate.type === "error") return value as AgentMessage;
  return undefined;
}
