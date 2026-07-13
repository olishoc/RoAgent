import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_REPOSITORY = "https://github.com/olishoc/roagent-runtime.git";
const SOURCE_COMMIT = "aba4712a2f0e64dd2540db2041dcf3da95a753bd";
const SOURCE_REMOTE = "studiolink";
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDir = path.join(repoRoot, "roagent");
const gitDir = path.join(sourceDir, ".git");

function run(command, args, cwd = repoRoot, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || (capture ? String(result.stderr || result.stdout || "").trim() : "");
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return capture ? String(result.stdout).trim() : "";
}

if (!existsSync(gitDir)) {
  if (existsSync(sourceDir) && readdirSync(sourceDir).length > 0) {
    throw new Error(`${sourceDir} exists but is not a Git checkout. Move or remove it before retrying.`);
  }
  mkdirSync(sourceDir, { recursive: true });
  run("git", ["init"], sourceDir);
}

const sourceRemoteUrl = spawnSync("git", ["remote", "get-url", SOURCE_REMOTE], {
  cwd: sourceDir,
  encoding: "utf8",
  stdio: "pipe",
  shell: false,
});
if (sourceRemoteUrl.status === 0) {
  if (String(sourceRemoteUrl.stdout).trim() !== SOURCE_REPOSITORY) {
    run("git", ["remote", "set-url", SOURCE_REMOTE, SOURCE_REPOSITORY], sourceDir);
  }
} else {
  run("git", ["remote", "add", SOURCE_REMOTE, SOURCE_REPOSITORY], sourceDir);
}

let currentCommit = "";
const head = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: sourceDir,
  encoding: "utf8",
  stdio: "pipe",
  shell: false,
});
if (head.status === 0) currentCommit = String(head.stdout).trim();

const changes = run("git", ["status", "--porcelain"], sourceDir, true);
if (changes) {
  throw new Error(`Refusing to build modified RoAgent source at ${sourceDir}. Commit or move those changes first.`);
}

if (currentCommit !== SOURCE_COMMIT) {
  run("git", ["fetch", "--depth", "1", SOURCE_REMOTE, SOURCE_COMMIT], sourceDir);
  run("git", ["checkout", "--detach", SOURCE_COMMIT], sourceDir);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(npm, ["ci"], sourceDir);
run(process.execPath, [path.join(repoRoot, "tools", "build-roagent.mjs")], sourceDir);

const executable = path.join(sourceDir, "dist", process.platform === "win32" ? "roagent.exe" : "roagent");
if (!existsSync(executable)) throw new Error(`RoAgent build did not produce ${executable}`);
console.log(`RoAgent executable ready: ${executable}`);
