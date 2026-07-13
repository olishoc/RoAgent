import { invoke } from "@tauri-apps/api/core";
import "./styles.css";
import markUrl from "./studiolink-icon.png";

type JsonRecord = Record<string, unknown>;
type ViewName = "Status" | "Projects" | "Studio Setup" | "Code" | "Debugger" | "Daemon" | "Logs";

interface AppStatus {
  platform: string;
  installDir: string;
  dataDir: string;
  daemonPath: string;
  commandShimPath: string;
  robloxPluginsDir: string;
  bridgePluginPath: string;
  daemonInstalled: boolean;
  commandShimInstalled: boolean;
  bridgePluginInstalled: boolean;
  daemonReachable: boolean;
  authTokenAvailable: boolean;
  health?: JsonRecord | null;
  installedStatus?: JsonRecord | null;
  lastError?: string | null;
}

interface ProjectSummary {
  placeId: string;
  placeName?: string | null;
  gameId?: string | null;
  jobId?: string | null;
  placeDir: string;
  repoDir: string;
  hasRepo: boolean;
  active?: boolean;
  scriptsCount: number;
  totalBytes: number;
  updatedAt?: string | null;
}

interface ScriptSummary {
  path: string;
  uniqueId?: string;
  className: string;
  size: number;
  versionId: string;
  updatedAt: string;
  deleted: boolean;
  source?: string;
  pendingStudioDeploy?: boolean;
}

interface RpcEnvelope {
  version: "1";
  type: string;
  requestId: string;
  placeId: string;
  payload: JsonRecord;
}

interface ActionResult {
  success: boolean;
  message: string;
  status: AppStatus;
}

type ActionName =
  | "start_daemon"
  | "stop_daemon"
  | "restart_daemon"
  | "check_updates"
  | "repair_daemon"
  | "install_bridge_plugin"
  | "reveal_plugin_folder"
  | "open_downloads"
  | "reveal_logs";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app root");
const appRoot = app;

const views: ViewName[] = ["Status", "Projects", "Studio Setup", "Code", "Debugger", "Daemon", "Logs"];
let status: AppStatus | null = null;
let projects: ProjectSummary[] = [];
let projectScripts: ScriptSummary[] = [];
let selectedProjectId = "";
let selectedScriptPath = "";
let licenseStatus: JsonRecord | null = null;
let githubStatus: JsonRecord | null = null;
let gitStatus: JsonRecord | null = null;
let agentStatus: JsonRecord | null = null;
let githubDevice: JsonRecord | null = null;
let busyAction = "";
let selectedView: ViewName = "Status";
let booting = true;
let events: string[] = [];

function hasTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function getRecord(input: unknown): JsonRecord | null {
  return input && typeof input === "object" && !Array.isArray(input) ? input as JsonRecord : null;
}

