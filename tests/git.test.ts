import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type WebSocket from "ws";
import { PROTOCOL_VERSION, type ClientToServerMessage } from "../shared/protocol.ts";
import type { Config } from "../server/src/config.ts";
import type { AppLogger } from "../server/src/logger.ts";
import { PlaceStore } from "../server/src/state/placeStore.ts";
import { HistoryStore } from "../server/src/history/historyStore.ts";
import { WatchService } from "../server/src/watch/watchService.ts";
import { AgentService } from "../server/src/services/agentService.ts";
import { LicenseService } from "../server/src/services/licenseService.ts";
import type { HandlerContext } from "../server/src/types.ts";
import { gitHandlers } from "../server/src/handlers/gitHandlers.ts";

const placeId = "git-test-place";
let dataDirectory: string;
let context: HandlerContext;
let originalFetch: typeof globalThis.fetch;

const logger: AppLogger = {
  raw: {} as AppLogger["raw"],
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  sanitizeError: (error) => ({ message: error instanceof Error ? error.message : String(error) }),
};

function message(type: string, payload: object): ClientToServerMessage {
  return { version: PROTOCOL_VERSION, type, requestId: crypto.randomUUID(), placeId, payload } as ClientToServerMessage;
}

async function handle(type: string, payload: object) {
  const handler = gitHandlers[type];
  if (!handler) throw new Error(`Missing handler ${type}`);
  return handler(message(type, payload), context, {} as WebSocket);
}

function repoPath(): string {
  return path.join(dataDirectory, "places", encodeURIComponent(placeId));
}

