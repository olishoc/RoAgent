import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest } from "../src/index.ts";
import { activateLicense, createLicense } from "../src/services/licenseService.ts";
import type { Env } from "../src/types.ts";
import { MockDb } from "./mockDb.ts";

const env: Env = {
  POLAR_WEBHOOK_SECRET: "secret",
  POLAR_PRODUCT_ID: "prod_studiolink",
  SUPABASE_URL: "http://example.test",
  SUPABASE_SERVICE_KEY: "service",
  RESEND_API_KEY: "resend",
  ADMIN_SECRET: "admin-secret",
};

function post(path: string, body: object, headers: Record<string, string> = {}) {
  return new Request(`https://api.studiolink.dev${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

async function read(response: Response) { return await response.json() as Record<string, unknown>; }

describe("license server endpoints", () => {
  let db: MockDb;
  beforeEach(() => { db = new MockDb(); });

  it("POST /api/license/activate happy path and invalid key", async () => {
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus", polarOrderId: "ord" });
    const ok = await handleRequest(post("/api/license/activate", { licenseKey: license.license_key, machineId: "machine-a" }), env, { db });
    expect(await read(ok)).toMatchObject({ valid: true, status: "ACTIVE" });
    const invalid = await handleRequest(post("/api/license/activate", { licenseKey: "STUDIO-BADK-EYAA-BBBB-CCCC", machineId: "machine-a" }), env, { db });
    expect(await read(invalid)).toMatchObject({ valid: false, error: "INVALID_KEY" });
  });

  it("POST /api/license/activate already activated", async () => {
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus", polarOrderId: "ord" });
    await activateLicense(db, license.license_key, "machine-a");
    const response = await handleRequest(post("/api/license/activate", { licenseKey: license.license_key, machineId: "machine-b" }), env, { db });
    expect(await read(response)).toMatchObject({ valid: false, error: "LICENSE_ALREADY_ACTIVATED" });
  });

  it("POST /api/license/validate happy path and machine mismatch", async () => {
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus", polarOrderId: "ord" });
    await activateLicense(db, license.license_key, "machine-a");
    const ok = await handleRequest(post("/api/license/validate", { licenseKey: license.license_key, machineId: "machine-a" }), env, { db });
    expect(await read(ok)).toMatchObject({ valid: true, status: "ACTIVE" });
    const mismatch = await handleRequest(post("/api/license/validate", { licenseKey: license.license_key, machineId: "machine-b" }), env, { db });
    expect(await read(mismatch)).toMatchObject({ valid: false, error: "MACHINE_MISMATCH" });
  });

  it("admin revoke and status require valid Authorization", async () => {
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus", polarOrderId: "ord" });
    const badRevoke = await handleRequest(post("/api/license/revoke", { licenseKey: license.license_key, reason: "test" }, { authorization: "Bearer wrong" }), env, { db });
    expect(badRevoke.status).toBe(401);
    const goodRevoke = await handleRequest(post("/api/license/revoke", { licenseKey: license.license_key, reason: "test" }, { authorization: "Bearer admin-secret" }), env, { db });
    expect(await read(goodRevoke)).toMatchObject({ ok: true });
    const badStatus = await handleRequest(new Request(`https://api.studiolink.dev/api/license/status?key=${license.license_key}`, { headers: { authorization: "Bearer wrong" } }), env, { db });
    expect(badStatus.status).toBe(401);
    const goodStatus = await handleRequest(new Request(`https://api.studiolink.dev/api/license/status?key=${license.license_key}`, { headers: { authorization: "Bearer admin-secret" } }), env, { db });
    const body = await read(goodStatus);
    expect(body.ok).toBe(true);
    expect((body.license as { status: string }).status).toBe("REVOKED");
  });
});
