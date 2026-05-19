import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";
import { BUILD_INFO } from "../buildInfo.ts";

export interface SelfInstallEnv {
  LOCALAPPDATA?: string;
  APPDATA?: string;
  [key: string]: string | undefined;
}

export interface SelfInstallOptions {
  autostart: boolean;
  deleteData: boolean;
}

const APP_NAME = "StudioLink";
const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const RUN_VALUE = "StudioLink";
const UNINSTALL_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StudioLink";
const CLI_COMMANDS = new Set(["install", "uninstall", "repair", "start", "stop", "restart", "status", "settings", "version", "doctor", "autostart", "logs", "help", "--help", "-h"]);

export function defaultInstallDir(env: SelfInstallEnv = process.env, home = homedir()): string {
  const localAppData = env.LOCALAPPDATA || join(home, "AppData", "Local");
  return join(localAppData, "Programs", APP_NAME);
}

export function defaultDataDir(env: SelfInstallEnv = process.env, home = homedir()): string {
  const appData = env.APPDATA || join(home, "AppData", "Roaming");
  return join(appData, APP_NAME);
}

export function isPackagedWindowsDaemon(platform = process.platform, execPath = process.execPath): boolean {
  if (platform !== "win32") return false;
  const name = execPath.split(/[\\/]/).pop() || "";
  return /^studiolink-daemon(?:\s*\(\d+\))?\.exe$/i.test(name) || /^studiolinksetup(?:\s*\(\d+\))?\.exe$/i.test(name);
}

export function isInstalledPath(execPath: string, installDir: string): boolean {
  const expected = canonicalPath(join(installDir, "studiolink-daemon.exe"));
  return canonicalPath(execPath) === expected;
}

function canonicalPath(value: string): string {
  return normalize(value).replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
}

export function findAdjacentRoAgent(execPath = process.execPath): string | undefined {
  const base = dirname(execPath);
  const candidates = [
    join(base, "roagent.exe"),
    join(base, "roagent", "roagent.exe"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

export function embeddedRoAgentAssetPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "embedded", "roagent.exe");
}

function embeddedRoAgentPackagePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "embedded", "package.json");
}

export function hasEmbeddedRoAgent(): boolean {
  return existsSync(embeddedRoAgentAssetPath());
}

export function commandShimContents(daemonPath: string): string {
  return `@echo off\r\nsetlocal\r\nif "%~1"=="" (\r\n  ${JSON.stringify(daemonPath)} start\r\n) else (\r\n  ${JSON.stringify(daemonPath)} %*\r\n)\r\n`;
}

export function pathListContains(pathValue: string | undefined, entry: string): boolean {
  const expected = canonicalPath(entry);
  return (pathValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => canonicalPath(part) === expected);
}

export function addPathEntry(pathValue: string | undefined, entry: string): string {
  const parts = (pathValue || "").split(";").map((part) => part.trim()).filter(Boolean);
  if (!pathListContains(pathValue, entry)) parts.push(entry);
  return parts.join(";");
}

export function removePathEntry(pathValue: string | undefined, entry: string): string {
  const expected = canonicalPath(entry);
  return (pathValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => canonicalPath(part) !== expected)
    .join(";");
}

export function shouldRunSelfInstall(argv: string[], platform = process.platform, execPath = process.execPath, installDir = defaultInstallDir()): boolean {
  if (!isPackagedWindowsDaemon(platform, execPath)) return false;
  const command = argv[2]?.toLowerCase();
  if (CLI_COMMANDS.has(command || "")) return true;
  return !command && !isInstalledPath(execPath, installDir);
}

