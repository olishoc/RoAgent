import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

export interface AutostartStatus {
  supported: boolean;
  platform: NodeJS.Platform;
  enabled: boolean;
  method: "windows-hkcu-run" | "macos-launchagent" | "unsupported";
  target?: string;
  message?: string;
}

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const RUN_VALUE = "StudioLink";
const PLIST_NAME = "com.studiolink.daemon.plist";

function quoteWindows(value: string): string {
  return `\"${value.replace(/\"/g, "") }\"`;
}

function macLaunchAgentPath(home = process.env.HOME ?? ""): string {
  return join(home, "Library", "LaunchAgents", PLIST_NAME);
}

function plistContents(target: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>Label</key>\n  <string>com.studiolink.daemon</string>\n  <key>ProgramArguments</key>\n  <array>\n    <string>${target}</string>\n  </array>\n  <key>RunAtLoad</key>\n  <true/>\n  <key>KeepAlive</key>\n  <true/>\n  <key>StandardOutPath</key>\n  <string>${process.env.HOME ?? ""}/Library/Logs/StudioLink/daemon.log</string>\n  <key>StandardErrorPath</key>\n  <string>${process.env.HOME ?? ""}/Library/Logs/StudioLink/daemon.err.log</string>\n</dict>\n</plist>\n`;
}

function windowsTarget(): string {
  return process.env.STUDIOLINK_DAEMON_PATH || process.execPath;
}

function macTarget(): string {
  return process.env.STUDIOLINK_DAEMON_PATH || process.execPath;
}

export function autostartStatus(): AutostartStatus {
  if (process.platform === "win32") {
    const target = windowsTarget();
    try {
      const output = execFileSync("reg", ["query", RUN_KEY, "/v", RUN_VALUE], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      return { supported: true, platform: process.platform, enabled: output.includes(target) || output.includes("studiolink-daemon"), method: "windows-hkcu-run", target };
    } catch {
      return { supported: true, platform: process.platform, enabled: false, method: "windows-hkcu-run", target };
    }
  }
  if (process.platform === "darwin") {
    const target = macTarget();
    const file = macLaunchAgentPath();
    const enabled = existsSync(file) && readFileSync(file, "utf8").includes("com.studiolink.daemon");
    return { supported: true, platform: process.platform, enabled, method: "macos-launchagent", target };
  }
  return { supported: false, platform: process.platform, enabled: false, method: "unsupported", message: "Autostart is supported by the packaged Windows and macOS installers." };
}

export function setAutostart(enabled: boolean): AutostartStatus {
  if (process.platform === "win32") {
    const target = windowsTarget();
    if (enabled) {
      execFileSync("reg", ["add", RUN_KEY, "/v", RUN_VALUE, "/t", "REG_SZ", "/d", quoteWindows(target), "/f"], { stdio: "ignore", windowsHide: true });
    } else {
      execFileSync("reg", ["delete", RUN_KEY, "/v", RUN_VALUE, "/f"], { stdio: "ignore", windowsHide: true });
    }
    return autostartStatus();
  }
  if (process.platform === "darwin") {
    const target = macTarget();
    const file = macLaunchAgentPath();
    if (enabled) {
      mkdirSync(dirname(file), { recursive: true });
      mkdirSync(join(process.env.HOME ?? "", "Library", "Logs", "StudioLink"), { recursive: true });
      writeFileSync(file, plistContents(target), { encoding: "utf8", mode: 0o644 });
      try { execFileSync("launchctl", ["load", file], { stdio: "ignore" }); } catch { /* already loaded or unavailable */ }
    } else {
      try { execFileSync("launchctl", ["unload", file], { stdio: "ignore" }); } catch { /* not loaded */ }
      rmSync(file, { force: true });
    }
    return autostartStatus();
  }
  return autostartStatus();
}
