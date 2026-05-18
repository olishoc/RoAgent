import type http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { AppError, toAppError } from "../errors.ts";
import type { HandlerContext } from "../types.ts";
import { scriptHandlers } from "../handlers/scriptHandlers.ts";
import { gitHandlers } from "../handlers/gitHandlers.ts";
import { agentHandlers } from "../handlers/agentHandlers.ts";
import type { AgentActionLog } from "../services/agentActionLog.ts";
import { ErrorCode, PROTOCOL_VERSION, type ClientToServerMessage } from "../../../shared/protocol.ts";

export interface AgentRouteContext extends HandlerContext {
  actionLog: AgentActionLog;
}

const routeMap: Record<string, { type: string; tool: string; transform: (body: Record<string, unknown>) => object }> = {
  "/agent/script/read": { type: "script:read", tool: "script_read", transform: (b) => ({ path: normalizeScriptPathForAgent(b.path).path, ...optionalUniqueId(b) }) },
  "/agent/script/write": { type: "script:write", tool: "script_write", transform: (b) => ({ path: normalizeScriptPathForAgent(b.path).path, ...optionalUniqueId(b), source: b.content, pendingStudioDeploy: true }) },
  "/agent/script/create": {
    type: "script:create",
    tool: "script_create",
    transform: (b) => {
      const normalized = normalizeScriptPathForAgent(b.path, scriptClassName(b.className));
      return { path: normalized.path, ...optionalUniqueId(b), source: b.content, className: normalized.className ?? inferClassNameFromPath(normalized.path), overwrite: b.overwrite === true, pendingStudioDeploy: true };
    },
  },
  "/agent/script/delete": { type: "script:delete", tool: "script_delete", transform: (b) => ({ path: normalizeScriptPathForAgent(b.path).path, ...optionalUniqueId(b) }) },
  "/agent/script/rename": { type: "script:rename", tool: "script_rename", transform: (b) => ({ fromPath: normalizeScriptPathForAgent(b.from).path, ...optionalUniqueId(b), toPath: normalizeScriptPathForAgent(b.to).path, pendingStudioDeploy: true }) },
  "/agent/script/list": { type: "script:list", tool: "script_list", transform: (b) => ({ includeSource: b.includeSource === true }) },
  "/agent/script/cleanup-stale": { type: "script:cleanupStale", tool: "script_cleanup_stale", transform: (b) => ({ paths: normalizeCleanupPaths(b), confirm: b.confirm === true, includeLegacy: b.includeLegacy === true, includePending: b.includePending === true, summary: typeof b.summary === "string" ? b.summary : undefined }) },
  "/agent/script/restore": { type: "git:restore", tool: "script_restore", transform: (b) => ({ path: b.path, commit: b.toCommit }) },
  "/agent/git/commit": { type: "git:commit", tool: "git_commit", transform: (b) => ({ message: b.message }) },
  "/agent/git/status": { type: "git:status", tool: "git_status", transform: () => ({}) },
  "/agent/git/log": { type: "git:log", tool: "git_log", transform: (b) => ({ limit: b.limit }) },
  "/agent/git/diff": { type: "git:diff", tool: "git_diff", transform: (b) => ({ path: b.path, fromCommit: b.fromCommit, toCommit: b.toCommit }) },
  "/agent/actions/recent": { type: "agent:recentActions", tool: "recent_actions", transform: () => ({}) },
};

function optionalUniqueId(body: Record<string, unknown>): { uniqueId?: string } {
  return typeof body.uniqueId === "string" && body.uniqueId.length > 0 ? { uniqueId: body.uniqueId } : {};
}

function scriptClassName(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === "Script" || value === "LocalScript" || value === "ModuleScript") return value;
  throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid className");
}

function inferClassNameFromPath(scriptPath: string): "Script" | "LocalScript" | "ModuleScript" {
  if (/^(StarterPlayer\.)?StarterPlayerScripts\./.test(scriptPath)) return "LocalScript";
  if (/^(StarterPlayer\.)?StarterCharacterScripts\./.test(scriptPath)) return "LocalScript";
  if (/^StarterGui\./.test(scriptPath)) return "LocalScript";
  return "Script";
}

