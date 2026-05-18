import http from "node:http";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";
import { PlaceStore } from "./state/placeStore.ts";
import { HistoryStore } from "./history/historyStore.ts";
import { WatchService } from "./watch/watchService.ts";
import { AgentService } from "./services/agentService.ts";
import { LicenseService } from "./services/licenseService.ts";
import { AgentActionLog } from "./services/agentActionLog.ts";
import { handleSelfInstallCommand } from "./services/selfInstallService.ts";
import { handleAgentRoute, type AgentRouteContext } from "./routes/agentRoutes.ts";
import { handleConfigRoute } from "./routes/configRoutes.ts";
import { handleDaemonRoute } from "./routes/daemonRoutes.ts";
import { parseEnvelope } from "./protocol/validate.ts";
import { sendEnvelope, sendError } from "./protocol/respond.ts";
import { dispatchMessage, routeMessage } from "./protocol/router.ts";
import { AppError, toAppError } from "./errors.ts";
import { ErrorCode, GLOBAL_PLACE_ID } from "../../shared/protocol.ts";
import type { HandlerContext } from "./types.ts";

const PACKAGE_VERSION = "3.0.0";
const VERSION = readPackageVersion();

function readPackageVersion(): string {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    join(process.cwd(), "package.json"),
  ];
  for (const file of candidates) {
    try {
      return (JSON.parse(readFileSync(file, "utf8")) as { version?: string }).version ?? PACKAGE_VERSION;
    } catch {
      // Try next candidate.
    }
  }
  return PACKAGE_VERSION;
}

function isLoopback127(remoteAddress: string | undefined): boolean {
  return remoteAddress === "127.0.0.1" || remoteAddress === "::ffff:127.0.0.1" || remoteAddress === "::1";
}

function safeTokenEquals(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function tokenFromRequest(req: http.IncomingMessage): string | undefined {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `ws://${host}`);
  const queryToken = url.searchParams.get("token") ?? undefined;
  const header = req.headers["x-roagent-token"];
  return queryToken ?? (Array.isArray(header) ? header[0] : header);
}

function buildHealth(config: ReturnType<typeof loadConfig>, licenseService: LicenseService): object {
  const roAgentPath = resolveRoAgentPath(config.repoRoot);
  return {
    version: VERSION,
    roAgentInstalled: Boolean(roAgentPath),
    roAgentPath,
    gitInstalled: isCommandInstalled("git"),
    licenseStatus: licenseService.status().status,
    uptime: process.uptime(),
  };
}

