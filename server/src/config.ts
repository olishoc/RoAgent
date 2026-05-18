import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  readonly port: number;
  readonly host: "127.0.0.1";
  readonly dataDirectory: string;
  readonly logLevel: LogLevel;
  readonly authToken: string;
  readonly licenseServerUrl: string;
  readonly repoRoot: string;
  readonly startedAt: string;
}

interface DefaultConfigFile {
  port?: number;
  dataDirectory?: string;
  logLevel?: LogLevel;
  licenseServerUrl?: string;
}

const LOG_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);
const EMBEDDED_DEFAULTS: Required<DefaultConfigFile> = {
  port: 45678,
  dataDirectory: "data",
  logLevel: "info",
  licenseServerUrl: "https://api.rblxagent.com",
};

function readDefaults(repoRoot: string): Required<DefaultConfigFile> {
  const defaultsPath = path.join(repoRoot, "config", "default.json");
  let parsed: DefaultConfigFile = EMBEDDED_DEFAULTS;
  try {
    parsed = JSON.parse(readFileSync(defaultsPath, "utf8")) as DefaultConfigFile;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("was not included into executable") && !message.includes("ENOENT")) {
      throw new Error(`Invalid config file ${defaultsPath}: ${message}`);
    }
  }
  return {
    port: parsed.port ?? EMBEDDED_DEFAULTS.port,
    dataDirectory: parsed.dataDirectory ?? EMBEDDED_DEFAULTS.dataDirectory,
    logLevel: parsed.logLevel ?? EMBEDDED_DEFAULTS.logLevel,
    licenseServerUrl: parsed.licenseServerUrl ?? EMBEDDED_DEFAULTS.licenseServerUrl,
  };
}

function parsePort(value: unknown): number {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PLUGIN_PORT/config port: ${String(value)}`);
  }
  return port;
}

function parseLogLevel(value: unknown): LogLevel {
  if (typeof value !== "string" || !LOG_LEVELS.has(value as LogLevel)) {
    throw new Error(`Invalid PLUGIN_LOG_LEVEL/config logLevel: ${String(value)} (expected debug/info/warn/error)`);
  }
  return value as LogLevel;
}

function isPackagedDaemon(): boolean {
  return /studiolink-daemon(\.exe)?$/i.test(path.basename(process.execPath));
}

function packagedDataDirectory(): string | undefined {
  if (!isPackagedDaemon()) return undefined;
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), "StudioLink");
  if (process.platform === "darwin") return path.join(homedir(), "Library", "Application Support", "StudioLink");
  return undefined;
}

function resolveDataDirectory(repoRoot: string, value: string): string {
  if (!value || typeof value !== "string") throw new Error("Invalid PLUGIN_DATA_DIR/config dataDirectory");
  const packaged = value === EMBEDDED_DEFAULTS.dataDirectory ? packagedDataDirectory() : undefined;
  return packaged ?? path.resolve(repoRoot, value);
}

function parseLicenseServerUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid PLUGIN_LICENSE_SERVER_URL/config licenseServerUrl");
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid licenseServerUrl protocol");
  return url.toString().replace(/\/$/, "");
}

function loadOrCreateAuthToken(dataDirectory: string): string {
  const fromEnv = process.env.PLUGIN_AUTH_TOKEN;
  if (fromEnv && fromEnv.trim().length >= 8) return fromEnv.trim();
  const tokenPath = path.join(dataDirectory, "auth-token");
  mkdirSync(dataDirectory, { recursive: true });
  if (existsSync(tokenPath)) {
    const token = readFileSync(tokenPath, "utf8").trim();
    if (token.length >= 8) return token;
  }
  const token = randomUUID();
  writeFileSync(tokenPath, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  return token;
}

export function loadConfig(): Config {
  const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
  const defaults = readDefaults(repoRoot);
  const port = parsePort(process.env.PLUGIN_PORT ?? defaults.port);
  const logLevel = parseLogLevel(process.env.PLUGIN_LOG_LEVEL ?? defaults.logLevel);
  const dataDirectory = resolveDataDirectory(repoRoot, process.env.PLUGIN_DATA_DIR ?? defaults.dataDirectory);
  const licenseServerUrl = parseLicenseServerUrl(process.env.PLUGIN_LICENSE_SERVER_URL ?? defaults.licenseServerUrl);
  mkdirSync(dataDirectory, { recursive: true });
  const authToken = loadOrCreateAuthToken(dataDirectory);

  return {
    port,
    host: "127.0.0.1",
    dataDirectory,
    logLevel,
    authToken,
    licenseServerUrl,
    repoRoot,
    startedAt: new Date().toISOString(),
  };
}
