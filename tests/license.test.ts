import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Config } from "../server/src/config.ts";
import { LicenseManager, type LicenseServerResponse } from "../server/src/services/licenseManager.ts";
import { AppError } from "../server/src/errors.ts";
import { ErrorCode } from "../shared/protocol.ts";

function config(dataDirectory: string): Config {
  return {
    port: 0,
    host: "127.0.0.1",
    dataDirectory,
    logLevel: "error",
    authToken: "license-test-token",
    repoRoot: path.resolve(new URL("..", import.meta.url).pathname),
    startedAt: new Date().toISOString(),
  };
}

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "studiolink-license-"));
}

function jsonResponse(body: LicenseServerResponse, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function fetcher(bodyOrError: LicenseServerResponse | Error, calls: Array<Record<string, unknown>> = []): typeof fetch {
  return (async (_url, init) => {
    calls.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    if (bodyOrError instanceof Error) throw bodyOrError;
    return jsonResponse(bodyOrError, !bodyOrError.error);
  }) as typeof fetch;
}

function httpFetcher(body: LicenseServerResponse, status: number): typeof fetch {
  return (async () => jsonResponse(body, status >= 200 && status < 300, status)) as typeof fetch;
}

describe("LicenseManager", () => {
  it("starts unlicensed with a 7-day grace period and stable machine id", () => {
    const dir = tempDir();
    try {
      const now = new Date("2026-01-01T00:00:00.000Z");
      const manager = new LicenseManager(config(dir), { now: () => now });
      const first = manager.status();
      const second = manager.status();
      expect(first.status).toBe("UNLICENSED");
      expect(first.daysRemaining).toBe(7);
      expect(first.machineId).toMatch(/^[a-f0-9]{64}$/);
      expect(second.machineId).toBe(first.machineId);
      expect(readFileSync(path.join(dir, "machine.id"), "utf8").trim()).toBe(first.machineId);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("counts down the evaluation grace period", () => {
    const dir = tempDir();
    try {
      const start = new Date("2026-01-01T00:00:00.000Z");
      const manager = new LicenseManager(config(dir), { now: () => start });
      expect(manager.status().daysRemaining).toBe(7);
      const later = new LicenseManager(config(dir), { now: () => new Date("2026-01-04T01:00:00.000Z") });
      expect(later.status().status).toBe("UNLICENSED");
      expect(later.status().daysRemaining).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("activates through the StudioLink license server and persists license data securely", async () => {
    const dir = tempDir();
    try {
      const calls: Array<Record<string, unknown>> = [];
      const manager = new LicenseManager(config(dir), {
        now: () => new Date("2026-01-01T00:00:00.000Z"),
        fetcher: fetcher({ valid: true, status: "ACTIVE", activatedAt: "2026-01-01T00:00:00.000Z", email: "buyer@example.com" }, calls),
      });
      const status = await manager.activate("sl-valid-license");
      expect(status.status).toBe("ACTIVE");
      expect(status.licenseeEmail).toBe("buyer@example.com");
      expect(status.plan).toBe("StudioLink");
      expect(calls[0].licenseKey).toBe("sl-valid-license");
      expect(calls[0].machineId).toBe(status.machineId);
      const file = path.join(dir, "license.json");
      expect(readFileSync(file, "utf8")).toContain("sl-valid-license");
      if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("maps activation failures to license errors", async () => {
    const dir = tempDir();
    try {
      const manager = new LicenseManager(config(dir), { fetcher: fetcher({ valid: false, error: "LICENSE_ALREADY_ACTIVATED" }) });
      await expect(manager.activate("sl-used-license")).rejects.toMatchObject({ code: ErrorCode.LICENSE_ALREADY_ACTIVATED } satisfies Partial<AppError>);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits revoked when revalidation reports an invalid license", async () => {
    const dir = tempDir();
    try {
      const manager = new LicenseManager(config(dir), { fetcher: fetcher({ valid: true, status: "ACTIVE", email: "buyer@example.com" }) });
      await manager.activate("sl-valid-license");
      const revoked = new LicenseManager(config(dir), { fetcher: fetcher({ valid: false, error: "LICENSE_REVOKED" }) });
      const event = await revoked.revalidate();
      expect(event?.type).toBe("revoked");
      expect(revoked.status().status).toBe("UNLICENSED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns EXPIRED instead of revoked when revalidation reports expiration", async () => {
    const dir = tempDir();
    try {
      const active = new LicenseManager(config(dir), { fetcher: fetcher({ valid: true, status: "ACTIVE", email: "buyer@example.com" }) });
      await active.activate("sl-valid-license");
      const expired = new LicenseManager(config(dir), { fetcher: fetcher({ valid: false, error: "LICENSE_EXPIRED" }) });
      const event = await expired.revalidate();
      expect(event?.type).toBe("warning");
      expect(expired.status().status).toBe("EXPIRED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enters GRACE mode after three consecutive revalidation network failures", async () => {
    const dir = tempDir();
    try {
      const active = new LicenseManager(config(dir), { fetcher: fetcher({ valid: true, status: "ACTIVE", email: "buyer@example.com" }) });
      await active.activate("sl-valid-license");
      const failing = new LicenseManager(config(dir), { fetcher: fetcher(new Error("network down")) });
      expect(await failing.revalidate()).toBeUndefined();
      expect(await failing.revalidate()).toBeUndefined();
      const event = await failing.revalidate();
      expect(event?.type).toBe("warning");
      expect(failing.status().status).toBe("GRACE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats HTTP 500 and 429 revalidation responses as temporary failures", async () => {
    const dir = tempDir();
    try {
      const active = new LicenseManager(config(dir), { fetcher: fetcher({ valid: true, status: "ACTIVE", email: "buyer@example.com" }) });
      await active.activate("sl-valid-license");
      const failing = new LicenseManager(config(dir), { fetcher: httpFetcher({ error: "server busy" }, 500) });
      await failing.revalidate();
      const rateLimited = new LicenseManager(config(dir), { fetcher: httpFetcher({ error: "rate limited" }, 429) });
      await rateLimited.revalidate();
      const event = await rateLimited.revalidate();
      expect(event?.type).toBe("warning");
      expect(rateLimited.status().status).toBe("GRACE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
