import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { PROTOCOL_VERSION, type ProtocolMessage } from "../shared/protocol.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const serverRoot = path.join(repoRoot, "server");
const roagentPath = path.join(repoRoot, "roagent", "dist", process.platform === "win32" ? "roagent.exe" : "roagent");
const port = 21000 + Math.floor(Math.random() * 2000);
const token = "e2e-test-token";
const dataDir = mkdtempSync(path.join(tmpdir(), "studiolink-e2e-"));
const placeA = `place-a-${randomUUID()}`;
const placeB = `place-b-${randomUUID()}`;

let child: ChildProcess;
let wsA: WebSocket;
let wsB: WebSocket;

function waitForDaemon(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Daemon startup timed out. Output:\n${output}`)), 20_000);
    proc.stdout?.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("RoAgent daemon listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Daemon exited with ${code}. Output:\n${output}`));
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

function send(socket: WebSocket, placeId: string, type: string, payload: object): Promise<ProtocolMessage> {
  const requestId = randomUUID();
  const frame = { version: PROTOCOL_VERSION, type, requestId, placeId, payload };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 10_000);
    const onMessage = (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString()) as ProtocolMessage;
      if (msg.requestId !== requestId) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(msg);
    };
    socket.on("message", onMessage);
    socket.send(JSON.stringify(frame));
  });
}

async function ok(socket: WebSocket, placeId: string, type: string, payload: object = {}) {
  const response = await send(socket, placeId, type, payload);
  expect(response.version).toBe(PROTOCOL_VERSION);
  expect(response.type).toBe(`${type}:response`);
  expect(response.placeId).toBe(placeId);
  expect(response.payload).toBeTruthy();
  return response;
}

function collect(socket: WebSocket): ProtocolMessage[] {
  const messages: ProtocolMessage[] = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw.toString()) as ProtocolMessage));
  return messages;
}