export function handleSelfInstallCommand(version: string): boolean {
  if (!shouldRunSelfInstall(process.argv)) return false;
  const command = (process.argv[2] || "install").toLowerCase();
  const options = parseOptions(process.argv.slice(3));
  try {
    if (command === "install") install(version, options);
    else if (command === "repair") install(version, options);
    else if (command === "uninstall") uninstall(options);
    else if (command === "start") startInstalled();
    else if (command === "stop") stopDaemon();
    else if (command === "restart") restartDaemon();
    else if (command === "status") printStatus(version);
    else if (command === "settings") printSettings(version);
    else if (command === "version") printVersion(version);
    else if (command === "doctor") printDoctor(version);
    else if (command === "autostart") handleAutostart(process.argv[3]);
    else if (command === "logs") printLogs();
    else if (command === "help" || command === "--help" || command === "-h") printHelp();
    else install(version, options);
  } catch (error) {
    console.error(`[StudioLink] ${command} failed: ${error instanceof Error ? error.message : String(error)}`);
    pauseIfInteractive();
    process.exit(1);
  }
  return true;
}

function parseOptions(args: string[]): SelfInstallOptions {
  return {
    autostart: !args.includes("--no-autostart"),
    deleteData: args.includes("--delete-data"),
  };
}

function install(version: string, options: SelfInstallOptions): void {
  const installDir = defaultInstallDir();
  const daemonDest = join(installDir, "studiolink-daemon.exe");
  mkdirSync(installDir, { recursive: true });
  if (!isInstalledPath(process.execPath, installDir)) {
    stopInstalledDaemonForReplace(daemonDest);
    copyFileWithRetry(process.execPath, daemonDest);
  }

  const roAgentInstalled = installRoAgent(installDir);

  installCommandShim(installDir, daemonDest);
  addInstallDirToUserPath(installDir);
  writeUninstallRegistry(version, daemonDest);
  if (options.autostart) enableAutostart(daemonDest);
  else disableAutostart();

  const child = startProcess(daemonDest);
  openUrl("https://rblxagent.com/download?installed=1");
  console.log(`[StudioLink] Installed to ${installDir}`);
  console.log(`[StudioLink] Daemon start requested${child.pid ? ` (pid ${child.pid})` : ""}.`);
  console.log(`[StudioLink] If http://127.0.0.1:45678/health is unavailable, inspect ${daemonLogPaths().stderr}.`);
  if (!roAgentInstalled) console.warn("[StudioLink] roagent.exe was not embedded or found next to the daemon. Launch RoAgent from Studio after placing roagent.exe in the installed roagent folder.");
  pauseIfInteractive();
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isBusyCopyError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

function copyFileWithRetry(src: string, dest: string): void {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      copyFileSync(src, dest);
      return;
    } catch (error) {
      lastError = error;
      if (!isBusyCopyError(error) || attempt === 10) break;
      sleepMs(500);
    }
  }
  throw lastError;
}

function stopInstalledDaemonForReplace(daemonPath: string): void {
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-Process studiolink-daemon -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $args[0] } | Stop-Process -Force", daemonPath], { stdio: "ignore", windowsHide: true });
    sleepMs(1200);
  } catch {
    // If process inspection fails, the retry loop still handles a transient lock.
  }
}

function installRoAgent(installDir: string): boolean {
  const roAgentDir = join(installDir, "roagent");
  const roAgentDest = join(roAgentDir, "roagent.exe");
  mkdirSync(roAgentDir, { recursive: true });
  const embedded = embeddedRoAgentAssetPath();
  if (existsSync(embedded)) {
    writeFileSync(roAgentDest, readFileSync(embedded));
    installRoAgentPackageJson(roAgentDir);
    return true;
  }
  const adjacent = findAdjacentRoAgent();
  if (adjacent) {
    copyFileSync(adjacent, roAgentDest);
    installRoAgentPackageJson(roAgentDir);
    return true;
  }
  return false;
}

function installRoAgentPackageJson(roAgentDir: string): void {
  const dest = join(roAgentDir, "package.json");
  const embeddedPackage = embeddedRoAgentPackagePath();
  if (existsSync(embeddedPackage)) {
    copyFileSync(embeddedPackage, dest);
    return;
  }
  if (!existsSync(dest)) {
    writeFileSync(dest, JSON.stringify({ name: "roagent", version: "0.1.0", description: "RoAgent — StudioLink AI assistant for Roblox Studio" }, null, 2), "utf8");
  }
}

