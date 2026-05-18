import type http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { saveApiKeyConfig } from "../services/apiKeyConfig.ts";

export async function handleConfigRoute(req: http.IncomingMessage, res: http.ServerResponse, authToken: string): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/config/api-key") return false;
  if (!isLoopback(req.socket.remoteAddress)) {
    sendJson(res, 403, { success: false, error: "Forbidden" });
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return true;
  }
  if (!safeTokenEquals(tokenFromRequest(req), authToken)) {
    sendJson(res, 401, { success: false, error: "Invalid auth token" });
    return true;
  }
  try {
    const body = await readJson(req);
    const config = await saveApiKeyConfig({
      provider: String(body.provider ?? ""),
      apiKey: String(body.apiKey ?? ""),
      model: String(body.model ?? ""),
      aiMaxTokens: typeof body.aiMaxTokens === "number" ? body.aiMaxTokens : undefined,
    });
    sendJson(res, 200, { success: true, result: { ...config, aiApiKey: "<keychain>" } });
  } catch (error) {
    sendJson(res, 400, { success: false, error: error instanceof Error ? error.message : "Invalid request" });
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