async function httpJson(route: string, body?: object, method = "POST", authenticated = true) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-studiolink-place-id": placeA,
      ...(authenticated ? { "x-roagent-token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json() as Record<string, unknown>;
  return { status: response.status, json };
}

async function waitUntil(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

describe("StudioLink prompts 1-6 integrated behavior", () => {
  beforeAll(async () => {
    child = spawn("npm", ["start"], {
      cwd: serverRoot,
      env: {
        ...process.env,
        PATH: `${path.dirname(roagentPath)}${path.delimiter}${process.env.PATH ?? ""}`,
        PLUGIN_PORT: String(port),
        PLUGIN_DATA_DIR: dataDir,
        PLUGIN_LOG_LEVEL: "error",
        PLUGIN_AUTH_TOKEN: token,
        STUDIOLINK_ROAGENT_PATH: roagentPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForDaemon(child);
    wsA = await connect();
    wsB = await connect();
  }, 30_000);

  afterAll(() => {
    wsA?.close();
    wsB?.close();
    child?.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns typed errors for malformed protocol envelopes", async () => {
    const response = await new Promise<ProtocolMessage>((resolve) => {
      wsA.once("message", (raw) => resolve(JSON.parse(raw.toString()) as ProtocolMessage));
      wsA.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "script:list", placeId: placeA, payload: {} }));
    });
    expect(response.type).toBe("error");
    expect(JSON.stringify(response.payload)).toContain("Missing requestId");
  });

  it("reports daemon health on the installer port", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    const health = await response.json() as Record<string, unknown>;
    expect(health.version).toBe("3.0.0");
    expect(health.roAgentInstalled).toBe(true);
    expect(health.roAgentPath).toBe(roagentPath);
    expect(health.gitInstalled).toBe(true);
    expect(health.licenseStatus).toBe("UNLICENSED");
    expect(typeof health.uptime).toBe("number");
  });

  it("pushes license warnings to new WebSocket clients and returns license status", async () => {
    const socket = await connect();
    try {
      const warning = await new Promise<ProtocolMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for license warning")), 5_000);
        socket.once("message", (raw) => {
          clearTimeout(timeout);
          resolve(JSON.parse(raw.toString()) as ProtocolMessage);
        });
      });
      expect(warning.type).toBe("license:warning");
      expect(JSON.stringify(warning.payload)).toContain("7");
      const status = await ok(socket, placeA, "license:status", {});
      expect((status.payload as { status: string }).status).toBe("UNLICENSED");
      expect((status.payload as { machineId: string }).machineId).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      socket.close();
    }
  });

  it("keeps script, history, and watch traffic isolated by placeId", async () => {
    const seenA = collect(wsA);
    const seenB = collect(wsB);
    const subA = await ok(wsA, placeA, "watch:subscribe", { includeSource: true });
    const subB = await ok(wsB, placeB, "watch:subscribe", { includeSource: true });
    const subAId = (subA.payload as { subscriptionId: string }).subscriptionId;
    const subBId = (subB.payload as { subscriptionId: string }).subscriptionId;

    const created = await ok(wsA, placeA, "script:create", {
      path: "ServerScriptService.GameManager",
      className: "Script",
      source: "print('created')",
    });
    expect(JSON.stringify(created.payload)).toContain("GameManager");
    await waitUntil(() => seenA.some((m) => m.type === "watch:event" && m.placeId === placeA), "place A watch event");
    expect(seenB.some((m) => m.type === "watch:event" && m.placeId === placeA)).toBe(false);

    await ok(wsA, placeA, "script:write", { path: "ServerScriptService.GameManager", source: "print('updated')" });
    const read = await ok(wsA, placeA, "script:read", { path: "ServerScriptService.GameManager" });
    expect(JSON.stringify(read.payload)).toContain("updated");

    const list = await ok(wsA, placeA, "script:list", { includeSource: true });
    expect(JSON.stringify(list.payload)).toContain("ServerScriptService.GameManager");

    await ok(wsA, placeA, "script:rename", { fromPath: "ServerScriptService.GameManager", toPath: "ServerScriptService.GameController" });
    await ok(wsA, placeA, "script:delete", { path: "ServerScriptService.GameController" });

    const history = await ok(wsA, placeA, "history:get", { path: "ServerScriptService.GameController", includeSource: true });
    expect(JSON.stringify(history.payload)).toContain("deleted");
    const deleted = await ok(wsA, placeA, "history:getDeleted", { includeSource: true });
    expect(JSON.stringify(deleted.payload)).toContain("ServerScriptService.GameController");

    await ok(wsA, placeA, "watch:unsubscribe", { subscriptionId: subAId });
    await ok(wsB, placeB, "watch:unsubscribe", { subscriptionId: subBId });
  });

  it("supports git status, commit, log, diff, restore, and sanitized remotes", async () => {
    await ok(wsA, placeA, "script:create", {
      path: "ServerScriptService.GitScript",
      className: "Script",
      source: "print('one')",
    });
    const firstCommit = await ok(wsA, placeA, "git:commit", { message: "first e2e commit" });
    const firstHash = ((firstCommit.payload as { commit: { hash: string } }).commit.hash);

    await ok(wsA, placeA, "script:write", { path: "ServerScriptService.GitScript", source: "print('two')" });
    const secondCommit = await ok(wsA, placeA, "git:commit", { message: "second e2e commit" });
    const secondHash = ((secondCommit.payload as { commit: { hash: string } }).commit.hash);

    const log = await ok(wsA, placeA, "git:log", { limit: 5 });
    expect((log.payload as { commits: unknown[] }).commits.length).toBeGreaterThanOrEqual(2);

    const diff = await ok(wsA, placeA, "git:diff", { path: "scripts.json", fromCommit: firstHash, toCommit: secondHash });
    expect(JSON.stringify(diff.payload)).toContain("GitScript");

    const restore = await ok(wsA, placeA, "git:restore", { path: "scripts.json", commit: firstHash });
    expect(JSON.stringify(restore.payload)).toContain(firstHash);

    const remote = await ok(wsA, placeA, "git:setRemote", { remoteUrl: "https://secret-token@github.com/example/studiolink.git" });
    expect(JSON.stringify(remote.payload)).toContain("https://github.com/example/studiolink.git");
    expect(JSON.stringify(remote.payload)).not.toContain("secret-token");
    const credentialsFile = path.join(dataDir, "places", encodeURIComponent(placeA), ".credentials");
    expect(existsSync(credentialsFile)).toBe(true);
    expect(readFileSync(credentialsFile, "utf8")).toContain("secret-token");
  });

  it("exposes RoAgent HTTP endpoints, action pushes, and recent actions", async () => {
    const seen = collect(wsA);
    await ok(wsA, placeA, "watch:subscribe", { includeSource: false });

    const create = await httpJson("/agent/script/create", { placeId: placeA, path: "ServerScriptService.AgentMade", content: "print('agent')" });
    expect(create.status).toBe(200);
    expect(create.json.success).toBe(true);
    expect(JSON.stringify(create.json)).toContain('"pendingStudioDeploy":true');

    const inferredLocalCreate = await httpJson("/agent/script/create", { placeId: placeA, path: "StarterPlayer.StarterPlayerScripts.AgentClientInferred", content: "print('client inferred')" });
    expect(inferredLocalCreate.status).toBe(200);
    expect(JSON.stringify(inferredLocalCreate.json)).toContain('"className":"LocalScript"');
    const localCreate = await httpJson("/agent/script/create", { placeId: placeA, path: "StarterPlayer.StarterPlayerScripts.AgentClient", className: "LocalScript", content: "print('client')" });
    expect(localCreate.status).toBe(200);
    expect(JSON.stringify(localCreate.json)).toContain('"className":"LocalScript"');
    const moduleCreate = await httpJson("/agent/script/create", { placeId: placeA, path: "ReplicatedStorage.AgentModule", className: "ModuleScript", content: "return {}" });
    expect(moduleCreate.status).toBe(200);
    expect(JSON.stringify(moduleCreate.json)).toContain('"className":"ModuleScript"');

    const write = await httpJson("/agent/script/write", { placeId: placeA, path: "ServerScriptService.AgentMade", content: "print('agent updated')" });
    expect(write.status).toBe(200);
    expect(write.json.success).toBe(true);
    expect(JSON.stringify(write.json)).toContain('"pendingStudioDeploy":true');

    const rename = await httpJson("/agent/script/rename", { placeId: placeA, from: "ServerScriptService.AgentMade", to: "ServerScriptService.AgentRenamed" });
    expect(rename.status).toBe(200);
    expect(rename.json.success).toBe(true);
    expect(JSON.stringify(rename.json)).toContain('"pendingStudioDeploy":true');

    await waitUntil(() => seen.filter((m) => m.type === "agent:action" && m.placeId === placeA).length >= 3, "agent action pushes");
    const recent = await ok(wsA, placeA, "agent:recentActions", {});
    expect(JSON.stringify(recent.payload)).toContain("Renamed ServerScriptService.AgentMade → ServerScriptService.AgentRenamed");

    await httpJson("/agent/script/create", { placeId: placeA, path: "ServerScriptService.Script", uniqueId: "agent-script-a", content: "print('a')", overwrite: true });
    await httpJson("/agent/script/create", { placeId: placeA, path: "ServerScriptService.Script", uniqueId: "agent-script-b", content: "print('b')", overwrite: true });
    const duplicateWrite = await httpJson("/agent/script/write", { placeId: placeA, path: "ServerScriptService.Script", uniqueId: "agent-script-b", content: "print('b2')" });
    expect(duplicateWrite.status).toBe(200);
    const pathOnlyDelete = await httpJson("/agent/script/delete", { placeId: placeA, path: "ServerScriptService.Script" });
    expect(pathOnlyDelete.status).toBe(400);
    expect(pathOnlyDelete.json.error).toContain("Ambiguous script path");
    const targetedDelete = await httpJson("/agent/script/delete", { placeId: placeA, path: "ServerScriptService.Script", uniqueId: "agent-script-b" });
    expect(targetedDelete.status).toBe(200);
    const duplicateRead = await httpJson("/agent/script/read", { placeId: placeA, path: "ServerScriptService.Script", uniqueId: "agent-script-a" });
    expect(JSON.stringify(duplicateRead.json)).toContain("print('a')");

    const logFile = path.join(dataDir, "ai", encodeURIComponent(placeA), "actions.jsonl");
    const log = readFileSync(logFile, "utf8");
    expect(log).toContain("script_create");
    expect(log).toContain("script_write");
    expect(log).not.toContain("agent updated");
  });

  it("requires auth and validates config API key input without crashing", async () => {
    const unauthorized = await httpJson("/config/api-key", { provider: "bad", apiKey: "short", model: "none" }, "POST", false);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.json.success).toBe(false);

    const invalid = await httpJson("/config/api-key", { provider: "bad", apiKey: "short", model: "none" });
    expect(invalid.status).toBe(400);
    expect(invalid.json.success).toBe(false);

    const repairUnauthorized = await httpJson("/daemon/repair", {}, "POST", false);
    expect(repairUnauthorized.status).toBe(401);
    expect(repairUnauthorized.json.success).toBe(false);

    const repair = await httpJson("/daemon/repair", {});
    expect(repair.status).toBe(200);
    expect(repair.json.success).toBe(true);
    expect(JSON.stringify(repair.json)).toContain("dataDirectory");
  });
});
