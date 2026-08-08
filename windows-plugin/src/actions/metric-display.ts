import { SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { ConnectionManager } from "../connection/connection-manager.js";
import { renderCpu } from "../rendering/metric-renderer.js";

type Settings = Readonly<{ host?: string; port?: number; token?: string }>;

export class MetricDisplayAction extends SingletonAction<Settings> {
  public constructor(private readonly connections: ConnectionManager) { super(); }

  public override onWillAppear(ev: WillAppearEvent<Settings>): void { this.connect(ev.action, ev.payload.settings); }
  public override onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): void { this.connect(ev.action, ev.payload.settings); }
  public override onWillDisappear(): void { return; }

  private connect(action: WillAppearEvent<Settings>["action"], settings: Settings): void {
    const host = settings.host ?? "127.0.0.1";
    const port = settings.port ?? 8765;
    const token = settings.token ?? "";
    const connection = this.connections.get(host, port, token);
    connection.on((state, snapshot) => {
      void action.setImage(renderCpu(snapshot?.data.cpu.usagePercent ?? 0, state));
    });
  }
}