function uninstall(options: SelfInstallOptions): void {
  const installDir = defaultInstallDir();
  disableAutostart();
  deleteRegistryTree(UNINSTALL_KEY);
  removeInstallDirFromUserPath(installDir);
  if (options.deleteData) rmSync(defaultDataDir(), { recursive: true, force: true });

  const cleanup = join(process.env.TEMP || installDir, `studiolink-uninstall-${Date.now()}.ps1`);
  writeFileSync(cleanup, `Start-Sleep -Seconds 2\nGet-Process studiolink-daemon -ErrorAction SilentlyContinue | Stop-Process -Force\nRemove-Item -Recurse -Force ${JSON.stringify(installDir)} -ErrorAction SilentlyContinue\nRemove-Item -Force ${JSON.stringify(cleanup)} -ErrorAction SilentlyContinue\n`, "utf8");
  spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", cleanup], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  console.log("[StudioLink] Uninstall scheduled.");
}

function startInstalled(): void {
  const daemon = join(defaultInstallDir(), "studiolink-daemon.exe");
  if (!existsSync(daemon)) throw new Error(`Installed daemon not found at ${daemon}`);
  const child = startProcess(daemon);
  console.log(`[StudioLink] Daemon start requested${child.pid ? ` (pid ${child.pid})` : ""}.`);
  console.log(`[StudioLink] Logs: ${daemonLogPaths().stdout} and ${daemonLogPaths().stderr}`);
}

function stopDaemon(): void {
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-Process studiolink-daemon -ErrorAction SilentlyContinue | Stop-Process -Force"], { stdio: "ignore", windowsHide: true });
    console.log("[StudioLink] Daemon stopped.");
  } catch {
    console.log("[StudioLink] Daemon was not running or could not be stopped.");
  }
}

function restartDaemon(): void {
  stopDaemon();
  startInstalled();
}

function printStatus(version: string): void {
  const installDir = defaultInstallDir();
  const daemon = join(installDir, "studiolink-daemon.exe");
  const roagent = join(installDir, "roagent", "roagent.exe");
  const commandShim = join(installDir, "StudioLink.cmd");
  console.log(JSON.stringify({
    version,
    releaseTag: BUILD_INFO.releaseTag,
    commitSha: BUILD_INFO.commitSha,
    buildTime: BUILD_INFO.buildTime,
    installDir,
    installed: existsSync(daemon),
    roAgentInstalled: existsSync(roagent),
    commandShim,
    commandInstalled: existsSync(commandShim),
    userPathConfigured: pathListContains(readUserPath(), installDir),
    currentShellPathConfigured: pathListContains(process.env.Path || process.env.PATH, installDir),
    pathRefreshHint: pathListContains(readUserPath(), installDir) && !pathListContains(process.env.Path || process.env.PATH, installDir) ? `Current terminal PATH is stale. Run: $env:Path += \";${installDir}\"` : undefined,
    autostartEnabled: isAutostartEnabled(daemon),
    logs: daemonLogPaths(),
  }, null, 2));
}

function printSettings(version: string): void {
  const installDir = defaultInstallDir();
  const daemon = join(installDir, "studiolink-daemon.exe");
  const logs = daemonLogPaths();
  console.log(`StudioLink ${version} (${BUILD_INFO.releaseTag})`);
  console.log(`Commit: ${BUILD_INFO.commitSha}`);
  console.log(`Built: ${BUILD_INFO.buildTime}`);
  console.log(`Install dir: ${installDir}`);
  console.log(`Data dir: ${defaultDataDir()}`);
  console.log(`Daemon installed: ${existsSync(daemon)}`);
  console.log(`Command installed: ${existsSync(join(installDir, "StudioLink.cmd"))}`);
  console.log(`PATH configured: ${pathListContains(readUserPath(), installDir)}`);
  console.log(`Autostart enabled: ${isAutostartEnabled(daemon)}`);
  console.log(`Stdout log: ${logs.stdout}`);
  console.log(`Stderr log: ${logs.stderr}`);
  console.log("Commands: StudioLink, StudioLink version, StudioLink doctor, StudioLink status, StudioLink start, StudioLink stop, StudioLink restart, StudioLink autostart on|off|status, StudioLink logs, StudioLink uninstall");
}

