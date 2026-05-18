import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { AppError } from "../errors.ts";
import { ErrorCode, type AgentAction, type AgentStatus, type PlaceId, type ScriptRecord } from "../../../shared/protocol.ts";
import type { HandlerContext } from "../types.ts";

type ProcessKind = "posix" | "windows";

interface AgentProcessState {
  child?: ChildProcess;
  pid?: number;
  terminalId: string;
  launchedAt: string;
  lastSeenAt: string;
  placeId: PlaceId;
  persistentTerminal: boolean;
  processKind: ProcessKind;
  running: boolean;
}

interface TerminalLaunchResult {
  child?: ChildProcess;
  pid?: number;
  persistentTerminal: boolean;
  processKind: ProcessKind;
}

export class AgentService {
  private readonly recent = new Map<PlaceId, AgentAction[]>();
  private readonly processes = new Map<PlaceId, AgentProcessState>();

  status(placeId: PlaceId): AgentStatus {
    const state = this.processes.get(placeId);
    if (!state) return { running: false, placeId };
    const running = this.isStateRunning(state);
    state.running = running;
    state.lastSeenAt = new Date().toISOString();
    if (!running) this.processes.delete(placeId);
    return {
      running,
      pid: state.pid,
      terminalId: state.terminalId,
      launchedAt: state.launchedAt,
      lastSeenAt: state.lastSeenAt,
      placeId,
    };
  }

