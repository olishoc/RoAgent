import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { Writable } from "node:stream";
import path from "node:path";
import pino, { type Logger } from "pino";
import type { Config } from "./config.ts";

const MAX_LOG_BYTES = 10 * 1024 * 1024;
const LOG_FILES_TO_KEEP = 3;

class RotatingFileStream extends Writable {
  private stream;
  private size;

  constructor(private readonly filePath: string) {
    super();
    this.stream = createWriteStream(this.filePath, { flags: "a" });
    this.size = existsSync(this.filePath) ? statSync(this.filePath).size : 0;
  }

  override _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      if (this.size + chunk.length > MAX_LOG_BYTES) this.rotate();
      this.stream.write(chunk, encoding, (error) => {
        if (!error) this.size += chunk.length;
        callback(error ?? undefined);
      });
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private rotate(): void {
    this.stream.end();
    for (let i = LOG_FILES_TO_KEEP - 1; i >= 1; i -= 1) {
      const from = `${this.filePath}.${i}`;
      const to = `${this.filePath}.${i + 1}`;
      if (existsSync(from)) renameSync(from, to);
    }
    if (existsSync(this.filePath)) renameSync(this.filePath, `${this.filePath}.1`);
    this.stream = createWriteStream(this.filePath, { flags: "a" });
    this.size = 0;
  }
}

export interface AppLogger {
  raw: Logger;
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  sanitizeError(error: unknown): Record<string, unknown>;
}

function sanitizeStack(stack: string | undefined, config: Config): string | undefined {
  if (!stack) return undefined;
  const normalizedData = config.dataDirectory.replace(/\\/g, "/");
  return stack
    .replace(/\\/g, "/")
    .split("\n")
    .map((line) => {
      if (line.includes(normalizedData)) return line;
      return line.replace(/(?:file:\/\/)?\/[\w./ -]+/g, "[redacted-path]");
    })
    .join("\n");
}

function sanitizeLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const allowed = new Set([
    "requestId",
    "placeId",
    "type",
    "success",
    "durationMs",
    "code",
    "message",
    "retryable",
    "stack",
    "remoteAddress",
    "activeConnections",
    "activePlaces",
    "port",
    "event",
  ]);
  for (const [key, value] of Object.entries(obj)) {
    if (allowed.has(key)) safe[key] = value;
  }
  return safe;
}

export function createLogger(config: Config): AppLogger {
  const logDir = path.join(config.dataDirectory, "logs");
  mkdirSync(logDir, { recursive: true });
  const filePath = path.join(logDir, "daemon.log");
  const raw = pino({ level: config.logLevel, base: undefined, timestamp: pino.stdTimeFunctions.isoTime }, new RotatingFileStream(filePath));

  const appLogger: AppLogger = {
    raw,
    debug: (obj, msg) => raw.debug(sanitizeLogObject(obj), msg),
    info: (obj, msg) => raw.info(sanitizeLogObject(obj), msg),
    warn: (obj, msg) => raw.warn(sanitizeLogObject(obj), msg),
    error: (obj, msg) => raw.error(sanitizeLogObject(obj), msg),
    sanitizeError(error: unknown) {
      if (error instanceof Error) {
        return { message: error.message, stack: sanitizeStack(error.stack, config) };
      }
      return { message: String(error) };
    },
  };
  return appLogger;
}
