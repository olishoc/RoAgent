import { getLicenseStatus } from "../services/licenseService.ts";
import { getDb, json, requireAdmin, type HandlerContext } from "./helpers.ts";

export async function handleStatus(request: Request, context: HandlerContext): Promise<Response> {
  const unauthorized = requireAdmin(request, context.env);
  if (unauthorized) return unauthorized;
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return json({ ok: false, error: "MISSING_KEY" }, 400);
  const result = await getLicenseStatus(getDb(context), key);
  if (!result.license) return json({ ok: false, error: "NOT_FOUND" }, 404);
  return json({ ok: true, ...result });
}
