import { describe, expect, it } from "vitest";
import { activateLicense, createLicense, generateLicenseKey, getLicenseStatus, randomLicenseKey, revokeLicense, SAFE_ALPHABET, validateLicense } from "../src/services/licenseService.ts";
import { MockDb } from "./mockDb.ts";

describe("licenseService", () => {
  it("generateLicenseKey produces correct safe format", async () => {
    const db = new MockDb();
    const key = await generateLicenseKey(db);
    expect(key).toMatch(/^STUDIO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (const char of key.replace(/^STUDIO-/, "").replaceAll("-", "")) expect(SAFE_ALPHABET).toContain(char);
    expect(randomLicenseKey()).toMatch(/^STUDIO-/);
  });

  it("createLicense inserts and returns a full record", async () => {
    const db = new MockDb();
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus_1", polarOrderId: "ord_1" });
    expect(license.license_key).toMatch(/^STUDIO-/);
    expect(license.email).toBe("buyer@example.com");
    expect(license.status).toBe("ACTIVE");
  });

  it("activateLicense succeeds first activation and allows same-machine reactivation", async () => {
    const db = new MockDb();
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus_1", polarOrderId: "ord_1" });
    const first = await activateLicense(db, license.license_key, "machine-a");
    expect(first.valid).toBe(true);
    expect(first.email).toBe("buyer@example.com");
    const second = await activateLicense(db, license.license_key, "machine-a");
    expect(second.valid).toBe(true);
    const status = await getLicenseStatus(db, license.license_key);
    expect(status.activationLog.map((entry) => entry.event)).toContain("activated");
    expect(status.activationLog.map((entry) => entry.event)).toContain("reactivated");
  });

  it("activateLicense rejects second machine and revoked licenses", async () => {
    const db = new MockDb();
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus_1", polarOrderId: "ord_1" });
    await activateLicense(db, license.license_key, "machine-a");
    expect(await activateLicense(db, license.license_key, "machine-b")).toMatchObject({ valid: false, error: "LICENSE_ALREADY_ACTIVATED" });
    await revokeLicense(db, license.license_key, "chargeback");
    expect(await activateLicense(db, license.license_key, "machine-a")).toMatchObject({ valid: false, error: "LICENSE_REVOKED" });
  });

  it("validateLicense succeeds and rejects machine mismatch", async () => {
    const db = new MockDb();
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus_1", polarOrderId: "ord_1" });
    await activateLicense(db, license.license_key, "machine-a");
    expect(await validateLicense(db, license.license_key, "machine-a")).toMatchObject({ valid: true, status: "ACTIVE" });
    expect(await validateLicense(db, license.license_key, "machine-b")).toMatchObject({ valid: false, error: "MACHINE_MISMATCH" });
  });

  it("revokeLicense sets status and logs event", async () => {
    const db = new MockDb();
    const license = await createLicense(db, { email: "buyer@example.com", polarCustomerId: "cus_1", polarOrderId: "ord_1" });
    await revokeLicense(db, license.license_key, "support request");
    const status = await getLicenseStatus(db, license.license_key);
    expect(status.license?.status).toBe("REVOKED");
    expect(status.license?.revoke_reason).toBe("support request");
    expect(status.activationLog[0].event).toBe("revoked");
  });
});
