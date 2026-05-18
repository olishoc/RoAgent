import type { DbClient, Env } from "./types.ts";
import { handleActivate } from "./handlers/activate.ts";
import { handleValidate } from "./handlers/validate.ts";
import { handleRevoke } from "./handlers/revoke.ts";
import { handleStatus } from "./handlers/status.ts";
import { handlePolarWebhook } from "./handlers/polarWebhook.ts";
import type { HandlerContext } from "./handlers/helpers.ts";
import { json } from "./handlers/helpers.ts";

export interface WorkerContextOptions {
  db?: DbClient;
}

export async function handleRequest(request: Request, env: Env, options: WorkerContextOptions = {}): Promise<Response> {
  const url = new URL(request.url);
  const context: HandlerContext = { env, db: options.db };
  try {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);
    if (request.method === "GET" && url.pathname === "/health") return cors(json({ ok: true }), request);
    if (request.method === "POST" && url.pathname === "/api/polar/webhook") return cors(await handlePolarWebhook(request, context), request);
    if (request.method === "POST" && url.pathname === "/api/license/activate") return cors(await handleActivate(request, context), request);
    if (request.method === "POST" && url.pathname === "/api/license/validate") return cors(await handleValidate(request, context), request);
    if (request.method === "POST" && url.pathname === "/api/license/revoke") return cors(await handleRevoke(request, context), request);
    if (request.method === "GET" && url.pathname === "/api/license/status") return cors(await handleStatus(request, context), request);
    return cors(json({ ok: false, error: "NOT_FOUND" }, 404), request);
  } catch (error) {
    console.error("Unhandled request error", error);
    return cors(json({ ok: false, error: "INTERNAL_ERROR" }, 500), request);
  }
}

const ALLOWED_ORIGINS = new Set(["https://rblxagent.com", "https://www.rblxagent.com"]);

function cors(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request?.headers.get("origin");
  headers.set("access-control-allow-origin", origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://rblxagent.com");
  headers.set("vary", "Origin");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization,x-polar-signature");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