  async launch(placeId: PlaceId, context: HandlerContext): Promise<AgentStatus> {
    const existing = this.status(placeId);
    if (existing.running) return existing;

    const repoPath = context.placeStore.getPlaceDirectory(placeId);
    const scriptsDir = await this.materializeScripts(placeId, repoPath, context);
    const executable = this.resolveExecutable(context.config.repoRoot);
    const args = [
      "--studiolink",
      "--studiolink-place-id",
      placeId,
      "--studiolink-daemon-port",
      String(context.config.port),
      "--studiolink-auth-token",
      context.config.authToken,
      "--studiolink-scripts-dir",
      scriptsDir,
    ];

    try {
      const launched = this.spawnTerminal(executable, args, repoPath);
      const now = new Date().toISOString();
      const state: AgentProcessState = {
        child: launched.child,
        pid: launched.pid,
        terminalId: randomUUID(),
        launchedAt: now,
        lastSeenAt: now,
        placeId,
        persistentTerminal: launched.persistentTerminal,
        processKind: launched.processKind,
        running: true,
      };
      launched.child?.once("exit", () => {
        if (state.persistentTerminal) return;
        state.running = false;
        this.processes.delete(placeId);
      });
      launched.child?.once("error", (error) => {
        state.running = false;
        this.processes.delete(placeId);
        context.logger.error(context.logger.sanitizeError(error), "RoAgent terminal launch error");
      });
      launched.child?.unref();
      this.processes.set(placeId, state);
      this.recordAction(placeId, { timestamp: now, tool: "agent:launch", summary: `Opened RoAgent terminal for place ${placeId}` });
      return this.status(placeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.recordAction(placeId, { timestamp: new Date().toISOString(), tool: "agent:launch", summary: `RoAgent launch failed: ${message}` });
      throw new AppError(ErrorCode.AGENT_UNAVAILABLE, `Unable to launch RoAgent terminal: ${message}`);
    }
  }

  kill(placeId: PlaceId): { running: false; pid?: number; killedAt: string } {
    const state = this.processes.get(placeId);
    const killedAt = new Date().toISOString();
    if (state?.pid && this.isPidAliveForKind(state.pid, state.processKind)) {
      try {
        if (state.processKind === "windows") {
          this.killWindowsPid(state.pid);
        } else {
          try {
            process.kill(-state.pid, "SIGTERM");
          } catch {
            process.kill(state.pid, "SIGTERM");
          }
        }
      } catch {
        // The process may have exited between status and kill.
      }
    }
    if (state) state.running = false;
    this.processes.delete(placeId);
    this.recordAction(placeId, { timestamp: killedAt, tool: "agent:kill", summary: `Stopped RoAgent terminal for place ${placeId}` });
    return { running: false, pid: state?.pid, killedAt };
  }

  recordAction(placeId: PlaceId, action: Omit<AgentAction, "id"> & { id?: string }): AgentAction {
    const withId: AgentAction = { id: action.id ?? randomUUID(), ...action };
    const list = this.recent.get(placeId) ?? [];
    list.unshift(withId);
    this.recent.set(placeId, list.slice(0, 5));
    return withId;
  }

  recentActions(placeId: PlaceId): AgentAction[] {
    return [...(this.recent.get(placeId) ?? [])].slice(0, 5);
  }

  private async materializeScripts(placeId: PlaceId, repoPath: string, context: HandlerContext): Promise<string> {
    mkdirSync(repoPath, { recursive: true });
    const scriptsDir = path.join(repoPath, "scripts");
    rmSync(scriptsDir, { recursive: true, force: true });
    mkdirSync(scriptsDir, { recursive: true });
    const scripts = await context.placeStore.list(placeId, { includeSource: true, includeDeleted: false });
    const manifest: Array<{ path: string; file: string; className: string; versionId: string; updatedAt: string }> = [];
    for (const script of scripts) {
      const file = this.scriptFileName(script);
      writeFileSync(path.join(scriptsDir, file), script.source, "utf8");
      manifest.push({ path: script.path, file, className: script.className, versionId: script.versionId, updatedAt: script.updatedAt });
    }
    writeFileSync(path.join(scriptsDir, "roagent-place-manifest.json"), JSON.stringify({ placeId, scripts: manifest, syncedAt: new Date().toISOString() }, null, 2), "utf8");
    return scriptsDir;
  }

  private scriptFileName(script: ScriptRecord): string {
    const safe = script.path.replace(/[\\/:*?"<>|\0]/g, "_");
    return /\.(lua|luau)$/i.test(safe) ? safe : `${safe}.lua`;
  }

  private resolveExecutable(repoRoot: string): string {
    const candidates = [
      process.env.STUDIOLINK_ROAGENT_PATH,
      path.join(repoRoot, "dist", process.platform === "win32" ? "roagent.exe" : "roagent"),
      path.join(repoRoot, "roagent", "dist", process.platform === "win32" ? "roagent.exe" : "roagent"),
      process.platform === "win32" ? path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"), "Programs", "StudioLink", "roagent", "roagent.exe") : undefined,
      process.platform === "win32" ? "C:\\Program Files\\StudioLink\\roagent\\roagent.exe" : undefined,
    ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) throw new AppError(ErrorCode.AGENT_UNAVAILABLE, `RoAgent executable not found. Checked: ${candidates.join(", ")}`);
    return found;
  }

  private spawnTerminal(executable: string, args: string[], cwd: string): TerminalLaunchResult {
    if (process.platform === "win32") return this.spawnNativeWindowsTerminal(executable, args, cwd);
    if (this.isWsl()) return this.spawnWslWindowsTerminal(executable, args, cwd);
    return this.spawnLinuxTerminal(executable, args, cwd);
  }

  private spawnNativeWindowsTerminal(executable: string, args: string[], cwd: string): TerminalLaunchResult {
    const commandLine = ["call", this.quoteCmdArg(executable), ...args.map((arg) => this.quoteCmdArg(arg))].join(" ");
    const pid = this.spawnWindowsCmd(commandLine, cwd);
    return { pid, persistentTerminal: false, processKind: "windows" };
  }

  private spawnWslWindowsTerminal(executable: string, args: string[], cwd: string): TerminalLaunchResult {
    const shellCommand = this.buildRoAgentShellCommand(executable, args, cwd);
    const commandLine = ["call", "wsl.exe", "--cd", this.quoteCmdArg(cwd), "--", "bash", "-lc", this.quoteCmdArg(shellCommand)].join(" ");
    const pid = this.spawnWindowsCmd(commandLine);
    return { pid, persistentTerminal: false, processKind: "windows" };
  }

  private spawnLinuxTerminal(executable: string, args: string[], cwd: string): TerminalLaunchResult {
    const scriptCommand = this.buildRoAgentShellCommand(executable, args, cwd);
    const terminal = this.findLinuxTerminal();
    if (terminal) {
      const child = this.spawnLinuxTerminalCommand(terminal, scriptCommand, cwd);
      return { child, pid: child.pid, persistentTerminal: false, processKind: "posix" };
    }
    const scriptBin = ["/usr/bin/script", "/bin/script"].find((candidate) => existsSync(candidate));
    if (scriptBin) {
      const child = spawn(scriptBin, ["-q", "-c", scriptCommand, "/dev/null"], { cwd, detached: true, stdio: "ignore" });
      return { child, pid: child.pid, persistentTerminal: false, processKind: "posix" };
    }
    const child = spawn(executable, args, { cwd, detached: true, stdio: "ignore" });
    return { child, pid: child.pid, persistentTerminal: false, processKind: "posix" };
  }

  private buildRoAgentShellCommand(executable: string, args: string[], cwd: string): string {
    const roAgentCommand = [executable, ...args].map((arg) => this.quoteShellArg(arg)).join(" ");
    return [
      `cd ${this.quoteShellArg(cwd)}`,
      'echo "Starting RoAgent..."',
      roAgentCommand,
      "code=$?",
      "echo",
      'echo "RoAgent exited with code $code."',
      'echo "If this was unexpected, check API key/config and daemon logs."',
      'echo "Press Enter to close this window."',
      "read -r _",
    ].join("; ");
  }

  private spawnWindowsCmd(commandLine: string, workingDirectory?: string): number {
    const workingDirectoryArg = workingDirectory ? ` -WorkingDirectory ${this.quotePowerShellString(workingDirectory)}` : "";
    const script = [
      `$p = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d','/k',${this.quotePowerShellString(commandLine)})${workingDirectoryArg} -WindowStyle Normal -PassThru`,
      "Write-Output $p.Id",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { encoding: "utf8", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr?.trim() || "PowerShell Start-Process failed");
    const pid = Number.parseInt(result.stdout.trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`PowerShell did not return a valid RoAgent PID: ${result.stdout.trim()}`);
    return pid;
  }

  private findLinuxTerminal(): string | undefined {
    return ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"].find((candidate) => {
      const result = spawnSync("/usr/bin/env", ["which", candidate], { stdio: "ignore" });
      return result.status === 0;
    });
  }

  private spawnLinuxTerminalCommand(terminal: string, command: string, cwd: string): ChildProcess {
    if (terminal === "gnome-terminal") return spawn(terminal, ["--", "bash", "-lc", command], { cwd, detached: true, stdio: "ignore" });
    if (terminal === "konsole") return spawn(terminal, ["-e", "bash", "-lc", command], { cwd, detached: true, stdio: "ignore" });
    return spawn(terminal, ["-e", "bash", "-lc", command], { cwd, detached: true, stdio: "ignore" });
  }

  private isWsl(): boolean {
    if (process.env.WSL_DISTRO_NAME) return true;
    try {
      return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
    } catch {
      return false;
    }
  }

  private quoteCmdArg(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  private quoteShellArg(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }

  private quotePowerShellString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private isStateRunning(state: AgentProcessState): boolean {
    if (!state.running) return false;
    if (state.persistentTerminal) return true;
    return state.pid ? this.isPidAliveForKind(state.pid, state.processKind) : false;
  }

  private isPidAliveForKind(pid: number, processKind: ProcessKind): boolean {
    return processKind === "windows" ? this.isWindowsPidAlive(pid) : this.isPidAlive(pid);
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private isWindowsPidAlive(pid: number): boolean {
    const command = process.platform === "win32" ? "tasklist" : "tasklist.exe";
    const result = spawnSync(command, ["/FI", `PID eq ${pid}`, "/NH"], { encoding: "utf8", windowsHide: true });
    if (result.error || result.status !== 0) return false;
    return result.stdout.includes(String(pid));
  }

  private killWindowsPid(pid: number): void {
    const command = process.platform === "win32" ? "taskkill" : "taskkill.exe";
    spawnSync(command, ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  }
}
