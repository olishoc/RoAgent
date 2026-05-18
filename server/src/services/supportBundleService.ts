import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { Config } from "../config.ts";

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir).slice(0, 50);
  } catch {
    return [];
  }
}

export async function createSupportBundle(config: Config): Promise<{ path: string; size: number; createdAt: string }> {
  const supportDir = join(config.dataDirectory, "support");
  mkdirSync(supportDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const path = join(supportDir, `studiolink-support-${createdAt.replace(/[:.]/g, "-")}.json.gz`);
  const payload = {
    createdAt,
    version: "3.0.0",
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    uptime: process.uptime(),
    config: {
      port: config.port,
      host: config.host,
      dataDirectory: config.dataDirectory,
      repoRoot: config.repoRoot,
      logLevel: config.logLevel,
      licenseServerUrl: config.licenseServerUrl,
    },
    files: {
      data: safeList(config.dataDirectory),
      logs: safeList(join(config.dataDirectory, "logs")),
      updates: safeList(join(config.dataDirectory, "updates")),
    },
  };
  await pipeline(Readable.from([JSON.stringify(payload, null, 2)]), createGzip(), createWriteStream(path, { mode: 0o600 }));
  const size = existsSync(path) ? statSync(path).size : 0;
  return { path, size, createdAt };
}

export function bundlePublicName(path: string): string {
  return basename(path);
}
