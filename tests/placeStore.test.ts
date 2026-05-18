import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PlaceStore } from "../server/src/state/placeStore.ts";
import type { Config } from "../server/src/config.ts";
import type { ScriptRecord } from "../shared/protocol.ts";

const tempDirs: string[] = [];

function makeStore(): PlaceStore {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), "roagent-place-store-"));
  tempDirs.push(dataDirectory);
  const config: Config = {
    port: 0,
    host: "127.0.0.1",
    dataDirectory,
    logLevel: "error",
    authToken: "test-token",
    licenseServerUrl: "https://example.invalid",
    repoRoot: dataDirectory,
    startedAt: new Date().toISOString(),
  };
  return new PlaceStore(config);
}

function privatePlace(store: PlaceStore, placeId: string): Map<string, ScriptRecord> {
  return (store as unknown as { loadPlace(placeId: string): Map<string, ScriptRecord> }).loadPlace(placeId);
}

function privateScript(store: PlaceStore, placeId: string, scriptPath: string): ScriptRecord | undefined {
  return [...privatePlace(store, placeId).values()].find((script) => script.path === scriptPath);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("PlaceStore pending Studio deploy", () => {
  it("preserves pending and legacy daemon-only records during snapshot sync", async () => {
    const store = makeStore();
    const placeId = "pending-place";
    await store.create(placeId, {
      path: "ServerScriptService.PendingScript",
      className: "Script",
      source: "print('pending')",
      pendingStudioDeploy: true,
    });
    await store.create(placeId, {
      path: "ServerScriptService.LegacyScript",
      className: "Script",
      source: "print('legacy')",
    });
    const legacy = privateScript(store, placeId, "ServerScriptService.LegacyScript");
    expect(legacy).toBeTruthy();
    delete (legacy as Partial<ScriptRecord>).pendingStudioDeploy;

    const result = await store.syncSnapshot(placeId, { scripts: [] });
    expect(result.deleted.map((script) => script.path)).toEqual([]);
    const active = await store.list(placeId, { includeSource: true });
    expect(active.map((script) => script.path).sort()).toEqual([
      "ServerScriptService.LegacyScript",
      "ServerScriptService.PendingScript",
    ]);
  });

  it("clears pending for Studio-present and acknowledged records", async () => {
    const store = makeStore();
    const placeId = "ack-place";
    await store.create(placeId, {
      path: "ServerScriptService.StudioScript",
      className: "Script",
      source: "print('studio')",
      pendingStudioDeploy: true,
    });
    await store.create(placeId, {
      path: "ServerScriptService.AckScript",
      className: "Script",
      source: "print('ack')",
      pendingStudioDeploy: true,
    });

    await store.syncSnapshot(placeId, {
      scripts: [{ path: "ServerScriptService.StudioScript", className: "Script", source: "print('studio')" }],
    });
    await store.ackDeploy(placeId, [{ path: "ServerScriptService.AckScript" }]);
    const all = await store.list(placeId, { includeSource: true, includeDeleted: true });
    expect(all.find((script) => script.path === "ServerScriptService.StudioScript")?.pendingStudioDeploy).toBe(false);
    expect(all.find((script) => script.path === "ServerScriptService.AckScript")?.pendingStudioDeploy).toBe(false);
  });

  it("tombstones non-pending daemon-only records during snapshot sync", async () => {
    const store = makeStore();
    const placeId = "stale-place";
    await store.create(placeId, {
      path: "ServerScriptService.StaleScript",
      className: "Script",
      source: "print('stale')",
    });

    const result = await store.syncSnapshot(placeId, { scripts: [] });
    expect(result.deleted.map((script) => script.path)).toEqual(["ServerScriptService.StaleScript"]);
    const active = await store.list(placeId);
    expect(active.map((script) => script.path)).not.toContain("ServerScriptService.StaleScript");
  });
});

describe("PlaceStore UniqueId identity", () => {
  it("targets duplicate script paths by uniqueId for writes and deletes", async () => {
    const store = makeStore();
    const placeId = "duplicate-name-place";
    await store.create(placeId, { path: "ServerScriptService.Script", uniqueId: "script-a", className: "Script", source: "print('a')", overwrite: true });
    await store.create(placeId, { path: "ServerScriptService.Script", uniqueId: "script-b", className: "Script", source: "print('b')", overwrite: true });

    await store.write(placeId, { path: "ServerScriptService.Script", uniqueId: "script-b", source: "print('b2')" });
    expect((await store.read(placeId, "ServerScriptService.Script", "script-a")).source).toBe("print('a')");
    expect((await store.read(placeId, "ServerScriptService.Script", "script-b")).source).toBe("print('b2')");

    await expect(store.delete(placeId, { path: "ServerScriptService.Script" })).rejects.toThrow(/Ambiguous script path/);
    await store.delete(placeId, { path: "ServerScriptService.Script", uniqueId: "script-b" });
    const active = await store.list(placeId, { includeSource: true });
    expect(active.find((script) => script.uniqueId === "script-a")?.deleted).toBe(false);
    expect(active.find((script) => script.uniqueId === "script-b")).toBeUndefined();
  });

  it("tombstones only the missing duplicate uniqueId during snapshot sync", async () => {
    const store = makeStore();
    const placeId = "duplicate-snapshot-place";
    await store.create(placeId, { path: "ServerScriptService.Script", uniqueId: "script-a", className: "Script", source: "print('a')", overwrite: true });
    await store.create(placeId, { path: "ServerScriptService.Script", uniqueId: "script-b", className: "Script", source: "print('b')", overwrite: true });

    const result = await store.syncSnapshot(placeId, {
      scripts: [{ path: "ServerScriptService.Script", uniqueId: "script-a", className: "Script", source: "print('a')" }],
    });

    expect(result.deleted.map((script) => script.uniqueId)).toEqual(["script-b"]);
    expect((await store.read(placeId, "ServerScriptService.Script", "script-a")).deleted).toBe(false);
    await expect(store.read(placeId, "ServerScriptService.Script", "script-b")).rejects.toThrow(/Script not found/);
  });

  it("acknowledges pending deploys by uniqueId when duplicate paths exist", async () => {
    const store = makeStore();
    const placeId = "duplicate-ack-place";
    await store.create(placeId, { path: "ServerScriptService.Script", uniqueId: "script-a", className: "Script", source: "print('a')", overwrite: true, pendingStudioDeploy: true });
    await store.create(placeId, { path: "ServerScriptService.Script", uniqueId: "script-b", className: "Script", source: "print('b')", overwrite: true, pendingStudioDeploy: true });

    await expect(store.ackDeploy(placeId, [{ path: "ServerScriptService.Script" }])).rejects.toThrow(/Ambiguous script path/);
    const acknowledged = await store.ackDeploy(placeId, [{ path: "ServerScriptService.Script", uniqueId: "script-b" }]);

    expect(acknowledged).toEqual([{ path: "ServerScriptService.Script", uniqueId: "script-b" }]);
    expect((await store.read(placeId, "ServerScriptService.Script", "script-a")).pendingStudioDeploy).toBe(true);
    expect((await store.read(placeId, "ServerScriptService.Script", "script-b")).pendingStudioDeploy).toBe(false);
  });
});

describe("PlaceStore stale cleanup", () => {
  it("dry-runs candidates without deleting active records", async () => {
    const store = makeStore();
    const placeId = "cleanup-dry-run";
    await store.create(placeId, { path: "ServerScriptService.StaleScript", className: "Script", source: "print('stale')" });

    const result = await store.cleanupStale(placeId, { paths: ["ServerScriptService.StaleScript"] });
    expect(result.dryRun).toBe(true);
    expect(result.candidates.map((script) => script.path)).toEqual(["ServerScriptService.StaleScript"]);
    expect(result.cleaned).toEqual([]);
    const active = await store.list(placeId);
    expect(active.map((script) => script.path)).toContain("ServerScriptService.StaleScript");
  });

  it("confirmed cleanup tombstones active non-pending records", async () => {
    const store = makeStore();
    const placeId = "cleanup-confirm";
    await store.create(placeId, { path: "ServerScriptService.StaleScript", className: "Script", source: "print('stale')" });

    const result = await store.cleanupStale(placeId, { paths: ["ServerScriptService.StaleScript"], confirm: true });
    expect(result.cleaned.map((script) => script.path)).toEqual(["ServerScriptService.StaleScript"]);
    const active = await store.list(placeId);
    expect(active.map((script) => script.path)).not.toContain("ServerScriptService.StaleScript");
    const deleted = await store.list(placeId, { includeDeleted: true });
    expect(deleted.find((script) => script.path === "ServerScriptService.StaleScript")?.deleted).toBe(true);
  });

  it("skips pending records unless includePending is true", async () => {
    const store = makeStore();
    const placeId = "cleanup-pending";
    await store.create(placeId, { path: "ServerScriptService.PendingScript", className: "Script", source: "print('pending')", pendingStudioDeploy: true });

    const skipped = await store.cleanupStale(placeId, { paths: ["ServerScriptService.PendingScript"], confirm: true });
    expect(skipped.cleaned).toEqual([]);
    expect(skipped.skipped).toEqual([{ path: "ServerScriptService.PendingScript", reason: "pending_deploy" }]);

    const cleaned = await store.cleanupStale(placeId, { paths: ["ServerScriptService.PendingScript"], confirm: true, includePending: true });
    expect(cleaned.cleaned.map((script) => script.path)).toEqual(["ServerScriptService.PendingScript"]);
  });

  it("skips legacy records unless includeLegacy is true", async () => {
    const store = makeStore();
    const placeId = "cleanup-legacy";
    await store.create(placeId, { path: "ServerScriptService.LegacyScript", className: "Script", source: "print('legacy')" });
    const legacy = privateScript(store, placeId, "ServerScriptService.LegacyScript");
    expect(legacy).toBeTruthy();
    delete (legacy as Partial<ScriptRecord>).pendingStudioDeploy;

    const skipped = await store.cleanupStale(placeId, { paths: ["ServerScriptService.LegacyScript"], confirm: true });
    expect(skipped.cleaned).toEqual([]);
    expect(skipped.skipped).toEqual([{ path: "ServerScriptService.LegacyScript", reason: "legacy_record" }]);

    const cleaned = await store.cleanupStale(placeId, { paths: ["ServerScriptService.LegacyScript"], confirm: true, includeLegacy: true });
    expect(cleaned.cleaned.map((script) => script.path)).toEqual(["ServerScriptService.LegacyScript"]);
  });
});
