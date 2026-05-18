import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { simpleGit, type SimpleGit, type StatusResult } from "simple-git";
import { AppError } from "../errors.ts";
import type { Handler, HandlerContext } from "../types.ts";
import { ErrorCode, type ClientToServerMessage, type GitCommit, type GitFileStatus, type GitFileStatusKind, type ScriptClassName, type ScriptRecord } from "../../../shared/protocol.ts";

const repoRegistry = new Map<string, { repoPath: string; git: SimpleGit }>();
const GITHUB_CLIENT_ID = "Ov23liqqJm4IGNPCj70S";
const GITHUB_DEVICE_SCOPE = "repo";
const ALLOWED_REMOTE_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "dev.azure.com",
  "ssh.dev.azure.com",
]);

interface PlaceGitConfig {
  remote?: string;
  remoteUrl?: string;
  githubRepo?: string;
  updatedAt: string;
}

interface GithubConfig {
  enabled: boolean;
  owner?: string;
  privateRepos: boolean;
  updatedAt: string;
}

interface GithubUser {
  login: string;
  avatar_url?: string;
  html_url?: string;
}

interface GithubRepo {
  name: string;
  full_name: string;
  clone_url: string;
  html_url: string;
  private: boolean;
}

interface GithubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface GithubAccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function payload(message: ClientToServerMessage): Record<string, unknown> {
  return message.payload as Record<string, unknown>;
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new AppError(ErrorCode.INVALID_PAYLOAD, `Invalid ${key}`);
  return value;
}

function requiredString(obj: Record<string, unknown>, key: string): string {
  const value = optionalString(obj, key);
  if (!value) throw new AppError(ErrorCode.INVALID_PAYLOAD, `Missing ${key}`);
  return value;
}

function placeRepoDir(context: HandlerContext, placeId: string): string {
  return context.placeStore.getPlaceDirectory(placeId);
}

async function ensureRepo(context: HandlerContext, placeId: string): Promise<{ git: SimpleGit; repoPath: string }> {
  const cached = repoRegistry.get(placeId);
  const repoPath = placeRepoDir(context, placeId);
  mkdirSync(repoPath, { recursive: true });
  if (cached && cached.repoPath === repoPath && existsSync(path.join(repoPath, ".git"))) return cached;

  const git = simpleGit({ baseDir: repoPath, binary: "git", maxConcurrentProcesses: 1 });
  if (!(await git.checkIsRepo())) {
    await git.init();
    const gitignore = path.join(repoPath, ".gitignore");
    if (!existsSync(gitignore)) writeFileSync(gitignore, "# RoAgent tracks all source files in this place repo.\n", "utf8");
  }
  await ensureLocalUser(git);
  repoRegistry.set(placeId, { repoPath, git });
  return { git, repoPath };
}

async function ensureLocalUser(git: SimpleGit): Promise<void> {
  const [name, email] = await Promise.all([
    git.getConfig("user.name", "local").catch(() => undefined),
    git.getConfig("user.email", "local").catch(() => undefined),
  ]);
  if (!name?.value) await git.addConfig("user.name", "RoAgent", false, "local");
  if (!email?.value) await git.addConfig("user.email", "roagent@example.local", false, "local");
}

function sanitizeRepoPath(repoPath: string, filePath: string): string {
  if (!filePath || path.isAbsolute(filePath) || filePath.includes("\0")) {
    throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid git file path");
  }
  const resolved = path.resolve(repoPath, filePath);
  const root = path.resolve(repoPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError(ErrorCode.PERMISSION_DENIED, "Git file path escapes place repo");
  }
  return resolved;
}

function countChangedFiles(status: StatusResult): number {
  return new Set([...status.files.map((file) => file.path), ...status.not_added, ...status.deleted, ...status.staged, ...status.modified]).size;
}