describe("gitHandlers integration", () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    dataDirectory = mkdtempSync(path.join(tmpdir(), "roagent-git-"));
    const config: Config = {
      port: 0,
      host: "127.0.0.1",
      dataDirectory,
      logLevel: "error",
      authToken: "test-token",
      repoRoot: path.resolve(new URL("..", import.meta.url).pathname),
      startedAt: new Date().toISOString(),
    };
    context = {
      config,
      logger,
      placeStore: new PlaceStore(config),
      historyStore: new HistoryStore(config, logger),
      watchService: new WatchService(config, logger),
      agentService: new AgentService(),
      licenseService: new LicenseService(config),
      connections: new Set<WebSocket>(),
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it("stores sanitized remotes and credentials separately", async () => {
    const response = await handle("git:setRemote", { remoteUrl: "https://secret-token@github.com/org/repo.git" }) as { url: string; remote: string };
    expect(response.remote).toBe("origin");
    expect(response.url).toBe("https://github.com/org/repo.git");
    expect(response.url).not.toContain("secret-token");

    const config = JSON.parse(readFileSync(path.join(repoPath(), "config.json"), "utf8")) as { remoteUrl: string };
    expect(config.remoteUrl).toBe("https://github.com/org/repo.git");
    expect(config.remoteUrl).not.toContain("secret-token");

    const credentialsPath = path.join(repoPath(), ".credentials");
    expect(readFileSync(credentialsPath, "utf8")).toContain("secret-token");
    if (process.platform !== "win32") expect(statSync(credentialsPath).mode & 0o777).toBe(0o600);
  });

  it("configures GitHub automation and creates a sanitized remote", async () => {
    const statusBefore = await handle("git:githubStatus", {}) as { enabled: boolean; hasToken: boolean; privateRepos: boolean };
    expect(statusBefore.enabled).toBe(false);
    expect(statusBefore.hasToken).toBe(false);
    expect(statusBefore.privateRepos).toBe(true);

    const configured = await handle("git:githubConfigure", { enabled: true, owner: "test-org", token: "github_pat_test_token_1234567890" }) as { enabled: boolean; owner?: string; hasToken: boolean };
    expect(configured.enabled).toBe(true);
    expect(configured.owner).toBe("test-org");
    expect(configured.hasToken).toBe(true);

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const text = String(url);
      if (text.endsWith("/user")) return new Response(JSON.stringify({ login: "octocat" }), { status: 200 });
      if (text.endsWith("/repos/test-org/studiolink-my-place-git-test-place")) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      if (text.endsWith("/orgs/test-org/repos") && init?.method === "POST") {
        return new Response(JSON.stringify({
          name: "studiolink-my-place-git-test-place",
          full_name: "test-org/studiolink-my-place-git-test-place",
          clone_url: "https://github.com/test-org/studiolink-my-place-git-test-place.git",
          html_url: "https://github.com/test-org/studiolink-my-place-git-test-place",
          private: true,
        }), { status: 201 });
      }
      return new Response(JSON.stringify({ message: `Unexpected ${text}` }), { status: 500 });
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const remote = await handle("git:autoRemote", { placeName: "My Place" }) as { url: string; repo: string; created: boolean };
    expect(remote.created).toBe(true);
    expect(remote.repo).toBe("test-org/studiolink-my-place-git-test-place");
    expect(remote.url).toBe("https://github.com/test-org/studiolink-my-place-git-test-place.git");
    expect(remote.url).not.toContain("github_pat_test_token");

    const config = JSON.parse(readFileSync(path.join(repoPath(), "config.json"), "utf8")) as { remoteUrl: string; githubRepo: string };
    expect(config.remoteUrl).toBe(remote.url);
    expect(config.githubRepo).toBe(remote.repo);
    expect(readFileSync(path.join(repoPath(), ".credentials"), "utf8")).toContain("github_pat_test_token_1234567890");
  });

  it("signs in with GitHub device flow and stores the OAuth token", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const text = String(url);
      if (text === "https://github.com/login/device/code") {
        return new Response(JSON.stringify({
          device_code: "device-123",
          user_code: "ABCD-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        }), { status: 200 });
      }
      if (text === "https://github.com/login/oauth/access_token") {
        return new Response(JSON.stringify({ access_token: "gho_oauth_token_1234567890", token_type: "bearer", scope: "repo" }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: `Unexpected ${text}` }), { status: 500 });
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const start = await handle("git:githubDeviceStart", {}) as { deviceCode: string; userCode: string; verificationUri: string; clientId: string };
    expect(start.clientId).toBe("Ov23liqqJm4IGNPCj70S");
    expect(start.deviceCode).toBe("device-123");
    expect(start.userCode).toBe("ABCD-1234");
    expect(start.verificationUri).toBe("https://github.com/login/device");

    const poll = await handle("git:githubDevicePoll", { deviceCode: start.deviceCode }) as { authorized: boolean; hasToken: boolean; enabled: boolean };
    expect(poll.authorized).toBe(true);
    expect(poll.hasToken).toBe(true);
    expect(poll.enabled).toBe(true);
    expect(readFileSync(path.join(dataDirectory, "github", "token"), "utf8")).toContain("gho_oauth_token_1234567890");
  });

  it("commits, logs, diffs, and restores a place file", async () => {
    await handle("git:status", {});
    const file = path.join(repoPath(), "ServerScriptService", "Example.lua");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "print('first')\n", "utf8");
    const first = await handle("git:commit", { message: "first commit" }) as { commit: { hash: string } };

    writeFileSync(file, "print('second')\n", "utf8");
    const second = await handle("git:commit", { message: "second commit" }) as { commit: { hash: string } };

    const log = await handle("git:log", {}) as { commits: Array<{ hash: string }> };
    expect(log.commits).toHaveLength(2);
    expect(log.commits[0].hash).toBe(second.commit.hash);
    expect(log.commits[1].hash).toBe(first.commit.hash);

    const diff = await handle("git:diff", {
      path: "ServerScriptService/Example.lua",
      fromCommit: first.commit.hash,
      toCommit: second.commit.hash,
    }) as { diff: string };
    expect(diff.diff).toContain("first");
    expect(diff.diff).toContain("second");

    await handle("git:restore", { path: "ServerScriptService/Example.lua", commit: first.commit.hash });
    expect(readFileSync(file, "utf8")).toBe("print('first')\n");
    expect(existsSync(path.join(repoPath(), ".gitignore"))).toBe(true);
  });
});