function printVersion(version: string): void {
  console.log(`StudioLink ${version}`);
  console.log(`Release: ${BUILD_INFO.releaseTag}`);
  console.log(`Commit: ${BUILD_INFO.commitSha}`);
  console.log(`Built: ${BUILD_INFO.buildTime}`);
}

function printDoctor(version: string): void {
  const installDir = defaultInstallDir();
  const daemon = join(installDir, "studiolink-daemon.exe");
  const commandShim = join(installDir, "StudioLink.cmd");
  const userPathConfigured = pathListContains(readUserPath(), installDir);
  const currentShellPathConfigured = pathListContains(process.env.Path || process.env.PATH, installDir);
  printVersion(version);
  console.log(`Install dir exists: ${existsSync(installDir)}`);
  console.log(`Daemon installed: ${existsSync(daemon)}`);
  console.log(`Command shim installed: ${existsSync(commandShim)}`);
  console.log(`HKCU user PATH configured: ${userPathConfigured}`);
  console.log(`Current terminal PATH configured: ${currentShellPathConfigured}`);
  if (userPathConfigured && !currentShellPathConfigured) console.log(`PATH fix for this terminal: $env:Path += \";${installDir}\"`);
  console.log(`Autostart enabled: ${isAutostartEnabled(daemon)}`);
  console.log(`Health check: http://127.0.0.1:45678/health`);
  console.log(`Direct command: & ${JSON.stringify(commandShim)} status`);
  console.log(`Logs: ${daemonLogPaths().stdout} and ${daemonLogPaths().stderr}`);
}

function printLogs(): void {
  const logs = daemonLogPaths();
  console.log(`Stdout log: ${logs.stdout}`);
  console.log(`Stderr log: ${logs.stderr}`);
  console.log(`Tail errors: Get-Content ${JSON.stringify(logs.stderr)} -Tail 80`);
}

function printHelp(): void {
  console.log(`StudioLink terminal interface

Usage:
  StudioLink                         Start the daemon in the background
  StudioLink run                     Run the daemon in the foreground for debugging
  StudioLink status                  Show install/daemon status as JSON
  StudioLink version                 Show exact release/build identity
  StudioLink doctor                  Diagnose install, PATH, autostart, and logs
  StudioLink settings                Show install paths, logs, PATH, and autostart
  StudioLink start                   Start the daemon in the background
  StudioLink stop                    Stop the daemon
  StudioLink restart                 Restart the daemon
  StudioLink autostart status        Show Windows login autostart state
  StudioLink autostart on            Enable Windows login autostart
  StudioLink autostart off           Disable Windows login autostart
  StudioLink logs                    Show daemon log paths
  StudioLink uninstall               Uninstall StudioLink
  StudioLink repair                  Reinstall shim, PATH, autostart, and files
`);
}

function daemonLogPaths(): { stdout: string; stderr: string } {
  const logDir = join(defaultDataDir(), "logs");
  return {
    stdout: join(logDir, "daemon.stdout.log"),
    stderr: join(logDir, "daemon.stderr.log"),
  };
}

function startProcess(file: string): ReturnType<typeof spawn> {
  const logs = daemonLogPaths();
  mkdirSync(dirname(logs.stdout), { recursive: true });
  const stdout = openSync(logs.stdout, "a");
  const stderr = openSync(logs.stderr, "a");
  const child = spawn(file, [], { cwd: dirname(file), detached: true, stdio: ["ignore", stdout, stderr], windowsHide: true });
  child.unref();
  return child;
}

function installCommandShim(installDir: string, daemonPath: string): void {
  writeFileSync(join(installDir, "StudioLink.cmd"), commandShimContents(daemonPath), "utf8");
}

function readUserPath(): string {
  try {
    return execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "[Environment]::GetEnvironmentVariable('Path', 'User')"], { encoding: "utf8", windowsHide: true }).trim();
  } catch {
    return process.env.Path || process.env.PATH || "";
  }
}

