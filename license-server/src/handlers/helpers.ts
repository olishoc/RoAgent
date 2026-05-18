import type { DbClient, Env } from "../types.ts";
import { createSupabaseClient } from "../db/client.ts";

export interface HandlerContext {
  env: Env;
  db?: DbClient;
}

export function getDb(context: HandlerContext): DbClient {
  return context.db ?? createSupabaseClient(context.env);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function requireAdmin(request: Request, env: Env): Response | null {
  const expected = `Bearer ${env.ADMIN_SECRET}`;
  if (!env.ADMIN_SECRET || request.headers.get("authorization") !== expected) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  return null;
}

export function requestMeta(request: Request): { ip?: string | null; userAgent?: string | null } {
  return { ip: request.headers.get("cf-connecting-ip"), userAgent: request.headers.get("user-agent") };
}

export function stringField(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
