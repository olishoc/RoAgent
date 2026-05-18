import type { ActivationLog, ActivationLogEvent, ActivationResult, CreateLicenseInput, DbClient, License, RequestMeta, ValidationResult } from "../types.ts";

const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeLicenseKey(licenseKey: string): string {
  return licenseKey.trim().toUpperCase();
}

export function randomLicenseKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const groups: string[] = [];
  for (let group = 0; group < 4; group++) {
    let text = "";
    for (let i = 0; i < 4; i++) text += SAFE_ALPHABET[bytes[group * 4 + i] % SAFE_ALPHABET.length];
    groups.push(text);
  }
  return `STUDIO-${groups.join("-")}`;
}

export async function generateLicenseKey(db: DbClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const key = randomLicenseKey();
    const existing = await db.from("licenses").select("license_key").eq("license_key", key).maybeSingle<Pick<License, "license_key">>();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) return key;
  }
  throw new Error("Unable to generate unique license key after 5 attempts");
}

export async function createLicense(db: DbClient, data: CreateLicenseInput): Promise<License> {
  const licenseKey = await generateLicenseKey(db);
  const insert = {
    license_key: licenseKey,
    email: data.email,
    polar_customer_id: data.polarCustomerId,
    polar_order_id: data.polarOrderId,
    status: "ACTIVE",
    max_activations: data.maxActivations ?? 1,
  };
  const result = await db.from("licenses").insert(insert).select("*").single<License>();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "License insert failed");
  return result.data;
}

export async function findLicenseByKey(db: DbClient, licenseKey: string): Promise<License | null> {
  const result = await db.from("licenses").select("*").eq("license_key", normalizeLicenseKey(licenseKey)).maybeSingle<License>();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function findLicenseByPolarOrder(db: DbClient, polarOrderId: string): Promise<License | null> {
  const result = await db.from("licenses").select("*").eq("polar_order_id", polarOrderId).maybeSingle<License>();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function activateLicense(db: DbClient, licenseKey: string, machineId: string, meta: RequestMeta = {}): Promise<ActivationResult> {
  const key = normalizeLicenseKey(licenseKey);
  const license = await findLicenseByKey(db, key);
  if (!license) return failed(db, key, machineId, meta, "INVALID_KEY");
  if (license.status === "REVOKED") return failed(db, key, machineId, meta, "LICENSE_REVOKED");
  if (license.status === "EXPIRED") return failed(db, key, machineId, meta, "LICENSE_EXPIRED");
  if (license.machine_id && license.machine_id !== machineId) return failed(db, key, machineId, meta, "LICENSE_ALREADY_ACTIVATED");

  const now = new Date().toISOString();
  const event: ActivationLogEvent = license.machine_id === machineId ? "reactivated" : "activated";
  let updated = license;
  if (!license.machine_id) {
    const result = await db.from("licenses").update({ machine_id: machineId, activated_at: now, activation_count: license.activation_count + 1 }).eq("license_key", key).select("*").single<License>();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "License activation update failed");
    updated = result.data;
  }
  await logActivation(db, key, machineId, event, meta);
  return { valid: true, status: "ACTIVE", activatedAt: updated.activated_at ?? now, email: updated.email };
}

export async function validateLicense(db: DbClient, licenseKey: string, machineId: string, meta: RequestMeta = {}): Promise<ValidationResult> {
  const key = normalizeLicenseKey(licenseKey);
  const license = await findLicenseByKey(db, key);
  if (!license) return validationError(db, key, machineId, meta, "INVALID_KEY");
  if (license.machine_id !== machineId) return validationError(db, key, machineId, meta, "MACHINE_MISMATCH");
  if (license.status === "REVOKED") return validationError(db, key, machineId, meta, "LICENSE_REVOKED");
  if (license.status === "EXPIRED") return validationError(db, key, machineId, meta, "LICENSE_EXPIRED");
  const now = new Date().toISOString();
  const result = await db.from("licenses").update({ last_validated_at: now }).eq("license_key", key).select("*").single<License>();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "License validation update failed");
  await logActivation(db, key, machineId, "validated", meta);
  return { valid: true, status: "ACTIVE", email: result.data.email, lastValidated: result.data.last_validated_at ?? now, daysRemaining: null };
}

export async function revokeLicense(db: DbClient, licenseKey: string, reason: string, meta: RequestMeta = {}): Promise<void> {
  const key = normalizeLicenseKey(licenseKey);
  const now = new Date().toISOString();
  const result = await db.from("licenses").update({ status: "REVOKED", revoked_at: now, revoke_reason: reason, machine_id: null }).eq("license_key", key).select("*").single<License>();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "License revoke failed");
  await logActivation(db, key, result.data.machine_id ?? "admin", "revoked", meta);
}

export async function getLicenseStatus(db: DbClient, licenseKey: string): Promise<{ license: License | null; activationLog: ActivationLog[] }> {
  const key = normalizeLicenseKey(licenseKey);
  const license = await findLicenseByKey(db, key);
  if (!license) return { license: null, activationLog: [] };
  const logs = await db.from("activation_log").select("*").eq("license_key", key).order("created_at", { ascending: false });
  if (logs.error) throw new Error(logs.error.message);
  return { license, activationLog: (logs.data as ActivationLog[] | null) ?? [] };
}

export async function logWebhook(db: DbClient, input: { eventType?: string; polarId?: string; payload: unknown; processed?: boolean; error?: string | null }): Promise<void> {
  const result = await db.from("webhook_log").insert({ event_type: input.eventType ?? null, polar_id: input.polarId ?? null, payload: input.payload, processed: input.processed ?? false, error: input.error ?? null });
  if (result.error) console.error("Failed to write webhook_log", result.error);
}

async function failed(db: DbClient, key: string, machineId: string, meta: RequestMeta, error: ActivationResult["error"]): Promise<ActivationResult> {
  await logActivation(db, key, machineId, "failed", meta).catch(() => undefined);
  return { valid: false, error };
}

async function validationError(db: DbClient, key: string, machineId: string, meta: RequestMeta, error: ValidationResult["error"]): Promise<ValidationResult> {
  await logActivation(db, key, machineId, "failed", meta).catch(() => undefined);
  return { valid: false, error };
}

async function logActivation(db: DbClient, licenseKey: string, machineId: string, event: ActivationLogEvent, meta: RequestMeta): Promise<void> {
  const result = await db.from("activation_log").insert({ license_key: licenseKey, machine_id: machineId, event, ip_address: meta.ip ?? null, user_agent: meta.userAgent ?? null });
  if (result.error) throw new Error(result.error.message);
}

export { SAFE_ALPHABET };
