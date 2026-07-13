import { describe, expect, it } from "vitest";
import { handleWebsiteRequest, hmacSha256Hex } from "../website-worker/src/index.ts";

const baseEnv = { PUBLIC_DOWNLOADS: "true", POLAR_CHECKOUT_URL: "https://polar.sh/checkout/test" };
const appEnv = {
  ...baseEnv,
  WINDOWS_APP_URL: "https://downloads.example.com/RoAgentMissionControlSetup.exe",
  WINDOWS_APP_SHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  WINDOWS_APP_SIZE: "12345678",
};

class MemoryKv {
  store = new Map<string, string>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async put(key: string, value: string) { this.store.set(key, value); }
}

class MemoryDownloadKv {
  constructor(readonly store = new Map<string, ArrayBuffer>()) {}
  async get(key: string, options: { type: "arrayBuffer" }) {
    return options.type === "arrayBuffer" ? this.store.get(key) ?? null : null;
  }
}

function req(path: string, init?: RequestInit) {
  return new Request(`https://rblxagent.com${path}`, init);
}

describe("website worker", () => {
  it("uses RoAgent branding without legacy Pi Agent copy", async () => {
    const response = await handleWebsiteRequest(req("/"), baseEnv);
    const text = await response.text();
    expect(text).toContain("RoAgent");
    expect(text).not.toContain("Pi Agent");
    expect(text).not.toContain("RblxAgent");
  });

  it("serves daemon release manifest as JSON", async () => {
    const response = await handleWebsiteRequest(req("/api/releases/studiolink.json"), baseEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json() as Record<string, unknown>;
    expect(body.daemonVersion).toBe("3.0.0");
    expect(body.artifacts).toBeTruthy();
  });

  it("includes Mission Control app metadata when configured", async () => {
    const response = await handleWebsiteRequest(req("/api/releases/studiolink.json"), appEnv);
    expect(response.status).toBe(200);
    const body = await response.json() as { desktopApps?: Record<string, { url?: string; sha256?: string; size?: number }> };
    expect(body.desktopApps?.["win32-x64"]?.url).toBe(appEnv.WINDOWS_APP_URL);
    expect(body.desktopApps?.["win32-x64"]?.sha256).toBe(appEnv.WINDOWS_APP_SHA256);
    expect(body.desktopApps?.["win32-x64"]?.size).toBe(12345678);
  });

  it("download page includes purchase, self-installing daemon, bridge plugin, legacy plugin, and recovery links", async () => {
    const response = await handleWebsiteRequest(req("/download"), baseEnv);
    const text = await response.text();
    expect(text).toContain("Purchase / manage access");
    expect(text).toContain("RoAgentMissionControlSetup.exe");
    expect(text).toContain("studiolink-daemon.exe");
    expect(text).toContain("StudioLinkPlugin_Bundled.lua");
    expect(text).toContain("StudioLinkPlugin_LegacyUI.lua");
    expect(text).toContain("Recover downloads");
  });

  it("redirects app installer downloads to the configured URL", async () => {
    const response = await handleWebsiteRequest(req("/downloads/RoAgentMissionControlSetup.exe"), appEnv);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(appEnv.WINDOWS_APP_URL);
  });

  it("serves app installer bytes from KV when uploaded", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const env = {
      ...baseEnv,
      DOWNLOADS_KV: new MemoryDownloadKv(new Map([["releases/3.0.0/windows/RoAgentMissionControlSetup.exe", bytes]])),
    };
    const response = await handleWebsiteRequest(req("/downloads/RoAgentMissionControlSetup.exe"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("RoAgentMissionControlSetup.exe");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it("serves bridge-only plugin bundle as Lua text", async () => {
    const response = await handleWebsiteRequest(req("/downloads/StudioLinkPlugin_Bundled.lua"), baseEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    const text = await response.text();
    expect(text).toContain("StudioLink bridge-only bundled Roblox Studio plugin");
    expect(text).toContain('PLUGIN_VERSION = "2.0.0-bridge"');
    expect(text).not.toContain("CreateDockWidgetPluginGui");
    expect(text).not.toContain("CreateToolbar");
    expect(text).not.toContain("HomePanel");
  });

  it("keeps the legacy UI plugin available under a separate route", async () => {
    const response = await handleWebsiteRequest(req("/downloads/StudioLinkPlugin_LegacyUI.lua"), baseEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("StudioLinkPlugin_LegacyUI.lua");
    const text = await response.text();
    expect(text).toContain("StudioLink bundled Roblox Studio plugin");
    expect(text).toContain("CreateDockWidgetPluginGui");
    expect(text).toContain("CreateToolbar");
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
    expect(body.downloads.desktop).toContain("RoAgentMissionControlSetup.exe");
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