function writeUserPath(value: string): void {
  execFileSync("reg", ["add", "HKCU\\Environment", "/v", "Path", "/t", "REG_EXPAND_SZ", "/d", value, "/f"], { stdio: "ignore", windowsHide: true });
}

function addInstallDirToUserPath(installDir: string): void {
  const current = readUserPath();
  const next = addPathEntry(current, installDir);
  if (next !== current) writeUserPath(next);
}

function removeInstallDirFromUserPath(installDir: string): void {
  const current = readUserPath();
  const next = removePathEntry(current, installDir);
  if (next !== current) writeUserPath(next);
}

function handleAutostart(action: string | undefined): void {
  const daemon = join(defaultInstallDir(), "studiolink-daemon.exe");
  const normalized = (action || "status").toLowerCase();
  if (normalized === "on" || normalized === "enable" || normalized === "enabled") {
    if (!existsSync(daemon)) throw new Error(`Installed daemon not found at ${daemon}`);
    enableAutostart(daemon);
    console.log("[StudioLink] Autostart enabled.");
    return;
  }
  if (normalized === "off" || normalized === "disable" || normalized === "disabled") {
    disableAutostart();
    console.log("[StudioLink] Autostart disabled.");
    return;
  }
  if (normalized !== "status") throw new Error("Usage: StudioLink autostart on|off|status");
  console.log(`[StudioLink] Autostart enabled: ${isAutostartEnabled(daemon)}`);
}

function isAutostartEnabled(daemonPath: string): boolean {
  try {
    const output = execFileSync("reg", ["query", RUN_KEY, "/v", RUN_VALUE], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    return output.includes(daemonPath) || output.includes("studiolink-daemon");
  } catch {
    return false;
  }
}

function enableAutostart(daemonPath: string): void {
  execFileSync("reg", ["add", RUN_KEY, "/v", RUN_VALUE, "/t", "REG_SZ", "/d", `\"${daemonPath}\"`, "/f"], { stdio: "ignore", windowsHide: true });
}

function disableAutostart(): void {
  try {
    execFileSync("reg", ["delete", RUN_KEY, "/v", RUN_VALUE, "/f"], { stdio: "ignore", windowsHide: true });
  } catch {
    // Already absent.
  }
}

function writeUninstallRegistry(version: string, daemonPath: string): void {
  const uninstall = `\"${daemonPath}\" uninstall`;
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "DisplayName", "/t", "REG_SZ", "/d", APP_NAME, "/f"], { stdio: "ignore", windowsHide: true });
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "DisplayVersion", "/t", "REG_SZ", "/d", version, "/f"], { stdio: "ignore", windowsHide: true });
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "Publisher", "/t", "REG_SZ", "/d", "RblxAgent", "/f"], { stdio: "ignore", windowsHide: true });
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "InstallLocation", "/t", "REG_SZ", "/d", defaultInstallDir(), "/f"], { stdio: "ignore", windowsHide: true });
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "UninstallString", "/t", "REG_SZ", "/d", uninstall, "/f"], { stdio: "ignore", windowsHide: true });
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "NoModify", "/t", "REG_DWORD", "/d", "1", "/f"], { stdio: "ignore", windowsHide: true });
  execFileSync("reg", ["add", UNINSTALL_KEY, "/v", "NoRepair", "/t", "REG_DWORD", "/d", "1", "/f"], { stdio: "ignore", windowsHide: true });
}

function deleteRegistryTree(key: string): void {
  try {
    execFileSync("reg", ["delete", key, "/f"], { stdio: "ignore", windowsHide: true });
  } catch {
    // Already absent.
  }
}

function openUrl(url: string): void {
  try {
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    // Non-fatal.
  }
}

function pauseIfInteractive(): void {
  if (!process.stdout.isTTY) return;
  console.log("Press Enter to close this window.");
  try { execFileSync("cmd.exe", ["/d", "/c", "pause", ">nul"], { stdio: "inherit", windowsHide: true }); } catch { /* ignore */ }
}
