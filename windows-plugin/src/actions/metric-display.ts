import { action, SingletonAction, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { ConnectionManager } from "../connection/connection-manager.js";
import { renderMetric } from "../rendering/metric-renderer.js";
import { selectMetric, type MetricSettings } from "../metrics/selectors.js";
import { parseConnectionSettings } from "../settings/settings.js";

type Settings = Readonly<{ host?: string; port?: number | string; token?: string; metricType?: MetricSettings["metricType"]; device?: string; customMetricId?: string; label?: string; unit?: string; decimalPlaces?: number; refreshInterval?: number; warningThreshold?: number; criticalThreshold?: number }>;

@action({ UUID: "com.nodedeck.monitor.metric-display" })
export class MetricDisplayAction extends SingletonAction<Settings> {
  private readonly subscriptions = new Map<string, () => void>();
  public constructor(private readonly connections: ConnectionManager) { super(); }

  public override onWillAppear(ev: WillAppearEvent<Settings>): void { this.connect(ev.action, ev.payload.settings); }
  public override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    await ev.action.setTitle("Connecting...").catch(() => undefined);
    try {
      this.connect(ev.action, await ev.action.getSettings());
    } catch {
      this.render(ev.action, renderMetric({ label: "Metric", value: 0, unit: "", decimalPlaces: 1 }, "agent-error"), "Agent error");
    }
  }
  public override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
    this.subscriptions.get(ev.action.id)?.();
    this.subscriptions.delete(ev.action.id);
  }
  public override onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): void { this.connect(ev.action, ev.payload.settings); }
  private connect(action: WillAppearEvent<Settings>["action"], settings: Settings): void {
    this.subscriptions.get(action.id)?.();
    this.subscriptions.delete(action.id);
    const connectionSettings = parseConnectionSettings(settings);
    if (connectionSettings === undefined) {
      this.render(action, renderMetric({ label: "Metric", value: 0, unit: "", decimalPlaces: 1 }, "agent-error"), "Agent error");
      return;
    }
    const connection = this.connections.get(connectionSettings.host, connectionSettings.port, connectionSettings.token);
    let lastState: string | undefined;
    let lastValue: number | undefined;
    let lastDisplayValue: string | undefined;
    let lastRenderedAt = 0;
    this.subscriptions.set(action.id, connection.on((state, snapshot) => {
      const metric = snapshot === undefined ? undefined : selectMetric(snapshot, settings);
      const value = metric?.value;
      const now = Date.now();
      if (state === lastState && value === lastValue && metric?.displayValue === lastDisplayValue) return;
      const refreshInterval = Math.max(0, settings.refreshInterval ?? 1) * 1000;
      if (state === "online" && now - lastRenderedAt < refreshInterval) return;
      lastState = state;
      lastValue = value;
      lastDisplayValue = metric?.displayValue;
      lastRenderedAt = now;
      const image = metric === undefined ? renderMetric({ label: "Metric", value: 0, unit: "", decimalPlaces: 1 }, state === "online" ? "metric-unavailable" : state) : renderMetric({ label: settings.label || metric.label, value: metric.value, displayValue: metric.displayValue, unit: settings.unit || metric.unit, decimalPlaces: settings.decimalPlaces ?? 1, warningThreshold: settings.warningThreshold, criticalThreshold: settings.criticalThreshold }, state);
      const title = metric === undefined ? state : `${settings.label || metric.label}\n${metric.displayValue ?? `${metric.value.toFixed(settings.decimalPlaces ?? 1)}${settings.unit || metric.unit}`}`;
      this.render(action, image, title);
    }));
  }

  private render(action: WillAppearEvent<Settings>["action"], image: string, title: string): void {
    void action.setImage(image).catch(() => action.setTitle(title).catch(() => undefined));
  }
}