function normalizeCleanupPaths(body: Record<string, unknown>): string[] {
  const rawPaths = Array.isArray(body.paths) ? body.paths : [body.path];
  return rawPaths.map((value) => normalizeScriptPathForAgent(value).path);
}

function normalizeScriptPathForAgent(value: unknown, className?: string): { path: string; className?: string } {
  let text = String(value ?? "").replace(/\\/g, "/");
  let inferredClassName = className;
  const normalizeLeaf = (leaf: string): string => {
    if (/\.server\.lua(u)?$/i.test(leaf)) {
      inferredClassName ??= "Script";
      return leaf.replace(/\.server\.lua(u)?$/i, "");
    }
    if (/\.client\.lua(u)?$/i.test(leaf)) {
      inferredClassName ??= "LocalScript";
      return leaf.replace(/\.client\.lua(u)?$/i, "");
    }
    if (/\.lua(u)?$/i.test(leaf)) {
      inferredClassName ??= "ModuleScript";
      return leaf.replace(/\.lua(u)?$/i, "");
    }
    return leaf;
  };
  if (text.includes("/")) {
    const parts = text.split("/").filter(Boolean);
    if (parts.length > 0) parts[parts.length - 1] = normalizeLeaf(parts[parts.length - 1]);
    text = parts.join(".");
  } else {
    text = normalizeLeaf(text);
  }
  return { path: text, className: inferredClassName };
}

export async function handleAgentRoute(req: http.IncomingMessage, res: http.ServerResponse, context: AgentRouteContext): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const route = routeMap[url.pathname];
  if (!route) return false;
  if (!isLoopback(req.socket.remoteAddress)) {
    sendJson(res, 403, { success: false, error: "Forbidden" });
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return true;
  }
  if (!safeTokenEquals(tokenFromRequest(req), context.config.authToken)) {
    sendJson(res, 401, { success: false, error: "Invalid auth token" });
    return true;
  }
  const body = await readJson(req).catch((error) => {
    throw new AppError(ErrorCode.INVALID_PAYLOAD, error instanceof Error ? error.message : "Invalid JSON");
  });
  const placeId = String(body.placeId ?? req.headers["x-studiolink-place-id"] ?? "__global__");
  try {
    const payload = route.transform(body);
    const message: ClientToServerMessage = { version: PROTOCOL_VERSION, type: route.type, requestId: randomUUID(), placeId, payload } as ClientToServerMessage;
    const handler = route.type.startsWith("git:") ? gitHandlers[route.type] : route.type.startsWith("agent:") ? agentHandlers[route.type] : scriptHandlers[route.type];
    if (!handler) throw new AppError(ErrorCode.INVALID_PAYLOAD, `No handler for ${route.type}`);
    const result = await handler(message, context, undefined as never);
    const entry = context.actionLog.append(placeId, route.tool, body, "success", summarizeLengths(route.tool, body, result));
    context.agentService.recordAction(placeId, { timestamp: entry.timestamp, summary: entry.summary, tool: entry.tool });
    sendJson(res, 200, { success: true, result });
  } catch (error) {
    const appError = toAppError(error);
    const entry = context.actionLog.append(placeId, route.tool, body, "error", { summary: `${route.tool} failed: ${appError.message}` });
    context.agentService.recordAction(placeId, { timestamp: entry.timestamp, summary: entry.summary, tool: entry.tool });
    sendJson(res, 400, { success: false, error: appError.message, code: appError.code, details: appError.details });
  }
  return true;
}

function isLoopback(remoteAddress: string | undefined): boolean {
  return remoteAddress === "127.0.0.1" || remoteAddress === "::ffff:127.0.0.1" || remoteAddress === "::1";
}

function tokenFromRequest(req: http.IncomingMessage): string | undefined {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const queryToken = url.searchParams.get("token") ?? undefined;
  const header = req.headers["x-roagent-token"];
  return queryToken ?? (Array.isArray(header) ? header[0] : header);
}

function safeTokenEquals(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function sendJson(res: http.ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function summarizeLengths(tool: string, body: Record<string, unknown>, result: object): { beforeLength?: number; afterLength?: number } | undefined {
  if (tool !== "script_write" || typeof body.content !== "string") return undefined;
  const previous = result as { historyVersion?: { source?: string } };
  return { afterLength: body.content.length, beforeLength: previous.historyVersion?.source?.length };
}
