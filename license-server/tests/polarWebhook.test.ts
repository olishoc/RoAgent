import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlePolarWebhook } from "../src/handlers/polarWebhook.ts";
import { hmacSha256Hex } from "../src/services/polarService.ts";
import { MockDb } from "./mockDb.ts";
import type { Env } from "../src/types.ts";

vi.mock("../src/services/emailService.ts", () => ({ sendLicenseEmail: vi.fn(async () => undefined) }));

const env: Env = {
  POLAR_WEBHOOK_SECRET: "secret",
  POLAR_PRODUCT_ID: "prod_studiolink",
  SUPABASE_URL: "http://example.test",
  SUPABASE_SERVICE_KEY: "service",
  RESEND_API_KEY: "resend",
  ADMIN_SECRET: "admin",
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    type: "order.paid",
    id: "evt_1",
    data: {
      id: "ord_1",
      customer_id: "cus_1",
      product_id: "prod_studiolink",
      attributes: { customer_email: "buyer@example.com" },
    },
    ...overrides,
  };
}

async function signedRequest(body: unknown, secret = env.POLAR_WEBHOOK_SECRET): Promise<Request> {
  const raw = JSON.stringify(body);
  const signature = await hmacSha256Hex(secret, raw);
  return new Request("https://api.studiolink.dev/api/polar/webhook", { method: "POST", headers: { "x-polar-signature": signature }, body: raw });
}

describe("polarWebhook", () => {
  let db: MockDb;
  beforeEach(() => { db = new MockDb(); });

  it("valid signature + order.paid creates license and sends email", async () => {
    const response = await handlePolarWebhook(await signedRequest(event()), { env, db });
    expect(response.status).toBe(200);
    expect(db.tables.get("licenses")!).toHaveLength(1);
    expect(db.tables.get("licenses")![0].email).toBe("buyer@example.com");
  });

  it("invalid signature returns 401", async () => {
    const response = await handlePolarWebhook(await signedRequest(event(), "wrong"), { env, db });
    expect(response.status).toBe(401);
    expect(db.tables.get("licenses")!).toHaveLength(0);
  });

  it("duplicate polar_order_id returns 200 and creates no duplicate", async () => {
    await handlePolarWebhook(await signedRequest(event()), { env, db });
    const response = await handlePolarWebhook(await signedRequest(event()), { env, db });
    expect(response.status).toBe(200);
    expect(db.tables.get("licenses")!).toHaveLength(1);
  });

  it("wrong product ID returns 200 and creates no license", async () => {
    const response = await handlePolarWebhook(await signedRequest(event({ data: { id: "ord_2", customer_id: "cus_1", product_id: "prod_other", attributes: { customer_email: "buyer@example.com" } } })), { env, db });
    expect(response.status).toBe(200);
    expect(db.tables.get("licenses")!).toHaveLength(0);
  });
});
