import type { MetricSnapshot } from "../protocol/messages.js";

type SnapshotListener = (snapshot: MetricSnapshot) => void;

export class MetricStore {
  private snapshot: MetricSnapshot | undefined;
  private readonly listeners = new Set<SnapshotListener>();

  public get(): MetricSnapshot | undefined { return this.snapshot; }

  public update(snapshot: MetricSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  public on(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
