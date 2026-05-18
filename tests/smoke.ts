import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { PROTOCOL_VERSION, type ProtocolMessage } from "../shared/protocol.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const serverRoot = path.join(repoRoot, "server");
const port = 19000 + Math.floor(Math.random() * 1000);
const token = "smoke-token";
const dataDir = mkdtempSync(path.join(tmpdir(), "roagent-smoke-"));
const placeId = "smoke-place";

let child: ChildProcess;
let ws: WebSocket;

function waitForDaemon(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Daemon startup timed out")), 15_000);
    proc.stdout?.on("data", (chunk) => {
      if (chunk.toString().includes("RoAgent daemon listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("failed") || text.includes("error")) {
        clearTimeout(timeout);
        reject(new Error(text));
      }
    });
    proc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Daemon exited with ${code}`));
      }
    });
  });
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function request<TPayload extends object>(type: string, payload: TPayload): Promise<ProtocolMessage> {
  const requestId = randomUUID();
  const frame = { version: PROTOCOL_VERSION, type, requestId, placeId, payload };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 10_000);

    const onMessage = (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString()) as ProtocolMessage;
      if (msg.requestId !== requestId) return;
      clearTimeout(timeout);
      ws.off("message", onMessage);
      resolve(msg);
    };

    ws.on("message", onMessage);
    ws.send(JSON.stringify(frame));
  });
}

async function expectResponse(requestType: string, payload: object) {
  const response = await request(requestType, payload);
  expect(response.requestId).toBeTruthy();
  expect(response.type).toBe(`${requestType}:response`);
  expect(response.type).not.toBe("error");
  expect(response.payload).toBeTruthy();
  return response;
}

describe("RoAgent daemon smoke", () => {
  beforeAll(async () => {
    child = spawn("npm", ["start"], {
      cwd: serverRoot,
      env: {
        ...process.env,
        PLUGIN_PORT: String(port),
        PLUGIN_DATA_DIR: dataDir,
        PLUGIN_LOG_LEVEL: "debug",
        PLUGIN_AUTH_TOKEN: token,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForDaemon(child);
    ws = await connect();
  }, 30_000);

  afterAll(() => {
    ws?.close();
    child?.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("requires token auth for HTTP agent routes", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/agent/script/list`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-studiolink-place-id": placeId },
      body: JSON.stringify({ placeId }),
    });
    expect(response.status).toBe(401);
  });

  it("rejects unsafe browser URLs before OS open", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/open-url?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "javascript:alert(1)" }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects protected runtime, camera, and unknown-root script paths", async () => {
    const response = await request("script:create", {
      path: "StarterPlayer.StarterPlayerScripts.PlayerModule.CameraModule.CameraScript",
      className: "LocalScript",
      source: "print('unsafe')",
      overwrite: true,
    });
    expect(response.type).toBe("error");
    expect(JSON.stringify(response.payload)).toContain("Protected script path");

    const unknownRoot = await request("script:create", {
      path: "NotAService.BadScript",
      className: "Script",
      source: "print('unsafe')",
      overwrite: true,
    });
    expect(unknownRoot.type).toBe("error");
    expect(JSON.stringify(unknownRoot.payload)).toContain("Protected script path");
  });

  it("subscribes, performs script CRUD, and unsubscribes", async () => {
    const subscribe = await expectResponse("watch:subscribe", { includeSource: true });
    const subscriptionId = (subscribe.payload as { subscriptionId: string }).subscriptionId;

    await expectResponse("script:create", {
      path: "ServerScriptService.SmokeScript",
      className: "Script",
      source: "print('created')",
      overwrite: false,
      origin: "studio-plugin",
    });

    await expectResponse("script:write", {
      path: "ServerScriptService.SmokeScript",
      source: "print('written')",
      origin: "studio-plugin",
    });

    const history = await expectResponse("history:get", { path: "ServerScriptService.SmokeScript", includeSource: false });
    expect(JSON.stringify(history.payload)).toContain('"actor":"studio-plugin"');
    expect(JSON.stringify(history.payload)).toContain('"action":"created"');
    expect(JSON.stringify(history.payload)).toContain('"action":"updated"');

    const read = await expectResponse("script:read", { path: "ServerScriptService.SmokeScript" });
    expect(JSON.stringify(read.payload)).toContain("written");

    const versions = (history.payload as { versions: Array<{ action: string; versionId: string; source?: string }> }).versions;
    const createdVersion = versions.find((version) => version.action === "created");
    expect(createdVersion?.versionId).toBeTruthy();
    await expectResponse("script:restore", {
      path: "ServerScriptService.SmokeScript",
      versionId: createdVersion?.versionId,
      pendingStudioDeploy: true,
    });
    const restoredRead = await expectResponse("script:read", { path: "ServerScriptService.SmokeScript" });
    expect((restoredRead.payload as { script: { source: string; pendingStudioDeploy?: boolean } }).script.source).toBe("print('created')");
    expect((restoredRead.payload as { script: { source: string; pendingStudioDeploy?: boolean } }).script.pendingStudioDeploy).toBe(true);

    await expectResponse("script:write", {
      path: "ServerScriptService.SmokeScript",
      source: "",
    });
    const emptyRead = await expectResponse("script:read", { path: "ServerScriptService.SmokeScript" });
    expect((emptyRead.payload as { script: { source: string } }).script.source).toBe("");

    await expectResponse("script:create", {
      path: "ServerScriptService.PendingScript",
      className: "Script",
      source: "print('pending')",
      overwrite: false,
      pendingStudioDeploy: true,
    });
    await expectResponse("script:syncSnapshot", {
      scripts: [{ path: "ServerScriptService.SmokeScript", className: "Script", source: "" }],
    });
    const pendingList = await expectResponse("script:list", { includeSource: true });
    expect(JSON.stringify(pendingList.payload)).toContain("ServerScriptService.PendingScript");
    await expectResponse("script:ackDeploy", { paths: ["ServerScriptService.PendingScript"] });
    const ackedPendingList = await expectResponse("script:list", { includeSource: true, includeDeleted: true });
    expect(JSON.stringify(ackedPendingList.payload)).toContain("ServerScriptService.PendingScript");
    expect(JSON.stringify(ackedPendingList.payload)).toContain('"pendingStudioDeploy":false');

    await expectResponse("script:create", {
      path: "ServerScriptService.StaleScript",
      className: "Script",
      source: "print('stale')",
      overwrite: false,
    });
    const watchEvents: ProtocolMessage[] = [];
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as ProtocolMessage;
      if (message.type === "watch:event") watchEvents.push(message);
    });
    await expectResponse("script:syncSnapshot", {
      scripts: [{ path: "ServerScriptService.SmokeScript", className: "Script", source: "" }],
    });
    const activeList = await expectResponse("script:list", { includeSource: true });
    expect(JSON.stringify(activeList.payload)).toContain("ServerScriptService.SmokeScript");
    expect(JSON.stringify(activeList.payload)).not.toContain("ServerScriptService.PendingScript");
    expect(JSON.stringify(activeList.payload)).not.toContain("ServerScriptService.StaleScript");
    const deletedList = await expectResponse("script:list", { includeSource: true, includeDeleted: true });
    expect(JSON.stringify(deletedList.payload)).toContain("ServerScriptService.StaleScript");
    expect(JSON.stringify(deletedList.payload)).toContain('"deleted":true');
    const snapshotDelete = watchEvents.find((message) => JSON.stringify(message.payload).includes("ServerScriptService.StaleScript"));
    expect(snapshotDelete).toBeTruthy();
    expect((snapshotDelete?.payload as { origin?: string }).origin).toBe("studio-snapshot");

    await expectResponse("script:create", {
      path: "ServerScriptService.CleanupTarget",
      className: "Script",
      source: "print('cleanup')",
      overwrite: false,
    });
    const cleanup = await expectResponse("script:cleanupStale", { paths: ["ServerScriptService.CleanupTarget"], confirm: true });
    expect(JSON.stringify(cleanup.payload)).toContain('"cleanedCount":1');
    const afterCleanupActive = await expectResponse("script:list", { includeSource: true });
    expect(JSON.stringify(afterCleanupActive.payload)).not.toContain("ServerScriptService.CleanupTarget");
    const afterCleanupDeleted = await expectResponse("script:list", { includeSource: true, includeDeleted: true });
    expect(JSON.stringify(afterCleanupDeleted.payload)).toContain("ServerScriptService.CleanupTarget");
    expect(JSON.stringify(afterCleanupDeleted.payload)).toContain('"deleted":true');

    await expectResponse("script:delete", { path: "ServerScriptService.SmokeScript", origin: "studio-plugin" });
    const finalHistory = await expectResponse("history:get", { path: "ServerScriptService.SmokeScript", includeSource: false });
    expect(JSON.stringify(finalHistory.payload)).toContain('"actor":"studio-plugin"');
    const finalDeleted = await expectResponse("history:getDeleted", { includeSource: false });
    expect(JSON.stringify(finalDeleted.payload)).toContain("ServerScriptService.SmokeScript");
    const deletedScript = (finalDeleted.payload as { scripts: Array<{ path: string; lastVersionId: string }> }).scripts.find((script) => script.path === "ServerScriptService.SmokeScript");
    expect(deletedScript?.lastVersionId).toBeTruthy();
    await expectResponse("script:restore", {
      path: "ServerScriptService.SmokeScript",
      versionId: deletedScript?.lastVersionId,
      pendingStudioDeploy: true,
    });
    const restoredDeletedRead = await expectResponse("script:read", { path: "ServerScriptService.SmokeScript" });
    expect((restoredDeletedRead.payload as { script: { deleted: boolean; pendingStudioDeploy?: boolean } }).script.deleted).toBe(false);
    expect((restoredDeletedRead.payload as { script: { deleted: boolean; pendingStudioDeploy?: boolean } }).script.pendingStudioDeploy).toBe(true);
    await expectResponse("watch:unsubscribe", { subscriptionId });
  });
});
