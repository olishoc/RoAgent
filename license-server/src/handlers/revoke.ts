import { revokeLicense } from "../services/licenseService.ts";
import { getDb, json, readJson, requireAdmin, requestMeta, stringField, type HandlerContext } from "./helpers.ts";

export async function handleRevoke(request: Request, context: HandlerContext): Promise<Response> {
  const unauthorized = requireAdmin(request, context.env);
  if (unauthorized) return unauthorized;
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "INVALID_PAYLOAD" }, 400);
  const licenseKey = stringField(body, "licenseKey");
  const reason = stringField(body, "reason") ?? "admin revoke";
  if (!licenseKey) return json({ ok: false, error: "INVALID_PAYLOAD" }, 400);
  try {
    await revokeLicense(getDb(context), licenseKey, reason, requestMeta(request));
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
}
