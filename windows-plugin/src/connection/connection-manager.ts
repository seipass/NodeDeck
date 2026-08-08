import { AgentConnection } from "./agent-connection.js";

export class ConnectionManager {
  private readonly connections = new Map<string, AgentConnection>();

  public get(host: string, port: number, token: string): AgentConnection {
    const key = `${host}:${port}`;
    const existing = this.connections.get(key);
    if (existing !== undefined) return existing;
    const connection = new AgentConnection(`ws://${host}:${port}/ws`, token);
    this.connections.set(key, connection);
    connection.start();
    return connection;
  }

  public reconnectAll(): void {
    for (const connection of this.connections.values()) connection.reconnect();
  }
}
