import { validateLicense } from "../services/licenseService.ts";
import { getDb, json, readJson, requestMeta, stringField, type HandlerContext } from "./helpers.ts";

export async function handleValidate(request: Request, context: HandlerContext): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ valid: false, error: "INVALID_PAYLOAD" }, 400);
  const licenseKey = stringField(body, "licenseKey");
  const machineId = stringField(body, "machineId");
  if (!licenseKey || !machineId) return json({ valid: false, error: "INVALID_PAYLOAD" }, 400);
  const result = await validateLicense(getDb(context), licenseKey, machineId, requestMeta(request));
  return json(result);
}