function getString(record: unknown, key: string, fallback = "Unknown"): string {
  const value = getRecord(record)?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getBool(record: unknown, key: string): boolean {
  return getRecord(record)?.[key] === true;
}

function getNumber(record: unknown, key: string): number | null {
  const value = getRecord(record)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNested(record: unknown, key: string): JsonRecord | null {
  return getRecord(getRecord(record)?.[key]);
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "Not running";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value?: string | null): string {
  if (!value) return "No sync";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function addEvent(message: string): void {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  events = [`${time}  ${message}`, ...events].slice(0, 12);
}

async function loadStatus(silent = false): Promise<void> {
  try {
    if (hasTauriRuntime()) {
      status = await invoke<AppStatus>("app_status");
    } else {
      const response = await fetch("http://127.0.0.1:45678/health").catch(() => null);
      const health = response?.ok ? await response.json() as JsonRecord : null;
      status = {
        platform: navigator.platform,
        installDir: "Tauri runtime required",
        dataDir: "Tauri runtime required",
        daemonPath: "Open in StudioLink Mission Control",
        commandShimPath: "Open in StudioLink Mission Control",
        robloxPluginsDir: "Open in StudioLink Mission Control",
        bridgePluginPath: "Open in StudioLink Mission Control",
        daemonInstalled: false,
        commandShimInstalled: false,
        bridgePluginInstalled: false,
        daemonReachable: Boolean(health),
        authTokenAvailable: false,
        health,
        installedStatus: null,
        lastError: hasTauriRuntime() ? null : "Browser preview. Native controls unlock inside the Tauri app.",
      };
    }
    if (!silent) addEvent(status.daemonReachable ? "Daemon status refreshed." : "Daemon offline or not installed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (status) status.lastError = message;
    addEvent(message);
  }
}

async function loadProjects(silent = false): Promise<void> {
  if (!hasTauriRuntime()) {
    projects = [];
    return;
  }
  try {
    const payload = await daemonRpc("project:list", "__global__", { includeInactive: true });
    const daemonProjects = Array.isArray(payload.projects) ? payload.projects.filter(isProjectSummary) : [];
    projects = daemonProjects.map(normalizeProject).sort(compareProjects);
    reconcileSelectedProject();
    if (!silent) addEvent(`Daemon reported ${projects.length} Roblox project${projects.length === 1 ? "" : "s"}.`);
  } catch {
    try {
      const cachedProjects = await invoke<ProjectSummary[]>("list_projects");
      projects = cachedProjects.filter(isProjectSummary).map(normalizeProject).sort(compareProjects);
      reconcileSelectedProject();
      if (!silent) addEvent(`Indexed ${projects.length} cached Roblox project${projects.length === 1 ? "" : "s"}.`);
    } catch (error) {
      addEvent(error instanceof Error ? error.message : String(error));
    }
  }
}

function reconcileSelectedProject(): void {
  if (selectedProjectId && projects.some((project) => project.placeId === selectedProjectId)) return;
  selectedProjectId = projects[0]?.placeId ?? "";
  selectedScriptPath = "";
}

function normalizeProject(project: ProjectSummary): ProjectSummary {
  return {
    ...project,
    placeName: project.placeName || null,
    gameId: project.gameId || null,
    jobId: project.jobId || null,
    active: project.active === true,
    scriptsCount: Number(project.scriptsCount) || 0,
    totalBytes: Number(project.totalBytes) || 0,
    updatedAt: project.updatedAt || null,
  };
}

function compareProjects(left: ProjectSummary, right: ProjectSummary): number {
  if (left.active !== right.active) return left.active ? -1 : 1;
  return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "") || projectLabel(left).localeCompare(projectLabel(right));
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  const record = getRecord(value);
  return typeof record?.placeId === "string" && typeof record.placeDir === "string" && typeof record.repoDir === "string";
}

function projectLabel(project: ProjectSummary): string {
  return project.placeName || project.placeId;
}

function projectSessionLabel(project: ProjectSummary): string {
  if (project.active) return "live studio";
  return "cached place";
}

function projectGameLabel(project: ProjectSummary): string {
  if (project.gameId && project.gameId !== "0") return project.gameId;
  return "universe pending";
}

function selectedProject(): ProjectSummary | undefined {
  return projects.find((candidate) => candidate.placeId === selectedProjectId) ?? projects[0];
}

async function revealProject(target: "place" | "repo"): Promise<void> {
  const project = selectedProject();
  if (!project) {
    addEvent("No Roblox project selected.");
    render();
    return;
  }
  busyAction = `reveal_project_${target}`;
  render();
  try {
    const result = await invoke<ActionResult>("reveal_project", { placeId: project.placeId, target });
    status = result.status;
    addEvent(result.message);
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

async function openSelectedProjectInCode(): Promise<void> {
  const project = selectedProject();
  if (!project) return;
  selectedProjectId = project.placeId;
  selectedView = "Code";
  await loadSetupStatus();
  render();
}

async function daemonRpc(messageType: string, placeId = "__global__", payload: JsonRecord = {}): Promise<JsonRecord> {
  const envelope = await invoke<RpcEnvelope>("daemon_rpc", { messageType, placeId, payload });
  if (envelope.type === "error" || envelope.type === "license:error") {
    const message = typeof envelope.payload?.message === "string" ? envelope.payload.message : `Daemon RPC failed: ${messageType}`;
    throw new Error(message);
  }
  return envelope.payload ?? {};
}

async function loadSetupStatus(): Promise<void> {
  if (!hasTauriRuntime() || !status?.authTokenAvailable) return;
  const globalCalls = [
    daemonRpc("license:status").then((payload) => { licenseStatus = payload; }).catch(() => null),
    daemonRpc("git:githubStatus").then((payload) => { githubStatus = payload; }).catch(() => null),
  ];
  const placeId = selectedProjectId || projects[0]?.placeId;
  if (placeId) {
    globalCalls.push(
      daemonRpc("project:scripts", placeId, { includeSource: true, includeDeleted: false }).then((payload) => {
        const project = getRecord(payload.project);
        if (project && isProjectSummary(project)) {
          projects = [normalizeProject(project), ...projects.filter((candidate) => candidate.placeId !== project.placeId)].sort(compareProjects);
        }
        const scripts = Array.isArray(payload.scripts) ? payload.scripts : [];
        projectScripts = scripts.filter((script): script is ScriptSummary => Boolean(getRecord(script)?.path));
        if (!selectedScriptPath && projectScripts[0]) selectedScriptPath = projectScripts[0].path;
      }).catch(() => { projectScripts = []; selectedScriptPath = ""; }),
      daemonRpc("git:status", placeId).then((payload) => { gitStatus = payload; }).catch(() => null),
      daemonRpc("agent:status", placeId).then((payload) => { agentStatus = payload; }).catch(() => null),
    );
  } else {
    projectScripts = [];
    selectedScriptPath = "";
  }
  await Promise.all(globalCalls);
}

async function refreshAll(silent = false): Promise<void> {
  await Promise.all([loadStatus(silent), loadProjects(true)]);
  await loadSetupStatus();
  render();
}

async function boot(): Promise<void> {
  const started = performance.now();
  render();
  await refreshAll(true);
  const remaining = Math.max(0, 760 - (performance.now() - started));
  window.setTimeout(() => {
    booting = false;
    addEvent("StudioLink command shell initialized.");
    render();
  }, remaining);
}

async function runAction(action: ActionName): Promise<void> {
  if (!hasTauriRuntime()) {
    addEvent("Native daemon controls require the Tauri desktop runtime.");
    render();
    return;
  }
  busyAction = action;
  render();
  try {
    const result = await invoke<ActionResult>(action);
    status = result.status;
    addEvent(result.message);
    await loadProjects(true);
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

async function setAutostart(enabled: boolean): Promise<void> {
  if (!hasTauriRuntime()) {
    addEvent("Autostart changes require the desktop app.");
    render();
    return;
  }
  busyAction = "set_autostart";
  render();
  try {
    const result = await invoke<ActionResult>("set_autostart", { enabled });
    status = result.status;
    addEvent(result.message);
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

async function saveAiConfig(form: HTMLFormElement): Promise<void> {
  if (!hasTauriRuntime()) {
    addEvent("AI setup requires the desktop app.");
    render();
    return;
  }
  const data = new FormData(form);
  busyAction = "save_ai_config";
  render();
  try {
    const result = await invoke<ActionResult>("save_ai_config", {
      provider: String(data.get("provider") || "openai"),
      apiKey: String(data.get("apiKey") || ""),
      model: String(data.get("model") || ""),
      aiMaxTokens: Number(data.get("aiMaxTokens") || 8000),
    });
    status = result.status;
    addEvent(result.message);
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

async function activateLicense(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  busyAction = "license:activate";
  render();
  try {
    licenseStatus = await daemonRpc("license:activate", "__global__", { licenseKey: String(data.get("licenseKey") || "") });
    addEvent("License activation request completed.");
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

async function startGithubDeviceFlow(): Promise<void> {
  busyAction = "git:githubDeviceStart";
  render();
  try {
    githubDevice = await daemonRpc("git:githubDeviceStart");
    addEvent(`GitHub device code ready: ${String(githubDevice.userCode ?? "unknown")}`);
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

async function pollGithubDeviceFlow(): Promise<void> {
  if (!githubDevice?.deviceCode) return;
  busyAction = "git:githubDevicePoll";
  render();
  try {
    githubStatus = await daemonRpc("git:githubDevicePoll", "__global__", { deviceCode: githubDevice.deviceCode });
    addEvent(githubStatus.pending ? "GitHub approval still pending." : "GitHub authorization refreshed.");
    if (!githubStatus.pending) githubDevice = null;
  } catch (error) {
    addEvent(error instanceof Error ? error.message : String(error));
  } finally {
    busyAction = "";
    render();
  }
}

function statusLevel(): "online" | "warn" | "offline" {
  if (!status) return "warn";
  if (status.daemonReachable && status.authTokenAvailable) return "online";
  if (status.daemonInstalled) return "warn";
  return "offline";
}

function statusText(): string {
  if (!status) return "BOOT";
  if (status.daemonReachable && status.authTokenAvailable) return "LINK ONLINE";
  if (status.daemonReachable) return "RPC LIMITED";
  if (status.daemonInstalled) return "DAEMON STOPPED";
  return "DAEMON MISSING";
}

function card(label: string, value: string, meta: string, level: "online" | "warn" | "offline" | "neutral" = "neutral"): string {
  return `<article class="metric ${level}">
    <span>${label}</span>
    <strong>${escapeHtml(value)}</strong>
    <small>${escapeHtml(meta)}</small>
  </article>`;
}

function actionButton(label: string, action: ActionName, variant = ""): string {
  const busy = busyAction === action;
  return `<button class="control ${variant}" data-action="${action}" ${busyAction ? "disabled" : ""}>${busy ? "BUSY" : escapeHtml(label)}</button>`;
}

function pathLine(label: string, value: string): string {
  return `<div class="path-line"><span>${escapeHtml(label)}</span><code title="${escapeHtml(value)}">${escapeHtml(value)}</code></div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

function renderMenu(): string {
  return `<div class="menu-strip" data-tauri-drag-region>
    <div class="menus">
      ${["Fichier", "Edition", "Affichage", "Projet", "Terminal", "Aide"].map((item) => `<button>${item}</button>`).join("")}
    </div>
    <div class="menu-telemetry">
      <span>STUDIOLINK/LOCALHOST:45678</span>
      <b class="${statusLevel()}">${statusText()}</b>
    </div>
  </div>`;
}

function renderLoading(): string {
  return `<div class="loader">
    <div class="loader-core">
      <img src="${markUrl}" alt="StudioLink" />
      <div>
        <p>BOOT SEQUENCE</p>
        <h1>STUDIOLINK CONTROL</h1>
      </div>
    </div>
    <div class="boot-lines">
      <span>[01] mounting transparent shell</span>
      <span>[02] probing daemon process</span>
      <span>[03] requesting daemon project index</span>
      <span>[04] arming bridge-only Studio control</span>
    </div>
    <div class="scanbar"><span></span></div>
  </div>`;
}

function renderSidebar(): string {
  return `<aside class="sidebar">
    <div class="brand">
      <img src="${markUrl}" alt="StudioLink" />
      <div>
        <strong>StudioLink</strong>
        <span>Roblox operator shell</span>
      </div>
    </div>
    <nav class="nav">
      ${views.map((item, index) => `
        <button class="${selectedView === item ? "active" : ""}" data-view="${item}">
          <small>0${index + 1}</small><span>${item}</span>
        </button>
      `).join("")}
    </nav>
    <div class="sidebar-footer">
      <span class="subtle">Runtime</span>
      <strong>${escapeHtml(status?.platform ?? "Detecting")}</strong>
      <em>${hasTauriRuntime() ? "native shell" : "browser preview"}</em>
    </div>
  </aside>`;
}

function renderHeader(): string {
  return `<header class="topbar">
    <div>
      <p class="eyebrow">ROBLOX STUDIO LINK // LOCAL CONTROL</p>
      <h1>${selectedView}</h1>
    </div>
    <div class="status-pill ${statusLevel()}">
      <span></span>
      ${statusText()}
    </div>
  </header>`;
}

function renderMetrics(): string {
  const health = status?.health ?? null;
  const installed = status?.installedStatus ?? null;
  const update = getNested(health, "update");
  const updateCheck = getNested(update, "check");
  const updateState = getString(update, "state", "idle");
  const roAgentInstalled = getBool(health, "roAgentInstalled") || getBool(installed, "roAgentInstalled");
  const activeProjects = projects.filter((project) => project.active).length;
  return `<section class="grid metrics">
    ${card("Daemon", status?.daemonReachable ? "ONLINE" : status?.daemonInstalled ? "STOPPED" : "MISSING", formatUptime(getNumber(health, "uptime")), statusLevel())}
    ${card("Projects", `${projects.length}`, `${activeProjects} live Studio session${activeProjects === 1 ? "" : "s"}`, projects.length > 0 ? "online" : "warn")}
    ${card("RoAgent", roAgentInstalled ? "ARMED" : "MISSING", getString(health, "roAgentPath", "Waiting for installer"), roAgentInstalled ? "online" : "warn")}
    ${card("Updates", updateState.toUpperCase(), getString(updateCheck, "latestReleaseTag", getString(health, "releaseTag", "dev")), updateState === "failed" ? "offline" : "neutral")}
  </section>`;
}

function renderStatusPage(): string {
  const health = status?.health ?? null;
  const installed = status?.installedStatus ?? null;
  const autostart = getBool(installed, "autostartEnabled");
  const version = getString(health, "version", "3.0.0");
  const releaseTag = getString(health, "releaseTag", "dev");
  const gitInstalled = getBool(health, "gitInstalled");
  const license = getString(health, "licenseStatus", "unknown");
  return `${renderMetrics()}
    <section class="workspace">
      <div class="panel primary-panel">
        <div class="panel-head">
          <div><p class="eyebrow">CONTROL PLANE</p><h2>Daemon operations</h2></div>
          <button class="ghost" data-refresh ${busyAction ? "disabled" : ""}>REFRESH</button>
        </div>
        <div class="control-row">
          ${actionButton("START", "start_daemon", "primary")}
          ${actionButton("RESTART", "restart_daemon")}
          ${actionButton("STOP", "stop_daemon")}
          ${actionButton("CHECK UPDATE", "check_updates")}
          ${actionButton("REPAIR", "repair_daemon")}
        </div>
        <div class="toggle-row">
          <button class="toggle ${autostart ? "on" : ""}" data-autostart="${autostart ? "off" : "on"}" ${busyAction ? "disabled" : ""}><span></span>${autostart ? "AUTOSTART ON" : "AUTOSTART OFF"}</button>
          ${actionButton("DOWNLOADS", "open_downloads")}
          ${actionButton("LOGS", "reveal_logs")}
        </div>
        <div class="info-list">
          ${pathLine("Install", status?.installDir ?? "Detecting")}
          ${pathLine("Daemon", status?.daemonPath ?? "Detecting")}
          ${pathLine("Data", status?.dataDir ?? "Detecting")}
          ${pathLine("Command", status?.commandShimPath ?? "Detecting")}
        </div>
        ${status?.lastError ? `<div class="alert">${escapeHtml(status.lastError)}</div>` : ""}
      </div>
      <div class="panel readout-panel">
        <div class="panel-head">
          <div><p class="eyebrow">SYSTEM READOUT</p><h2>Runtime telemetry</h2></div>
          <span class="badge">LOCAL</span>
        </div>
        <div class="readout">
          <span>Version</span><strong>${escapeHtml(version)}</strong>
          <span>Release</span><strong>${escapeHtml(releaseTag)}</strong>
          <span>Git</span><strong>${gitInstalled ? "AVAILABLE" : "MISSING"}</strong>
          <span>License</span><strong>${escapeHtml(license.toUpperCase())}</strong>
          <span>Auth token</span><strong>${status?.authTokenAvailable ? "AVAILABLE" : "LOCKED"}</strong>
          <span>Shim</span><strong>${status?.commandShimInstalled ? "INSTALLED" : "MISSING"}</strong>
        </div>
      </div>
    </section>`;
}

function renderProjectsPage(): string {
  const selected = selectedProject();
  const rows = projects.length
    ? projects.map((project) => `<button class="project-row ${selectedProjectId === project.placeId ? "selected" : ""}" data-place-id="${escapeHtml(project.placeId)}">
        <span class="project-name"><strong>${escapeHtml(projectLabel(project))}</strong><small>${escapeHtml(project.placeId)}</small></span>
        <span><b class="session-chip ${project.active ? "live" : "cached"}">${escapeHtml(projectSessionLabel(project))}</b></span>
        <span>${escapeHtml(projectGameLabel(project))}</span>
        <span>${project.scriptsCount} scripts</span>
        <span>${formatBytes(project.totalBytes)}</span>
        <span>${escapeHtml(formatDate(project.updatedAt))}</span>
      </button>`).join("")
    : `<div class="empty-state">
        <strong>NO ROBLOX PROJECTS INDEXED</strong>
        <p>Open Roblox Studio with the StudioLink bridge enabled. The daemon will create a place cache after the first script snapshot sync.</p>
      </div>`;
  return `${renderMetrics()}
    <section class="project-board">
      <div class="panel project-list-panel">
        <div class="panel-head">
          <div><p class="eyebrow">DAEMON PROJECT INDEX</p><h2>Roblox projects</h2></div>
          <button class="ghost" data-refresh>RESCAN</button>
        </div>
        <div class="project-table">
          <div class="project-head"><span>Project</span><span>State</span><span>Game</span><span>Scripts</span><span>Bytes</span><span>Last sync</span></div>
          ${rows}
        </div>
      </div>
      <div class="panel project-detail-panel">
        ${selected ? renderProjectDetail(selected) : `<div class="empty-state"><strong>NO PROJECT SELECTED</strong><p>Open Studio with the bridge-only plugin to seed the daemon index.</p></div>`}
      </div>
    </section>`;
}

function renderProjectDetail(project: ProjectSummary): string {
  const jobId = project.jobId && project.jobId !== "" ? project.jobId : "no live job";
  return `<div class="project-detail">
    <div class="panel-head">
      <div><p class="eyebrow">SELECTED PLACE</p><h2>${escapeHtml(projectLabel(project))}</h2></div>
      <span class="badge ${project.active ? "" : "warn"}">${escapeHtml(projectSessionLabel(project))}</span>
    </div>
    <div class="project-scan">
      <div><span>Place</span><strong>${escapeHtml(project.placeId)}</strong></div>
      <div><span>Game</span><strong>${escapeHtml(projectGameLabel(project))}</strong></div>
      <div><span>Job</span><strong>${escapeHtml(jobId)}</strong></div>
      <div><span>Repo</span><strong>${project.hasRepo ? "available" : "not initialized"}</strong></div>
      <div><span>Scripts</span><strong>${project.scriptsCount}</strong></div>
      <div><span>Bytes</span><strong>${formatBytes(project.totalBytes)}</strong></div>
    </div>
    <div class="control-row compact">
      <button class="control primary" data-project-action="code">OPEN CODE SURFACE</button>
      <button class="control" data-project-action="place">CACHE FOLDER</button>
      <button class="control" data-project-action="repo" ${project.hasRepo ? "" : "disabled"}>REPO FOLDER</button>
    </div>
    <div class="micro-readout path-readout">
      <span>Cache</span><code>${escapeHtml(project.placeDir)}</code>
      <span>Repo</span><code>${escapeHtml(project.repoDir)}</code>
    </div>
  </div>`;
}

function renderSetupPage(): string {
  const license = String(licenseStatus?.status ?? getString(status?.health, "licenseStatus", "unknown")).toUpperCase();
  const githubLogin = typeof githubStatus?.githubLogin === "string" ? githubStatus.githubLogin : "not signed in";
  const hasGithubToken = githubStatus?.hasToken === true;
  const githubCode = typeof githubDevice?.userCode === "string" ? githubDevice.userCode : "";
  const verificationUri = typeof githubDevice?.verificationUri === "string" ? githubDevice.verificationUri : "https://github.com/login/device";
  const bridgeInstalled = status?.bridgePluginInstalled === true;
  return `<section class="setup-grid">
    <div class="panel">
      <div class="panel-head"><div><p class="eyebrow">DESKTOP OWNED SETUP</p><h2>Control transfer</h2></div><span class="badge warn">IN PROGRESS</span></div>
      <ol class="checklist">
        <li class="done"><span></span><div><strong>Local daemon control moved to Tauri</strong><small>Start, stop, repair, update, logs, and downloads live in this shell.</small></div></li>
        <li class="${bridgeInstalled ? "done" : "active"}"><span></span><div><strong>Bridge-only Roblox plugin installer</strong><small>${bridgeInstalled ? "Installed in the local Roblox Plugins folder." : "Install the bridge from StudioLink, not by copying code from Studio."}</small></div></li>
        <li class="active"><span></span><div><strong>Desktop owns setup flows</strong><small>AI provider, GitHub login, license, history, and agent actions now call daemon RPC from this shell.</small></div></li>
        <li><span></span><div><strong>VS Code fork shell</strong><small>StudioLink editor becomes a true VS Code fork with Roblox extensions wired in.</small></div></li>
      </ol>
    </div>
    <div class="panel setup-card">
      <div class="panel-head"><div><p class="eyebrow">ROBLOX BRIDGE</p><h2>${bridgeInstalled ? "Installed" : "Not installed"}</h2></div><span class="badge">${bridgeInstalled ? "BRIDGE READY" : "LOCAL PLUGIN"}</span></div>
      <p class="setup-note">Writes the bridge-only StudioLink plugin directly to Roblox Studio's local plugin folder. Reload Studio after installing.</p>
      <div class="control-row compact">
        ${actionButton(bridgeInstalled ? "REINSTALL BRIDGE" : "INSTALL BRIDGE", "install_bridge_plugin", "primary")}
        ${actionButton("OPEN FOLDER", "reveal_plugin_folder")}
      </div>
      <div class="micro-readout path-readout"><span>Plugin</span><code>${escapeHtml(status?.bridgePluginPath ?? "Detecting")}</code><span>Folder</span><code>${escapeHtml(status?.robloxPluginsDir ?? "Detecting")}</code></div>
    </div>
    <div class="panel setup-card">
      <div class="panel-head"><div><p class="eyebrow">AI PROVIDER</p><h2>Agent key</h2></div><span class="badge">KEYCHAIN</span></div>
      <form class="setup-form" data-form="ai">
        <label>Provider<select name="provider"><option value="openai">openai</option><option value="anthropic">anthropic</option><option value="openrouter">openrouter</option></select></label>
        <label>Model<input name="model" value="gpt-4.1" autocomplete="off" /></label>
        <label>Max tokens<input name="aiMaxTokens" type="number" value="8000" min="1024" step="512" /></label>
        <label>API key<input name="apiKey" type="password" placeholder="stored in system keychain" autocomplete="off" /></label>
        <button class="control primary" type="submit" ${busyAction ? "disabled" : ""}>SAVE AI CONFIG</button>
      </form>
    </div>
    <div class="panel setup-card">
      <div class="panel-head"><div><p class="eyebrow">LICENSE</p><h2>${escapeHtml(license)}</h2></div><span class="badge">${escapeHtml(String(licenseStatus?.plan ?? "LOCAL"))}</span></div>
      <form class="setup-form" data-form="license">
        <label>License key<input name="licenseKey" type="password" placeholder="SL-XXXX-XXXX-XXXX" autocomplete="off" /></label>
        <button class="control primary" type="submit" ${busyAction ? "disabled" : ""}>ACTIVATE LICENSE</button>
      </form>
      <div class="micro-readout"><span>Machine</span><code>${escapeHtml(String(licenseStatus?.machineId ?? "daemon required"))}</code></div>
    </div>
    <div class="panel setup-card">
      <div class="panel-head"><div><p class="eyebrow">GITHUB</p><h2>${escapeHtml(String(githubLogin))}</h2></div><span class="badge">${hasGithubToken ? "TOKEN READY" : "NO TOKEN"}</span></div>
      <div class="control-row">
        <button class="control primary" data-setup-action="github-start" ${busyAction ? "disabled" : ""}>START DEVICE FLOW</button>
        <button class="control" data-setup-action="github-poll" ${busyAction || !githubDevice ? "disabled" : ""}>POLL APPROVAL</button>
      </div>
      ${githubCode ? `<div class="device-code"><span>Open</span><code>${escapeHtml(verificationUri)}</code><span>Code</span><strong>${escapeHtml(githubCode)}</strong></div>` : `<p class="setup-note">GitHub device auth is now launched from StudioLink, not the Roblox plugin.</p>`}
    </div>
    <div class="panel terminal-card">
      <div class="panel-head"><div><p class="eyebrow">REQUIRED STUDIO SETTINGS</p><h2>HTTP access</h2></div></div>
      <pre><code>Roblox Studio -> Game Settings -> Security
  [x] Allow HTTP Requests

Local endpoint:
  http://127.0.0.1:45678/rpc

Plugin responsibility:
  scan scripts
  publish snapshots
  apply desktop-authored script changes
  no DockWidget UI
  no setup forms inside Studio</code></pre>
    </div>
  </section>`;
}

function renderCodePage(): string {
  const project = selectedProject();
  const placeLabel = project ? projectLabel(project) : "no-place";
  const activeScript = projectScripts.find((script) => script.path === selectedScriptPath) ?? projectScripts[0];
  const scriptTree = projectScripts.length
    ? projectScripts.slice(0, 28).map((script) => `<li class="file ${activeScript?.path === script.path ? "active" : ""}" data-script-path="${escapeHtml(script.path)}">${escapeHtml(script.path)}</li>`).join("")
    : `<li class="folder dim">No daemon script list yet</li>`;
  const source = activeScript?.source || `-- Waiting for script source from ${placeLabel}\n-- Start the daemon and open Roblox Studio with the bridge plugin.`;
  const numberedSource = source.split("\n").slice(0, 80).map((line, index) => `<span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(line)}`).join("\n");
  const clean = gitStatus?.clean === true ? "clean" : gitStatus ? "dirty" : "git pending";
  const agent = agentStatus?.running === true ? "agent running" : "agent stopped";
  return `<section class="ide-layout">
    <div class="ide-rail">
      <button class="active">EXPLORER</button><button>SEARCH</button><button>GIT</button><button>RUN</button><button>AI</button>
    </div>
    <div class="file-tree">
      <div class="tree-title">STUDIOLINK:${escapeHtml(placeLabel)}</div>
      <ul>
        ${scriptTree}
      </ul>
    </div>
    <div class="editor-zone">
      <div class="editor-tabs"><span class="active">${escapeHtml(activeScript?.path ?? "StudioLink.plan")}</span><span>${escapeHtml(clean)}</span><span>${escapeHtml(agent)}</span><span>${project ? escapeHtml(projectSessionLabel(project)) : "no project"}</span></div>
      <div class="editor-grid">
        <pre class="code-window"><code>${numberedSource}</code></pre>
        <aside class="suggestions">
          <h3>AI SUGGESTIONS</h3>
          <button ${activeScript ? "" : "disabled"}>Refactor selected service</button>
          <button ${activeScript ? "" : "disabled"}>Generate ModuleScript tests</button>
          <button ${activeScript ? "" : "disabled"}>Explain remote event flow</button>
          <button ${activeScript ? "" : "disabled"}>Patch and deploy to Studio</button>
        </aside>
      </div>
      <div class="terminal">
        <span>PS C:\\StudioLink\\${escapeHtml(placeLabel)}&gt;</span> ${projectScripts.length} scripts indexed; VS Code fork integration pending...
      </div>
    </div>
  </section>`;
}

function renderDebuggerPage(): string {
  return `<section class="debug-grid">
    <div class="panel"><div class="panel-head"><div><p class="eyebrow">DEBUGGER</p><h2>Breakpoints</h2></div><span class="badge">DESIGN PASS</span></div>
      <div class="debug-list"><span>ServerScriptService.Main:24</span><b>conditional</b><span>ReplicatedStorage.Net:88</span><b>armed</b><span>StarterPlayerScripts.Client:12</span><b>disabled</b></div>
    </div>
    <div class="panel"><div class="panel-head"><div><p class="eyebrow">WATCH</p><h2>Runtime values</h2></div></div>
      <pre><code>player.UserId      pending
remote.Name        pending
script.SourceHash  pending
agent.patchState   pending</code></pre>
    </div>
    <div class="panel wide"><div class="panel-head"><div><p class="eyebrow">CONSOLE</p><h2>Roblox output bridge</h2></div></div>
      <div class="console-lines"><span>[debug] debugger endpoint planned after plugin bridge split</span><span>[trace] VS Code debug adapter will attach here</span><span>[warn] current daemon protocol has script/git/agent ops, no breakpoints yet</span></div>
    </div>
  </section>`;
}

function renderDaemonPage(): string {
  return `<section class="workspace single">
    <div class="panel primary-panel">
      <div class="panel-head"><div><p class="eyebrow">DAEMON</p><h2>Native process control</h2></div><button class="ghost" data-refresh>REFRESH</button></div>
      <div class="control-row">
        ${actionButton("START", "start_daemon", "primary")}
        ${actionButton("RESTART", "restart_daemon")}
        ${actionButton("STOP", "stop_daemon")}
        ${actionButton("CHECK UPDATE", "check_updates")}
        ${actionButton("REPAIR", "repair_daemon")}
        ${actionButton("LOG FOLDER", "reveal_logs")}
      </div>
      <div class="info-list">
        ${pathLine("Install", status?.installDir ?? "Detecting")}
        ${pathLine("Daemon", status?.daemonPath ?? "Detecting")}
        ${pathLine("Data", status?.dataDir ?? "Detecting")}
      </div>
    </div>
  </section>`;
}

function renderLogsPage(): string {
  return `<section class="panel full-panel">
    <div class="panel-head"><div><p class="eyebrow">EVENT STREAM</p><h2>Operator log</h2></div>${actionButton("OPEN LOGS", "reveal_logs")}</div>
    <ol class="activity log-mode">
      ${(events.length ? events : ["Waiting for daemon telemetry."]).map((event) => `<li>${escapeHtml(event)}</li>`).join("")}
    </ol>
  </section>`;
}

function renderCurrentPage(): string {
  if (selectedView === "Projects") return renderProjectsPage();
  if (selectedView === "Studio Setup") return renderSetupPage();
  if (selectedView === "Code") return renderCodePage();
  if (selectedView === "Debugger") return renderDebuggerPage();
  if (selectedView === "Daemon") return renderDaemonPage();
  if (selectedView === "Logs") return renderLogsPage();
  return renderStatusPage();
}

function render(): void {
  appRoot.innerHTML = `
    <div class="backdrop-grid"></div>
    <div class="shell">
      ${renderMenu()}
      <div class="shell-body">
        ${renderSidebar()}
        <main class="main">
          ${renderHeader()}
          ${renderCurrentPage()}
        </main>
      </div>
      ${booting ? renderLoading() : ""}
    </div>
  `;
}

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const projectButton = target.closest<HTMLButtonElement>("[data-place-id]");
  if (projectButton?.dataset.placeId) {
    selectedProjectId = projectButton.dataset.placeId;
    selectedScriptPath = "";
    selectedView = "Code";
    void loadSetupStatus().then(render);
    return;
  }

  const scriptItem = target.closest<HTMLElement>("[data-script-path]");
  if (scriptItem?.dataset.scriptPath) {
    selectedScriptPath = scriptItem.dataset.scriptPath;
    render();
    return;
  }

  const projectAction = target.closest<HTMLButtonElement>("[data-project-action]")?.dataset.projectAction;
  if (projectAction === "code") {
    void openSelectedProjectInCode();
    return;
  }
  if (projectAction === "place" || projectAction === "repo") {
    void revealProject(projectAction);
    return;
  }

  const setupAction = target.closest<HTMLButtonElement>("[data-setup-action]")?.dataset.setupAction;
  if (setupAction === "github-start") {
    void startGithubDeviceFlow();
    return;
  }
  if (setupAction === "github-poll") {
    void pollGithubDeviceFlow();
    return;
  }

  const view = target.closest<HTMLButtonElement>("[data-view]")?.dataset.view as ViewName | undefined;
  if (view && views.includes(view)) {
    selectedView = view;
    render();
    return;
  }

  const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset.action as ActionName | undefined;
  if (action) {
    void runAction(action);
    return;
  }

  const autostart = target.closest<HTMLButtonElement>("[data-autostart]")?.dataset.autostart;
  if (autostart) {
    void setAutostart(autostart === "on");
    return;
  }

  if (target.closest("[data-refresh]")) {
    void refreshAll();
  }
});

app.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;
  if (!(form instanceof HTMLFormElement)) return;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  if (kind === "ai") void saveAiConfig(form);
  if (kind === "license") void activateLicense(form);
});

void boot();
window.setInterval(() => void refreshAll(true), 7000);