function mapStatus(status: StatusResult): GitFileStatus[] {
  const files = new Map<string, GitFileStatusKind>();
  for (const file of status.files) {
    if (file.index !== " " && file.index !== "?") files.set(file.path, "staged");
    if (file.working_dir === "D") files.set(file.path, "deleted");
    else if (file.working_dir !== " " && file.working_dir !== "?") files.set(file.path, "modified");
    if (file.index === "D") files.set(file.path, "deleted");
    if (file.index === "A") files.set(file.path, "staged");
    if (file.index === "U" || file.working_dir === "U") files.set(file.path, "conflicted");
  }
  for (const file of status.not_added) files.set(file, "untracked");
  for (const file of status.deleted) files.set(file, "deleted");
  for (const file of status.staged) files.set(file, "staged");
  for (const file of status.modified) if (!files.has(file)) files.set(file, "modified");
  return [...files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([filePath, fileStatus]) => ({ path: filePath, status: fileStatus }));
}

function mapCommit(commit: { hash: string; message: string; author_name?: string; author_email?: string; date: string }): GitCommit {
  return {
    hash: commit.hash,
    message: commit.message,
    authorName: commit.author_name,
    authorEmail: commit.author_email,
    timestamp: commit.date,
  };
}

async function currentBranch(git: SimpleGit): Promise<string> {
  const branch = await git.branchLocal();
  return branch.current || "main";
}

async function originUrl(git: SimpleGit, remote = "origin"): Promise<string | undefined> {
  try {
    const remotes = await git.getRemotes(true);
    const rawUrl = remotes.find((candidate) => candidate.name === remote)?.refs.fetch;
    return rawUrl ? sanitizeRemoteForDisplay(rawUrl) : undefined;
  } catch {
    return undefined;
  }
}

function readPlaceConfig(repoPath: string): PlaceGitConfig | undefined {
  const file = path.join(repoPath, "config.json");
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as PlaceGitConfig;
}

function writePlaceConfig(repoPath: string, config: PlaceGitConfig): void {
  writeFileSync(path.join(repoPath, "config.json"), JSON.stringify(config, null, 2), "utf8");
}

function githubDir(context: HandlerContext): string {
  return path.join(context.config.dataDirectory, "github");
}

function githubConfigPath(context: HandlerContext): string {
  return path.join(githubDir(context), "config.json");
}

function githubTokenPath(context: HandlerContext): string {
  return path.join(githubDir(context), "token");
}

function readGithubConfig(context: HandlerContext): GithubConfig {
  const file = githubConfigPath(context);
  if (!existsSync(file)) return { enabled: false, privateRepos: true, updatedAt: new Date(0).toISOString() };
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<GithubConfig>;
  return {
    enabled: parsed.enabled === true,
    owner: typeof parsed.owner === "string" && parsed.owner.trim() ? parsed.owner.trim() : undefined,
    privateRepos: parsed.privateRepos !== false,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
  };
}

