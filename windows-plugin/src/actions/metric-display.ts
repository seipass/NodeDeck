import { SingletonAction, type WillAppearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { ConnectionManager } from "../connection/connection-manager.js";
import { renderMetric } from "../rendering/metric-renderer.js";
import { selectMetric, type MetricSettings } from "../metrics/selectors.js";

type Settings = Readonly<{ host?: string; port?: number; token?: string; metricType?: MetricSettings["metricType"]; device?: string }>;

export class MetricDisplayAction extends SingletonAction<Settings> {
  public constructor(private readonly connections: ConnectionManager) { super(); }

  public override onWillAppear(ev: WillAppearEvent<Settings>): void { this.connect(ev.action, ev.payload.settings); }
  public override onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): void { this.connect(ev.action, ev.payload.settings); }
  private connect(action: WillAppearEvent<Settings>["action"], settings: Settings): void {
    const host = settings.host ?? "127.0.0.1";
    const port = settings.port ?? 8765;
    const token = settings.token ?? "";
    const connection = this.connections.get(host, port, token);
    connection.on((state, snapshot) => {
      const metric = snapshot === undefined ? undefined : selectMetric(snapshot, settings);
      void action.setImage(metric === undefined ? renderMetric("Metric", 0, "", state === "online" ? "metric-unavailable" : state) : renderMetric(metric.label, metric.value, metric.unit, state));
    });
  }
}
