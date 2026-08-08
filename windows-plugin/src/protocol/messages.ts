export type MetricSnapshot = Readonly<{
  type: "metrics";
  protocol: "streamdeck-monitor";
  version: 1;
  timestamp: string;
  data: Readonly<{
    cpu: Readonly<{ usagePercent: number; cores: readonly number[]; load1: number; load5: number; load15: number }>;
    memory: Readonly<{ usedBytes: number; availableBytes: number; usedPercent: number; swapUsedBytes: number; swapUsedPercent: number }>;
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
  if (isMetricSnapshot(value) || isHelloAck(value) || isAgentError(value)) return value;
  return undefined;
}

function isMetricSnapshot(value: unknown): value is MetricSnapshot {
  if (!isRecord(value) || value.type !== "metrics" || value.protocol !== "streamdeck-monitor" || value.version !== 1 || typeof value.timestamp !== "string" || !isRecord(value.data)) return false;
  const cpu = value.data.cpu;
  const memory = value.data.memory;
  return isRecord(cpu) && isFiniteNumber(cpu.usagePercent) && isFiniteNumber(cpu.load1) && isFiniteNumber(cpu.load5) && isFiniteNumber(cpu.load15) && isFiniteNumberArray(cpu.cores) && isRecord(memory) && isFiniteNumber(memory.usedBytes) && isFiniteNumber(memory.availableBytes) && isFiniteNumber(memory.usedPercent) && isFiniteNumber(memory.swapUsedBytes) && isFiniteNumber(memory.swapUsedPercent);
}

function isHelloAck(value: unknown): value is HelloAck {
  if (!isRecord(value) || value.type !== "hello_ack" || value.protocol !== "streamdeck-monitor" || value.version !== 1 || !Array.isArray(value.capabilities)) return false;
  return value.capabilities.every((capability) => typeof capability === "string");
}

function isAgentError(value: unknown): value is AgentError {
  return isRecord(value) && value.type === "error" && typeof value.code === "string" && (value.message === undefined || typeof value.message === "string") && (value.retryable === undefined || typeof value.retryable === "boolean");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberArray(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