function writeGithubConfig(context: HandlerContext, config: GithubConfig): void {
  const dir = githubDir(context);
  mkdirSync(dir, { recursive: true });
  writeFileSync(githubConfigPath(context), JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") chmodSync(githubConfigPath(context), 0o600);
}

function writeGithubToken(context: HandlerContext, token: string): void {
  const dir = githubDir(context);
  mkdirSync(dir, { recursive: true });
  writeFileSync(githubTokenPath(context), token.trim() + "\n", { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") chmodSync(githubTokenPath(context), 0o600);
}

function readGithubToken(context: HandlerContext): string | undefined {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const file = githubTokenPath(context);
  if (!existsSync(file)) return undefined;
  const token = readFileSync(file, "utf8").trim();
  return token || undefined;
}

function parseRemoteUrl(rawUrl: string): { sanitizedUrl: string; token?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(ErrorCode.INVALID_PAYLOAD, "Remote URL must be a valid https URL");
  }
  if (url.protocol !== "https:") throw new AppError(ErrorCode.INVALID_PAYLOAD, "Remote URL must use https://");
  if (!isAllowedRemoteHost(url.hostname)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Remote URL host is not supported");
  const token = credentialFromUrl(url);
  url.username = "";
  url.password = "";
  return { sanitizedUrl: url.toString(), token };
}

function sanitizeRemoteForDisplay(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return rawUrl.replace(/https:\/\/[^/@]+@/i, "https://");
  }
}

function credentialFromUrl(url: URL): string | undefined {
  const username = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  if (username && password) return `${username}:${password}`;
  return username ?? password;
}

function isAllowedRemoteHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return ALLOWED_REMOTE_HOSTS.has(lower) || lower.endsWith(".visualstudio.com");
}

function writeCredentials(repoPath: string, token: string): void {
  const file = path.join(repoPath, ".credentials");
  writeFileSync(file, JSON.stringify({ token }, null, 2), { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") {
    chmodSync(file, 0o600);
    return;
  }
  const user = process.env.USERNAME || process.env.USER || "";
  if (user) {
    try {
      execFileSync("icacls", [file, "/inheritance:r", "/grant:r", `${user}:R`], { stdio: "ignore" });
    } catch {
      chmodSync(file, 0o600);
    }
  }
}

function readCredentials(repoPath: string): string | undefined {
  const file = path.join(repoPath, ".credentials");
  if (!existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { token?: unknown };
    return typeof parsed.token === "string" && parsed.token ? parsed.token : undefined;
  } catch {
    return undefined;
  }
}

function authenticatedRemoteUrl(remoteUrl: string, credential: string | undefined): string | undefined {
  if (!credential) return undefined;
  try {
    const url = new URL(remoteUrl);
    if (url.protocol !== "https:") return undefined;
    if (credential.includes(":")) {
      const [username, ...passwordParts] = credential.split(":");
      url.username = username;
      url.password = passwordParts.join(":");
    } else {
      url.username = credential;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function slugifyRepoPart(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "place";
}

function githubRepoName(placeId: string, placeName?: string): string {
  return `studiolink-${slugifyRepoPart(placeName || "place")}-${slugifyRepoPart(placeId)}`.slice(0, 100);
}

async function githubDeviceCode(): Promise<GithubDeviceCodeResponse> {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: GITHUB_DEVICE_SCOPE }),
  });
  const body = await response.json() as GithubDeviceCodeResponse & { error?: string; error_description?: string };
  if (!response.ok || body.error) throw new AppError(ErrorCode.GIT_CONFLICT, `GitHub sign-in failed: ${body.error_description ?? body.error ?? response.statusText}`);
  return body;
}

async function githubAccessToken(deviceCode: string): Promise<GithubAccessTokenResponse> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
  });
  const body = await response.json() as GithubAccessTokenResponse;
  if (!response.ok) throw new AppError(ErrorCode.GIT_CONFLICT, `GitHub sign-in failed: ${body.error_description ?? response.statusText}`);
  return body;
}

async function githubApi<T>(token: string, endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : undefined;
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body ? String((body as { message?: unknown }).message) : response.statusText;
    throw new AppError(ErrorCode.GIT_CONFLICT, `GitHub request failed: ${message}`);
  }
  return body as T;
}

async function getGithubRepo(token: string, owner: string, repo: string): Promise<GithubRepo | undefined> {
  try {
    return await githubApi<GithubRepo>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  } catch (error) {
    if (error instanceof AppError && error.message.includes("Not Found")) return undefined;
    return undefined;
  }
}

async function createGithubRepo(token: string, owner: string, login: string, repoName: string, privateRepo: boolean): Promise<GithubRepo> {
  const existing = await getGithubRepo(token, owner, repoName);
  if (existing) return existing;
  const endpoint = owner.toLowerCase() === login.toLowerCase() ? "/user/repos" : `/orgs/${encodeURIComponent(owner)}/repos`;
  try {
    return await githubApi<GithubRepo>(token, endpoint, {
      method: "POST",
      body: JSON.stringify({ name: repoName, private: privateRepo, auto_init: false, description: "StudioLink automatic Roblox place history repository" }),
    });
  } catch (error) {
    const afterConflict = await getGithubRepo(token, owner, repoName);
    if (afterConflict) return afterConflict;
    throw error;
  }
}

