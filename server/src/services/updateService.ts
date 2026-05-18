import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { Config } from "../config.ts";

export interface ReleaseArtifact {
  platform: string;
  version: string;
  url: string;
  sha256: string;
  signatureUrl?: string;
  size?: number;
}

export interface ReleaseManifest {
  version?: string;
  daemonVersion?: string;
  pluginVersion?: string;
  releaseNotesUrl?: string;
  updateUrl?: string;
  artifacts?: Record<string, ReleaseArtifact> | ReleaseArtifact[];
}

export interface UpdateCheckResult {
  manifestUrl: string;
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  platformKey: string;
  artifact?: ReleaseArtifact;
  canApply: boolean;
  reason?: string;
  releaseNotesUrl?: string;
  updateUrl?: string;
  signing: "not-configured" | "present";
}

export interface UpdateApplyResult extends UpdateCheckResult {
  staged?: boolean;
  stagedPath?: string;
  scriptPath?: string;
  restarting?: boolean;
  sha256Verified?: boolean;
}

const DEFAULT_MANIFEST_URL = "https://rblxagent.com/api/releases/studiolink.json";

export function platformKey(platform = process.platform, arch = process.arch): string {
  return `${platform}-${arch}`;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((part) => Number.parseInt(part, 10)).map((n) => Number.isFinite(n) ? n : 0);
  const pb = b.split(/[.-]/).map((part) => Number.parseInt(part, 10)).map((n) => Number.isFinite(n) ? n : 0);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function manifestUrl(): string {
  return process.env.STUDIOLINK_UPDATE_MANIFEST_URL || DEFAULT_MANIFEST_URL;
}

function selectArtifact(manifest: ReleaseManifest, key = platformKey()): ReleaseArtifact | undefined {
  if (Array.isArray(manifest.artifacts)) return manifest.artifacts.find((artifact) => artifact.platform === key);
  return manifest.artifacts?.[key];
}

function isPackagedDaemon(): boolean {
  return /studiolink-daemon(\.exe)?$/i.test(basename(process.execPath));
}

function assertSafeArtifact(artifact: ReleaseArtifact): void {
  const url = new URL(artifact.url);
  if (url.protocol !== "https:") throw new Error("Update artifact URL must use HTTPS");
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) throw new Error("Update artifact must include a SHA-256 checksum");
}

export async function fetchManifest(fetcher: typeof fetch = fetch): Promise<ReleaseManifest> {
  const url = manifestUrl();
  if (new URL(url).protocol !== "https:") throw new Error("Update manifest URL must use HTTPS");
  const response = await fetcher(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Update manifest request failed: ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("json")) throw new Error(`Update manifest returned ${contentType}, not JSON`);
  const parsed = await response.json() as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Update manifest must be a JSON object");
  return parsed as ReleaseManifest;
}

function unavailableUpdateResult(config: Config, key: string, reason: string): UpdateCheckResult {
  return {
    manifestUrl: manifestUrl(),
    currentVersion: readCurrentVersion(config),
    updateAvailable: false,
    platformKey: key,
    canApply: false,
    reason: `Update manifest unavailable: ${reason}`,
    updateUrl: "https://rblxagent.com/download",
    signing: "not-configured",
  };
}