function resolveRoAgentPath(repoRoot: string): string | null {
  const candidates = [
    process.env.STUDIOLINK_ROAGENT_PATH,
    join(repoRoot, "dist", process.platform === "win32" ? "roagent.exe" : "roagent"),
    join(repoRoot, "roagent", "dist", process.platform === "win32" ? "roagent.exe" : "roagent"),
    process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Programs", "StudioLink", "roagent", "roagent.exe") : undefined,
    process.platform === "win32" ? "C:\\Program Files\\StudioLink\\roagent\\roagent.exe" : "/usr/local/bin/roagent",
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function isCommandInstalled(command: string): boolean {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function licenseExpiryForWarning(daysRemaining: number): string {
  return new Date(Date.now() + Math.max(0, daysRemaining) * 24 * 60 * 60 * 1000).toISOString();
}

function sendLicenseWarning(ws: WebSocket, licenseService: LicenseService): void {
  const warning = licenseService.warning();
  if (!warning || ws.readyState !== WebSocket.OPEN) return;
  sendEnvelope(ws, "license:warning", randomUUID(), GLOBAL_PLACE_ID, {
    message: warning.message,
    expiresAt: warning.status.expiresAt ?? licenseExpiryForWarning(warning.status.daysRemaining),
    daysRemaining: warning.status.daysRemaining,
  });
}

function broadcastLicenseEvent(connections: Set<WebSocket>, event: { type: "warning" | "revoked"; status: ReturnType<LicenseService["status"]>; message: string }): void {
  for (const ws of connections) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (event.type === "revoked") {
      sendEnvelope(ws, "license:revoked", randomUUID(), GLOBAL_PLACE_ID, { code: ErrorCode.LICENSE_INVALID, message: event.message, revokedAt: new Date().toISOString() });
    } else {
      sendEnvelope(ws, "license:warning", randomUUID(), GLOBAL_PLACE_ID, {
        message: event.message,
        expiresAt: event.status.expiresAt ?? licenseExpiryForWarning(event.status.daysRemaining),
        daysRemaining: event.status.daysRemaining,
      });
    }
  }
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function writeJson(res: http.ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type,x-roagent-token" });
  res.end(JSON.stringify(body));
}

function writePrivateJson(res: http.ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function spawnRestartChild(): void {
  const helper = `setTimeout(() => { const { spawn } = require("node:child_process"); const child = spawn(${JSON.stringify(process.execPath)}, ${JSON.stringify([...process.execArgv, ...process.argv.slice(1)])}, { cwd: ${JSON.stringify(process.cwd())}, env: process.env, detached: true, stdio: "ignore" }); child.unref(); }, 900);`;
  const child = spawn(process.execPath, ["-e", helper], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function isAllowedBrowserUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "rblxagent.com",
      "www.rblxagent.com",
      "api.rblxagent.com",
      "github.com",
      "www.github.com",
      "gitlab.com",
      "www.gitlab.com",
      "bitbucket.org",
      "www.bitbucket.org",
      "dev.azure.com",
    ]);
    return (url.protocol === "https:" || url.protocol === "http:") && allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function tryOpenUrl(command: string, args: string[]): boolean {
  try {
    const result = spawnSync(command, args, { stdio: "ignore", timeout: 5_000, windowsHide: true });
    return !result.error && (result.status === 0 || result.status === null);
  } catch {
    return false;
  }
}

function isWsl(): boolean {
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function openUrlWithOs(url: string): boolean {
  const attempts: Array<[string, string[]]> = [];
  if (process.platform === "win32" || isWsl()) {
    attempts.push(
      ["rundll32.exe", ["url.dll,FileProtocolHandler", url]],
      ["explorer.exe", [url]],
      ["powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process -FilePath $args[0]", url]],
      ["cmd.exe", ["/d", "/c", "start", "", url]],
    );
  } else if (process.platform === "darwin") {
    attempts.push(["open", [url]]);
  } else {
    attempts.push(["xdg-open", [url]], ["gio", ["open", url]], ["sensible-browser", [url]]);
  }
  return attempts.some(([command, args]) => tryOpenUrl(command, args));
}

function main(): void {
  if (handleSelfInstallCommand(VERSION)) return;
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    console.log(VERSION);
    return;
  }
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`RoAgent daemon config error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const logger = createLogger(config);
  const connections = new Set<WebSocket>();
  const placeStore = new PlaceStore(config);
  const historyStore = new HistoryStore(config, logger);
  const watchService = new WatchService(config, logger);
  const agentService = new AgentService();
  const licenseService = new LicenseService(config);
  void licenseService.revalidate()
    .then((event) => {
      if (event) broadcastLicenseEvent(connections, event);
    })
    .catch((error) => logger.warn(logger.sanitizeError(error), "Initial license revalidation failed"));
  licenseService.startPeriodicRevalidation((event) => broadcastLicenseEvent(connections, event));
  const actionLog = new AgentActionLog(config, connections);

  const context: AgentRouteContext = {
    config,
    logger,
    placeStore,
    historyStore,
    watchService,
    agentService,
    licenseService,
    connections,
    actionLog,
  };

  const server = http.createServer((req, res) => {
    void (async () => {
      if (req.method === "OPTIONS") {
        writeJson(res, 204, {});
        return;
      }
      if (await handleAgentRoute(req, res, context)) return;
      if (await handleConfigRoute(req, res, config.authToken)) return;
      if (req.url?.startsWith("/daemon/") && !req.url.startsWith("/daemon/restart") && await handleDaemonRoute(req, res, config)) return;
      if (req.method === "GET" && req.url?.startsWith("/auth-token")) {
        if (!isLoopback127(req.socket.remoteAddress)) {
          writePrivateJson(res, 403, { success: false, error: "Forbidden" });
          return;
        }
        writePrivateJson(res, 200, { token: config.authToken });
        return;
      }
      if (req.method === "POST" && req.url?.startsWith("/open-url")) {
        if (!isLoopback127(req.socket.remoteAddress)) {
          writePrivateJson(res, 403, { success: false, error: "Forbidden" });
          return;
        }
        if (!safeTokenEquals(tokenFromRequest(req), config.authToken)) {
          writePrivateJson(res, 401, { success: false, error: "Invalid auth token" });
          return;
        }
        const raw = await readBody(req);
        const body = raw.length > 0 ? JSON.parse(raw.toString("utf8")) as { url?: unknown } : {};
        if (!isAllowedBrowserUrl(body.url)) {
          writePrivateJson(res, 400, { success: false, error: "Invalid URL" });
          return;
        }
        if (!openUrlWithOs(body.url)) {
          writePrivateJson(res, 500, { success: false, error: "Unable to open URL" });
          return;
        }
        writePrivateJson(res, 200, { success: true, opened: true });
        return;
      }
      if (req.method === "POST" && req.url?.startsWith("/daemon/restart")) {
        if (!isLoopback127(req.socket.remoteAddress)) {
          writePrivateJson(res, 403, { success: false, error: "Forbidden" });
          return;
        }
        if (!safeTokenEquals(tokenFromRequest(req), config.authToken)) {
          writePrivateJson(res, 401, { success: false, error: "Invalid auth token" });
          return;
        }
        writePrivateJson(res, 200, { success: true, restarting: true });
        setTimeout(() => {
          logger.info({ event: "daemon-restart" }, "RoAgent daemon restarting by request");
          spawnRestartChild();
          licenseService.stopPeriodicRevalidation();
          for (const ws of connections) ws.close();
          wss.close();
          server.close(() => process.exit(0));
          server.closeIdleConnections?.();
        }, 100);
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/health")) {
        writeJson(res, 200, buildHealth(config, licenseService));
        return;
      }
      if (req.method === "POST" && req.url?.startsWith("/rpc")) {
        if (!safeTokenEquals(tokenFromRequest(req), config.authToken)) {
          writeJson(res, 401, { version: "1", type: "error", requestId: "unknown", placeId: GLOBAL_PLACE_ID, payload: { code: ErrorCode.PERMISSION_DENIED, message: "Invalid auth token", retryable: false } });
          return;
        }
        const raw = await readBody(req);
        let message;
        try {
          message = parseEnvelope(raw);
          const payload = await dispatchMessage(message, context);
          writeJson(res, 200, { version: "1", type: `${message.type}:response`, requestId: message.requestId, placeId: message.placeId, payload });
        } catch (error) {
          const appError = toAppError(error);
          writeJson(res, 200, { version: "1", type: "error", requestId: message?.requestId ?? "unknown", placeId: message?.placeId ?? GLOBAL_PLACE_ID, payload: { code: appError.code, message: appError.message, retryable: appError.retryable, details: appError.details } });
        }
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    })().catch((error) => {
      logger.error(logger.sanitizeError(error), "HTTP route error");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal server error" }));
    });
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!isLoopback127(req.socket.remoteAddress)) {
      socket.destroy();
      logger.warn({ event: "reject-non-loopback", remoteAddress: req.socket.remoteAddress }, "Rejected non-loopback connection");
      return;
    }
    if (!safeTokenEquals(tokenFromRequest(req), config.authToken)) {
      socket.destroy();
      logger.warn({ event: "reject-auth", remoteAddress: req.socket.remoteAddress }, "Rejected unauthorized connection");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws, req) => {
    connections.add(ws);
    logger.info({ event: "connection-open", activeConnections: connections.size, remoteAddress: req.socket.remoteAddress }, "WebSocket connected");
    sendLicenseWarning(ws, licenseService);

    ws.on("message", async (raw) => {
      try {
        const message = parseEnvelope(raw);
        await routeMessage(message, context, ws);
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError(ErrorCode.INVALID_PAYLOAD, error instanceof Error ? error.message : "Invalid message");
        sendError(ws, "unknown", "__global__", appError);
        logger.warn({ type: "unknown", success: false, code: appError.code }, "Envelope rejected");
        logger.error(logger.sanitizeError(error), "Envelope error stack");
      }
    });

    ws.on("close", () => {
      watchService.removeSocket(ws);
      connections.delete(ws);
      logger.info({ event: "connection-close", activeConnections: connections.size }, "WebSocket disconnected");
    });

    ws.on("error", (error) => {
      logger.error(logger.sanitizeError(error), "WebSocket error stack");
    });
  });

  server.listen(config.port, config.host, () => {
    const health = buildHealth(config, licenseService) as { roAgentInstalled: boolean; gitInstalled: boolean };
    if (!health.roAgentInstalled) logger.warn({ event: "health-warning" }, "RoAgent executable is not installed at the expected StudioLink path");
    if (!health.gitInstalled) logger.warn({ event: "health-warning" }, "git executable is not available on PATH");
    logger.info({ event: "daemon-start", port: config.port }, "RoAgent daemon started");
    console.log(`RoAgent daemon listening on ws://${config.host}:${config.port}`);
  });

  server.on("error", (error) => {
    logger.error(logger.sanitizeError(error), "Server listen error");
    console.error(`RoAgent daemon failed to start: ${error.message}`);
    process.exit(1);
  });

  const shutdown = () => {
    logger.info({ event: "daemon-shutdown" }, "RoAgent daemon shutting down");
    licenseService.stopPeriodicRevalidation();
    for (const ws of connections) ws.close();
    wss.close();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