function conflictFiles(status: StatusResult): string[] {
  return status.conflicted.length > 0
    ? status.conflicted
    : status.files.filter((file) => file.index === "U" || file.working_dir === "U").map((file) => file.path);
}

function classNameForFile(filePath: string): ScriptClassName {
  return filePath.endsWith(".luau") ? "ModuleScript" : "Script";
}

function recordForRestoredFile(filePath: string, source: string): ScriptRecord {
  return {
    path: filePath,
    className: classNameForFile(filePath),
    source,
    size: Buffer.byteLength(source),
    versionId: `git-restore-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
}

function toAppGitError(error: unknown, message: string): AppError {
  if (error instanceof AppError) return error;
  return new AppError(ErrorCode.GIT_CONFLICT, message, { cause: error instanceof Error ? error.message : String(error) });
}

export const gitHandlers: Record<string, Handler> = {
  async "git:status"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const status = await git.status();
    const placeConfig = readPlaceConfig(repoPath);
    const remoteUrl = placeConfig?.remoteUrl ?? await originUrl(git);
    return {
      repoPath,
      branch: status.current || await currentBranch(git),
      remoteUrl,
      githubRepo: placeConfig?.githubRepo,
      ahead: status.ahead,
      behind: status.behind,
      clean: status.isClean(),
      files: mapStatus(status),
    };
  },

  async "git:commit"(message, context) {
    const { git } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const status = await git.status();
    const changedCount = countChangedFiles(status);
    if (changedCount === 0) throw new AppError(ErrorCode.INVALID_PAYLOAD, "No git changes to commit");
    const messageText = optionalString(p, "message") ?? `auto: ${changedCount} files changed at ${new Date().toISOString()}`;
    await git.add(["-A"]);
    const authorName = optionalString(p, "authorName");
    const authorEmail = optionalString(p, "authorEmail");
    const options = authorName && authorEmail ? { "--author": `${authorName} <${authorEmail}>` } : undefined;
    await git.commit(messageText, undefined, options);
    const log = await git.log({ maxCount: 1 });
    const latest = log.latest;
    if (!latest) throw new AppError(ErrorCode.INTERNAL_ERROR, "Commit succeeded but log is empty");
    context.agentService.recordAction(message.placeId, { timestamp: new Date().toISOString(), tool: "git_commit", summary: `Committed snapshot: ${messageText}` });
    return { commit: mapCommit(latest) };
  },

  async "git:log"(message, context) {
    const { git } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const maxCount = Math.min(Math.max(Number(p.limit ?? 50), 1), 50);
    const log = await git.log({ maxCount }).catch(() => ({ all: [] }));
    const commits = log.all.map(mapCommit);
    return { commits, hasMore: commits.length === maxCount };
  },

  async "git:diff"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const filePath = optionalString(p, "path") ?? ".";
    const fromCommit = requiredString(p, "fromCommit");
    const toCommit = optionalString(p, "toCommit");
    const repoWide = filePath === "." || filePath === "";
    if (!repoWide) sanitizeRepoPath(repoPath, filePath);
    const args = repoWide
      ? (toCommit ? [fromCommit, toCommit] : [fromCommit])
      : (toCommit ? [fromCommit, toCommit, "--", filePath] : [fromCommit, "--", filePath]);
    const diff = await git.diff(args);
    return { path: repoWide ? "." : filePath, fromCommit, toCommit: toCommit ?? "WORKTREE", diff };
  },

  async "git:restore"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const filePath = requiredString(p, "path");
    const commit = requiredString(p, "commit");
    const target = sanitizeRepoPath(repoPath, filePath);
    const source = await git.show([`${commit}:${filePath}`]).catch((error) => {
      throw toAppGitError(error, "Unable to restore file from commit");
    });
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source, "utf8");
    const script = recordForRestoredFile(filePath, source);
    context.agentService.recordAction(message.placeId, { timestamp: new Date().toISOString(), tool: "git_restore", summary: `Restored ${filePath} from ${commit.slice(0, 7)}` });
    return {
      script,
      restoredFromCommit: commit,
      historyVersion: {
        versionId: script.versionId,
        path: filePath,
        className: script.className,
        source,
        action: "restored",
        timestamp: script.updatedAt,
        summary: optionalString(p, "summary") ?? `Restored from ${commit}`,
        actor: "git",
        commitHash: commit,
      },
    };
  },

  async "git:push"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const remote = optionalString(p, "remote") ?? "origin";
    const remoteUrl = await originUrl(git, remote);
    if (!remoteUrl) throw new AppError(ErrorCode.INVALID_PAYLOAD, `No remote configured for ${remote}`);
    const branch = optionalString(p, "branch") ?? await currentBranch(git);
    const remoteTarget = authenticatedRemoteUrl(remoteUrl, readCredentials(repoPath)) ?? remote;
    await git.push(remoteTarget, branch).catch((error) => {
      throw toAppGitError(error, "Git push failed");
    });
    const pushedAt = new Date().toISOString();
    context.agentService.recordAction(message.placeId, { timestamp: pushedAt, tool: "git_push", summary: `Pushed ${branch} to ${remote}` });
    return { ok: true, remote, branch, pushedAt };
  },

  async "git:pull"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const remote = optionalString(p, "remote") ?? "origin";
    const remoteUrl = await originUrl(git, remote);
    if (!remoteUrl) throw new AppError(ErrorCode.INVALID_PAYLOAD, `No remote configured for ${remote}`);
    const branch = optionalString(p, "branch") ?? await currentBranch(git);
    const remoteTarget = authenticatedRemoteUrl(remoteUrl, readCredentials(repoPath)) ?? remote;
    try {
      await git.pull(remoteTarget, branch, ["--rebase"]);
      const pulledAt = new Date().toISOString();
      context.agentService.recordAction(message.placeId, { timestamp: pulledAt, tool: "git_pull", summary: `Pulled ${branch} from ${remote}` });
      return { ok: true, remote, branch, pulledAt, fastForward: true };
    } catch (error) {
      const conflicts = conflictFiles(await git.status().catch(() => ({ conflicted: [], files: [] }) as unknown as StatusResult));
      throw new AppError(ErrorCode.GIT_CONFLICT, "Git pull conflict", { details: { conflictingFiles: conflicts }, cause: error instanceof Error ? error.message : String(error) });
    }
  },

  async "git:githubStatus"(_message, context) {
    const config = readGithubConfig(context);
    const token = readGithubToken(context);
    const response: Record<string, unknown> = {
      enabled: config.enabled,
      owner: config.owner,
      privateRepos: config.privateRepos,
      hasToken: Boolean(token),
      updatedAt: config.updatedAt,
    };
    if (token) {
      try {
        const user = await githubApi<GithubUser>(token, "/user");
        response.githubLogin = user.login;
        response.githubAvatarUrl = user.avatar_url;
        response.githubHtmlUrl = user.html_url;
      } catch {
        // Keep status usable even if GitHub is offline or the token needs refreshing.
      }
    }
    return response;
  },

  async "git:githubDeviceStart"() {
    const device = await githubDeviceCode();
    return {
      clientId: GITHUB_CLIENT_ID,
      deviceCode: device.device_code,
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval,
    };
  },

  async "git:githubDevicePoll"(message, context) {
    const p = payload(message);
    const deviceCode = requiredString(p, "deviceCode");
    const tokenResponse = await githubAccessToken(deviceCode);
    if (tokenResponse.error) {
      return {
        authorized: false,
        pending: tokenResponse.error === "authorization_pending" || tokenResponse.error === "slow_down",
        error: tokenResponse.error,
        message: tokenResponse.error_description,
      };
    }
    if (!tokenResponse.access_token) throw new AppError(ErrorCode.GIT_CONFLICT, "GitHub did not return an access token");
    writeGithubToken(context, tokenResponse.access_token);
    const existing = readGithubConfig(context);
    const config: GithubConfig = { ...existing, enabled: true, updatedAt: new Date().toISOString() };
    writeGithubConfig(context, config);
    const response: Record<string, unknown> = { authorized: true, pending: false, ...config, hasToken: true };
    try {
      const user = await githubApi<GithubUser>(tokenResponse.access_token, "/user");
      response.githubLogin = user.login;
      response.githubAvatarUrl = user.avatar_url;
      response.githubHtmlUrl = user.html_url;
    } catch {
      // Token is stored; user details can be refreshed later.
    }
    return response;
  },

  async "git:githubConfigure"(message, context) {
    const p = payload(message);
    const existing = readGithubConfig(context);
    const enabled = p.enabled === undefined ? existing.enabled : p.enabled === true;
    const privateRepos = p.privateRepos === undefined ? existing.privateRepos : p.privateRepos !== false;
    const owner = optionalString(p, "owner");
    const token = optionalString(p, "token");
    if (token && token.length < 20) throw new AppError(ErrorCode.INVALID_PAYLOAD, "GitHub token is too short");
    if (token) writeGithubToken(context, token);
    const config: GithubConfig = { enabled, owner, privateRepos, updatedAt: new Date().toISOString() };
    writeGithubConfig(context, config);
    return { ...config, hasToken: Boolean(readGithubToken(context)) };
  },

  async "git:autoRemote"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const remote = optionalString(p, "remote") ?? "origin";
    const force = p.force === true;
    const existingRemote = await originUrl(git, remote);
    if (existingRemote && !force) return { ok: true, created: false, reused: true, remote, url: existingRemote };

    const config = readGithubConfig(context);
    if (!config.enabled) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Automatic GitHub repositories are disabled in settings");
    const token = readGithubToken(context);
    if (!token) throw new AppError(ErrorCode.INVALID_PAYLOAD, "GitHub token is not configured");

    const user = await githubApi<GithubUser>(token, "/user");
    const owner = config.owner || user.login;
    const repoName = optionalString(p, "repoName") ?? githubRepoName(message.placeId, optionalString(p, "placeName"));
    const repo = await createGithubRepo(token, owner, user.login, repoName, config.privateRepos);
    const sanitizedUrl = sanitizeRemoteForDisplay(repo.clone_url);
    writeCredentials(repoPath, `x-access-token:${token}`);
    const remotes = await git.getRemotes();
    if (remotes.some((candidate) => candidate.name === remote)) await git.removeRemote(remote);
    await git.addRemote(remote, sanitizedUrl);
    writePlaceConfig(repoPath, { ...(readPlaceConfig(repoPath) ?? { updatedAt: new Date().toISOString() }), remote, remoteUrl: sanitizedUrl, githubRepo: repo.full_name, updatedAt: new Date().toISOString() });
    context.agentService.recordAction(message.placeId, { timestamp: new Date().toISOString(), tool: "git_auto_remote", summary: `Configured GitHub remote ${repo.full_name}` });
    return { ok: true, created: true, reused: false, remote, url: sanitizedUrl, repo: repo.full_name, htmlUrl: repo.html_url };
  },

  async "git:setRemote"(message, context) {
    const { git, repoPath } = await ensureRepo(context, message.placeId);
    const p = payload(message);
    const remote = optionalString(p, "remote") ?? "origin";
    const rawUrl = optionalString(p, "remoteUrl") ?? optionalString(p, "url");
    if (!rawUrl) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Missing remoteUrl");
    const { sanitizedUrl, token } = parseRemoteUrl(rawUrl);
    if (token) writeCredentials(repoPath, token);
    const remotes = await git.getRemotes();
    if (remotes.some((candidate) => candidate.name === remote)) await git.removeRemote(remote);
    await git.addRemote(remote, sanitizedUrl);
    writePlaceConfig(repoPath, { remote, remoteUrl: sanitizedUrl, updatedAt: new Date().toISOString() });
    return { ok: true, remote, url: sanitizedUrl };
  },
};