export async function checkForUpdate(config: Config, fetcher: typeof fetch = fetch): Promise<UpdateCheckResult> {
  const key = platformKey();
  let manifest: ReleaseManifest;
  try {
    manifest = await fetchManifest(fetcher);
  } catch (error) {
    return unavailableUpdateResult(config, key, error instanceof Error ? error.message : String(error));
  }
  const currentVersion = readCurrentVersion(config);
  const latestVersion = manifest.daemonVersion || manifest.version;
  const artifact = selectArtifact(manifest, key);
  let reason: string | undefined;
  let canApply = false;
  if (!artifact) reason = `No update artifact for ${key}`;
  else {
    try {
      assertSafeArtifact(artifact);
      canApply = isPackagedDaemon();
      if (!canApply) reason = "Automatic replacement is disabled while running from a development Node/tsx runtime.";
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    manifestUrl: manifestUrl(),
    currentVersion,
    latestVersion,
    updateAvailable: Boolean(latestVersion && compareVersions(latestVersion, currentVersion) > 0),
    platformKey: key,
    artifact,
    canApply,
    reason,
    releaseNotesUrl: manifest.releaseNotesUrl,
    updateUrl: manifest.updateUrl || "https://rblxagent.com/download",
    signing: artifact?.signatureUrl ? "present" : "not-configured",
  };
}

export function readCurrentVersion(config: Config): string {
  try {
    const packageFile = join(config.repoRoot, "server", "package.json");
    return (JSON.parse(readFileSync(packageFile, "utf8")) as { version?: string }).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function downloadArtifact(artifact: ReleaseArtifact, updatesDir: string, fetcher: typeof fetch): Promise<{ path: string; sha256: string }> {
  assertSafeArtifact(artifact);
  mkdirSync(updatesDir, { recursive: true });
  const response = await fetcher(artifact.url);
  if (!response.ok) throw new Error(`Update download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256.toLowerCase() !== artifact.sha256.toLowerCase()) throw new Error("Update checksum verification failed");
  const ext = process.platform === "win32" ? ".exe" : "";
  const stagedPath = join(updatesDir, `studiolink-daemon-${artifact.version}${ext}`);
  writeFileSync(stagedPath, bytes, { mode: 0o755 });
  return { path: stagedPath, sha256 };
}

function writeRestartScript(config: Config, stagedPath: string): string {
  const updatesDir = dirname(stagedPath);
  const current = process.execPath;
  if (process.platform === "win32") {
    const scriptPath = join(updatesDir, "apply-update.ps1");
    const backup = `${current}.bak`;
    writeFileSync(scriptPath, `Start-Sleep -Seconds 4\nCopy-Item -Force ${JSON.stringify(current)} ${JSON.stringify(backup)}\nCopy-Item -Force ${JSON.stringify(stagedPath)} ${JSON.stringify(current)}\nStart-Process -FilePath ${JSON.stringify(current)} -WorkingDirectory ${JSON.stringify(config.repoRoot)}\n`, "utf8");
    return scriptPath;
  }
  const scriptPath = join(updatesDir, "apply-update.sh");
  const backup = `${current}.bak`;
  writeFileSync(scriptPath, `#!/usr/bin/env bash\nset -euo pipefail\nsleep 4\ncp ${JSON.stringify(current)} ${JSON.stringify(backup)}\ncp ${JSON.stringify(stagedPath)} ${JSON.stringify(current)}\nchmod +x ${JSON.stringify(current)}\nnohup ${JSON.stringify(current)} >/dev/null 2>&1 &\n`, { encoding: "utf8", mode: 0o755 });
  return scriptPath;
}

export async function applyUpdate(config: Config, fetcher: typeof fetch = fetch): Promise<UpdateApplyResult> {
  const checked = await checkForUpdate(config, fetcher);
  if (!checked.artifact) return { ...checked, staged: false };
  if (!checked.canApply) return { ...checked, staged: false };
  const updatesDir = join(config.dataDirectory, "updates");
  const staged = await downloadArtifact(checked.artifact, updatesDir, fetcher);
  const scriptPath = writeRestartScript(config, staged.path);
  if (process.platform === "win32") {
    spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } else {
    spawn("/bin/sh", [scriptPath], { detached: true, stdio: "ignore" }).unref();
  }
  return { ...checked, staged: true, stagedPath: staged.path, scriptPath, restarting: true, sha256Verified: true };
}

export function repairReport(config: Config): object {
  mkdirSync(config.dataDirectory, { recursive: true });
  const checks = {
    dataDirectory: { ok: existsSync(config.dataDirectory), path: config.dataDirectory },
    repoRoot: { ok: existsSync(config.repoRoot), path: config.repoRoot },
    executable: { ok: existsSync(process.execPath), path: process.execPath, packaged: isPackagedDaemon() },
  };
  return { repaired: true, checks, message: "Checked data directory, repo root, and daemon executable. Missing data directories were recreated." };
}
