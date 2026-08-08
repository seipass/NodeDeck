export type ConnectionSettings = Readonly<{ host: string; port: number; token: string }>;

export function parseConnectionSettings(settings: Readonly<{ host?: string; port?: number; token?: string }>): ConnectionSettings | undefined {
  const host = settings.host?.trim() ?? "127.0.0.1";
  const port = settings.port ?? 8765;
  if (host.length === 0 || host.length > 253 || /[\\/\s?#@]/u.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  return { host, port, token: settings.token ?? "" };
}
