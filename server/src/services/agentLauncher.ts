import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { PlaceId } from "../../../shared/protocol.ts";

export interface LaunchAgentOptions {
  placeId: PlaceId;
  placeName: string;
  scriptsDir: string;
  port?: number;
}

interface RunningAgent {
  process: ChildProcess;
  placeName: string;
  scriptsDir: string;
}

const running = new Map<PlaceId, RunningAgent>();

export function roAgentExecutablePath(): string {
  return process.platform === "win32" ? "C:\\Program Files\\StudioLink\\roagent\\roagent.exe" : "/usr/local/bin/roagent";
}

export function isRoAgentInstalled(): boolean {
  return existsSync(roAgentExecutablePath());
}

export function launchAgent(options: LaunchAgentOptions): { launched: boolean; pid?: number; reused?: boolean; command: string } {
  const existing = running.get(options.placeId);
  if (existing?.process.pid && isPidAlive(existing.process.pid)) {
    focusAgent(options.placeId);
    return { launched: false, reused: true, pid: existing.process.pid, command: roAgentExecutablePath() };
  }

  const exe = roAgentExecutablePath();
  const args = [
    "--studiolink",
    "--studiolink-place-id", options.placeId,
    "--studiolink-place-name", options.placeName,
    "--studiolink-daemon-port", String(options.port ?? 45678),
    "--studiolink-scripts-dir", options.scriptsDir,
  ];
  const command = [exe, ...args.map(quoteArg)].join(" ");
  const child = process.platform === "win32"
    ? spawn("cmd.exe", ["/c", "start", "RoAgent — StudioLink AI", "cmd.exe", "/k", command], { detached: true, stdio: "ignore" })
    : spawn("osascript", ["-e", `tell application "Terminal" to do script ${JSON.stringify(command)}`, "-e", "tell application \"Terminal\" to activate"], { detached: true, stdio: "ignore" });
  child.unref();
  running.set(options.placeId, { process: child, placeName: options.placeName, scriptsDir: options.scriptsDir });
  return { launched: true, pid: child.pid, command };
}

export function killAgent(placeId: PlaceId): boolean {
  const existing = running.get(placeId);
  if (!existing) return false;
  existing.process.kill("SIGTERM");
  running.delete(placeId);
  return true;
}

export function pollAgents(onExit: (placeId: PlaceId) => void): NodeJS.Timeout {
  return setInterval(() => {
    for (const [placeId, entry] of running) {
      if (!entry.process.pid || !isPidAlive(entry.process.pid)) {
        running.delete(placeId);
        onExit(placeId);
      }
    }
  }, 5_000);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function focusAgent(_placeId: PlaceId): void {
  // Platform-specific terminal focusing is best-effort and installer-dependent.
}

function quoteArg(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}
