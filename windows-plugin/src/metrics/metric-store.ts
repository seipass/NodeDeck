import type { MetricSnapshot } from "../protocol/messages.js";

export class MetricStore {
  private snapshot: MetricSnapshot | undefined;
  private readonly listeners = new Set<() => void>();

  public update(snapshot: MetricSnapshot): void {
    if (this.snapshot?.data.cpu.usagePercent === snapshot.data.cpu.usagePercent && this.snapshot.timestamp === snapshot.timestamp) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  public get(): MetricSnapshot | undefined { return this.snapshot; }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
