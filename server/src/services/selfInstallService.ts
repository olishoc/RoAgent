import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";

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

export function defaultInstallDir(env: SelfInstallEnv = process.env, home = homedir()): string {
  const localAppData = env.LOCALAPPDATA || join(home, "AppData", "Local");
  return join(localAppData, "Programs", APP_NAME);
}

export function defaultDataDir(env: SelfInstallEnv = process.env, home = homedir()): string {
  const appData = env.APPDATA || join(home, "AppData", "Roaming");
  return join(appData, APP_NAME);
}

export function isPackagedWindowsDaemon(platform = process.platform, execPath = process.execPath): boolean {
  return platform === "win32" && /(?:studiolink-daemon|studiolinksetup)\.exe$/i.test(execPath);
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

export function hasEmbeddedRoAgent(): boolean {
  return existsSync(embeddedRoAgentAssetPath());
}

export function shouldRunSelfInstall(argv: string[], platform = process.platform, execPath = process.execPath, installDir = defaultInstallDir()): boolean {
  if (!isPackagedWindowsDaemon(platform, execPath)) return false;
  const command = argv[2]?.toLowerCase();
  if (["install", "uninstall", "repair", "start", "status"].includes(command || "")) return true;
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
    else if (command === "status") printStatus(version);
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
  if (!isInstalledPath(process.execPath, installDir)) copyFileSync(process.execPath, daemonDest);

  const roAgentInstalled = installRoAgent(installDir);

  writeUninstallRegistry(version, daemonDest);
  if (options.autostart) enableAutostart(daemonDest);
  else disableAutostart();

  startProcess(daemonDest);
  openUrl("https://rblxagent.com/download?installed=1");
  console.log(`[StudioLink] Installed to ${installDir}`);
  if (!roAgentInstalled) console.warn("[StudioLink] roagent.exe was not embedded or found next to the daemon. Launch RoAgent from Studio after placing roagent.exe in the installed roagent folder.");
  pauseIfInteractive();
}

function installRoAgent(installDir: string): boolean {
  const roAgentDir = join(installDir, "roagent");
  const roAgentDest = join(roAgentDir, "roagent.exe");
  mkdirSync(roAgentDir, { recursive: true });
  const embedded = embeddedRoAgentAssetPath();
  if (existsSync(embedded)) {
    writeFileSync(roAgentDest, readFileSync(embedded));
    return true;
  }
  const adjacent = findAdjacentRoAgent();
  if (adjacent) {
    copyFileSync(adjacent, roAgentDest);
    return true;
  }
  return false;
}

function uninstall(options: SelfInstallOptions): void {
  const installDir = defaultInstallDir();
  disableAutostart();
  deleteRegistryTree(UNINSTALL_KEY);
  if (options.deleteData) rmSync(defaultDataDir(), { recursive: true, force: true });

  const cleanup = join(process.env.TEMP || installDir, `studiolink-uninstall-${Date.now()}.ps1`);
  writeFileSync(cleanup, `Start-Sleep -Seconds 2\nGet-Process studiolink-daemon -ErrorAction SilentlyContinue | Stop-Process -Force\nRemove-Item -Recurse -Force ${JSON.stringify(installDir)} -ErrorAction SilentlyContinue\nRemove-Item -Force ${JSON.stringify(cleanup)} -ErrorAction SilentlyContinue\n`, "utf8");
  spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", cleanup], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  console.log("[StudioLink] Uninstall scheduled.");
}

function startInstalled(): void {
  const daemon = join(defaultInstallDir(), "studiolink-daemon.exe");
  if (!existsSync(daemon)) throw new Error(`Installed daemon not found at ${daemon}`);
  startProcess(daemon);
  console.log("[StudioLink] Daemon started.");
}

function printStatus(version: string): void {
  const installDir = defaultInstallDir();
  const daemon = join(installDir, "studiolink-daemon.exe");
  const roagent = join(installDir, "roagent", "roagent.exe");
  console.log(JSON.stringify({ version, installDir, installed: existsSync(daemon), roAgentInstalled: existsSync(roagent) }, null, 2));
}

function startProcess(file: string): void {
  spawn(file, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
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
