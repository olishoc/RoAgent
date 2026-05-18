import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../server/src/config.ts";
import { autostartStatus } from "../server/src/services/autostartService.ts";
import { checkForUpdate, compareVersions, platformKey, repairReport } from "../server/src/services/updateService.ts";

function config(dir: string): Config {
  return {
    port: 45678,
    host: "127.0.0.1",
    dataDirectory: dir,
    logLevel: "info",
    authToken: "test-token-123",
    licenseServerUrl: "https://api.rblxagent.com",
    repoRoot: join(process.cwd(), ".."),
    startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };
}

function jsonFetch(body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
}

describe("Phase 4 installer/updater services", () => {
  it("compares semantic versions", () => {
    expect(compareVersions("3.0.1", "3.0.0")).toBe(1);
    expect(compareVersions("3.0.0", "3.0.0")).toBe(0);
    expect(compareVersions("2.9.9", "3.0.0")).toBe(-1);
  });

  it("checks a manifest and refuses auto-apply in dev runtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "studiolink-test-"));
    try {
      const key = platformKey();
      const result = await checkForUpdate(config(dir), jsonFetch({
        daemonVersion: "9.0.0",
        updateUrl: "https://rblxagent.com/download",
        artifacts: {
          [key]: {
            platform: key,
            version: "9.0.0",
            url: "https://rblxagent.com/downloads/studiolink-daemon",
            sha256: "a".repeat(64),
          },
        },
      }));
      expect(result.updateAvailable).toBe(true);
      expect(result.artifact?.platform).toBe(key);
      expect(result.canApply).toBe(false);
      expect(result.reason).toContain("development");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports unsupported autostart gracefully on linux", () => {
    const status = autostartStatus();
    if (process.platform === "linux") {
      expect(status.supported).toBe(false);
      expect(status.method).toBe("unsupported");
    } else {
      expect(status.platform).toBe(process.platform);
    }
  });

  it("repair report recreates data directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "studiolink-repair-"));
    rmSync(dir, { recursive: true, force: true });
    const report = repairReport(config(dir)) as { repaired: boolean; checks: { dataDirectory: { ok: boolean } } };
    expect(report.repaired).toBe(true);
    expect(report.checks.dataDirectory.ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
