import type http from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Config } from "../config.ts";
import { autostartStatus, setAutostart } from "../services/autostartService.ts";
import { applyUpdate, checkForUpdate, repairReport } from "../services/updateService.ts";
import { createSupportBundle } from "../services/supportBundleService.ts";

export async function handleDaemonRoute(req: http.IncomingMessage, res: http.ServerResponse, config: Config): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const route = url.pathname;
  if (!route.startsWith("/daemon/")) return false;
  if (!isLoopback(req.socket.remoteAddress)) {
    sendJson(res, 403, { success: false, error: "Forbidden" });
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return true;
  }
  if (!safeTokenEquals(tokenFromRequest(req), config.authToken)) {
    sendJson(res, 401, { success: false, error: "Invalid auth token" });
    return true;
  }

  try {
    const body = await readJson(req);
    if (route === "/daemon/autostart/status") {
      sendJson(res, 200, { success: true, result: autostartStatus() });
      return true;
    }
    if (route === "/daemon/autostart/set") {
      sendJson(res, 200, { success: true, result: setAutostart(body.enabled === true) });
      return true;
    }
    if (route === "/daemon/update/check") {
      sendJson(res, 200, { success: true, result: await checkForUpdate(config) });
      return true;
    }
    if (route === "/daemon/update/apply") {
      const result = await applyUpdate(config);
      sendJson(res, 200, { success: true, result });
      if (result.staged && result.restarting) setTimeout(() => process.exit(0), 250);
      return true;
    }
    if (route === "/daemon/repair") {
      sendJson(res, 200, { success: true, result: repairReport(config) });
      return true;
    }
    if (route === "/daemon/support-bundle") {
      sendJson(res, 200, { success: true, result: await createSupportBundle(config) });
      return true;
    }
    sendJson(res, 404, { success: false, error: "Unknown daemon route" });
    return true;
  } catch (error) {
    sendJson(res, 400, { success: false, error: error instanceof Error ? error.message : "Invalid request" });
    return true;
  }
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
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return {};
    throw new Error("Body must be a JSON object");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function sendJson(res: http.ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
