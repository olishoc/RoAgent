import { describe, expect, it } from "vitest";
import { handleWebsiteRequest, hmacSha256Hex } from "../website-worker/src/index.ts";

const baseEnv = { PUBLIC_DOWNLOADS: "true", POLAR_CHECKOUT_URL: "https://polar.sh/checkout/test" };

class MemoryKv {
  store = new Map<string, string>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async put(key: string, value: string) { this.store.set(key, value); }
}

function req(path: string, init?: RequestInit) {
  return new Request(`https://rblxagent.com${path}`, init);
}

describe("website worker", () => {
  it("serves daemon release manifest as JSON", async () => {
    const response = await handleWebsiteRequest(req("/api/releases/studiolink.json"), baseEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json() as Record<string, unknown>;
    expect(body.daemonVersion).toBe("3.0.0");
    expect(body.artifacts).toBeTruthy();
  });

  it("download page includes purchase, self-installing daemon, plugin, and recovery links", async () => {
    const response = await handleWebsiteRequest(req("/download"), baseEnv);
    const text = await response.text();
    expect(text).toContain("Purchase / manage access");
    expect(text).toContain("studiolink-daemon.exe");
    expect(text).toContain("StudioLinkPlugin_Bundled.lua");
    expect(text).toContain("Recover downloads");
  });

  it("serves plugin bundle as Lua text", async () => {
    const response = await handleWebsiteRequest(req("/downloads/StudioLinkPlugin_Bundled.lua"), baseEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("StudioLink bundled Roblox Studio plugin");
  });

  it("returns controlled 404 when installer artifact is not uploaded", async () => {
    const response = await handleWebsiteRequest(req("/downloads/studiolink-daemon.exe"), baseEnv);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("not uploaded");
  });

  it("public recovery returns direct download links", async () => {
    const response = await handleWebsiteRequest(req("/api/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "Buyer@Example.com" }),
    }), baseEnv);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; email: string; downloads: Record<string, string> };
    expect(body.ok).toBe(true);
    expect(body.email).toBe("buyer@example.com");
    expect(body.downloads.windows).toContain("studiolink-daemon.exe");
  });

  it("webhook without configured secret fails safely", async () => {
    const response = await handleWebsiteRequest(req("/api/polar/webhook", { method: "POST", body: "{}" }), baseEnv);
    expect(response.status).toBe(503);
  });

  it("valid polar webhook stores an entitlement", async () => {
    const kv = new MemoryKv();
    const env = { ...baseEnv, PUBLIC_DOWNLOADS: "false", POLAR_WEBHOOK_SECRET: "secret", POLAR_PRODUCT_ID: "prod_123", ENTITLEMENTS: kv };
    const event = { type: "order.paid", id: "evt_1", data: { id: "ord_1", customer_id: "cus_1", product_id: "prod_123", attributes: { customer_email: "buyer@example.com" } } };
    const raw = JSON.stringify(event);
    const signature = await hmacSha256Hex("secret", raw);
    const response = await handleWebsiteRequest(req("/api/polar/webhook", { method: "POST", headers: { "x-polar-signature": signature }, body: raw }), env);
    expect(response.status).toBe(200);
    expect(kv.store.get("order:ord_1")).toContain("buyer@example.com");
  });
});
