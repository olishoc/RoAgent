// RoAgent Watcher + Git mirror
// Local files are an optional diagnostic/history mirror, not the source of truth.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import readline from "node:readline";

const CONFIG = {
  localDir: process.env.ROAGENT_LOCAL_DIR || `${process.env.HOME}/roagent/local-scripts`,
  serverUrl: process.env.ROAGENT_BRIDGE_URL || "http://127.0.0.1:8765",
  debounceMs: 300,
  pollMs: 1500,
  autoCommitMs: 1500,
  maxMods: 50,
};

const fileHashes = new Map();
const pendingTimers = new Map();
const mods = [];
let lastEventId = 0;
let commitTimer = undefined;
let applyingBridgeEvent = false;

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(msg = "") { console.log(msg); }
function rel(file) { return path.relative(CONFIG.localDir, file).replace(/\\/g, "/"); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function luaFileForRobloxPath(robloxPath) { return path.join(CONFIG.localDir, `${robloxPath}.lua`); }
function robloxPathForFile(file) { return rel(file).replace(/\.lua$/i, "").split("/").join("."); }
function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return h.toString(16);
}

function addMod(event, target, origin = "local") {
  mods.unshift({ timestamp: Date.now(), event, target, origin });
  while (mods.length > CONFIG.maxMods) mods.pop();
}

function git(args, options = {}) {
  try {
    return execFileSync("git", args, { cwd: CONFIG.localDir, encoding: "utf8", stdio: options.stdio || "pipe" }).trim();
  } catch (err) {
    if (options.allowFail) return "";
    throw err;
  }
}

function gitInit() {
  ensureDir(CONFIG.localDir);
  if (!fs.existsSync(path.join(CONFIG.localDir, ".git"))) {
    log("📦 Initializing Git mirror...");
    git(["init"]);
    git(["config", "user.email", "roagent@local"]);
    git(["config", "user.name", "RoAgent"]);
  }
  const ignorePath = path.join(CONFIG.localDir, ".gitignore");
  if (!fs.existsSync(ignorePath)) fs.writeFileSync(ignorePath, "*.lua.bak\n", "utf8");
}

function gitStatus() { return git(["status", "--porcelain"], { allowFail: true }); }
function scheduleCommit(message = "RoAgent mirror update") {
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => {
    if (!gitStatus()) return;
    git(["add", "-A"], { allowFail: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    git(["commit", "-m", `${message} ${stamp}`], { allowFail: true });
    log(`${C.green}📝 committed mirror changes${C.reset}`);
  }, CONFIG.autoCommitMs);
}

async function request(method, route, body) {
  const res = await fetch(`${CONFIG.serverUrl}${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getJson(route) { return request("GET", route); }
async function postJson(route, body) { return request("POST", route, body); }

function writeMirrorFile(robloxPath, source) {
  const file = luaFileForRobloxPath(robloxPath);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, source, "utf8");
  fileHashes.set(file, hash(source));
  return file;
}

function deleteMirrorFile(robloxPath) {
  const file = luaFileForRobloxPath(robloxPath);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  fileHashes.delete(file);
  return file;
}

async function pullSnapshot() {
  const status = await getJson("/status");
  const data = await getJson("/scripts");
  ensureDir(CONFIG.localDir);
  const seenFiles = new Set();

  if (!status.studioConnected && (!data.scripts || data.scripts.length === 0) && getLuaFiles(CONFIG.localDir).length > 0) {
    lastEventId = status.lastEventId || 0;
    log(`${C.yellow}⚠ Bridge has no live Studio snapshot; keeping existing local mirror files.${C.reset}`);
    return;
  }

  for (const script of data.scripts || []) {
    const full = await getJson(`/script/${encodeURIComponent(script.path)}`);
    const file = writeMirrorFile(full.path, full.source || "");
    seenFiles.add(file);
  }

  for (const file of getLuaFiles(CONFIG.localDir)) {
    if (!seenFiles.has(file)) {
      fs.unlinkSync(file);
      fileHashes.delete(file);
    }
  }

  git(["add", "-A"], { allowFail: true });
  if (gitStatus()) git(["commit", "-m", `Snapshot ${new Date().toISOString()}`], { allowFail: true });
  lastEventId = status.lastEventId || 0;
  log(`✅ Pulled ${data.scriptCount || 0} scripts from bridge into ${CONFIG.localDir}`);
}

function getLuaFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) getLuaFiles(full, out);
    else if (entry.name.endsWith(".lua")) out.push(full);
  }
  return out;
}

async function pushFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const robloxPath = robloxPathForFile(file);
  const className = robloxPath.includes("StarterPlayerScripts") || /client/i.test(robloxPath) ? "LocalScript" : /module/i.test(robloxPath) ? "ModuleScript" : "Script";
  await postJson("/push", { path: robloxPath, source, className });
  fileHashes.set(file, hash(source));
  addMod("pushed", robloxPath, "local");
  scheduleCommit("Local edit");
  log(`  ${C.green}✅ pushed ${robloxPath}${C.reset}`);
}

async function deleteFile(file) {
  const robloxPath = robloxPathForFile(file);
  await postJson("/delete", { path: robloxPath });
  fileHashes.delete(file);
  addMod("deleted", robloxPath, "local");
  git(["rm", "--ignore-unmatch", rel(file)], { allowFail: true });
  scheduleCommit("Local delete");
  log(`  ${C.yellow}🗑 deleted ${robloxPath}${C.reset}`);
}

function baselineHashes() {
  fileHashes.clear();
  for (const file of getLuaFiles(CONFIG.localDir)) {
    fileHashes.set(file, hash(fs.readFileSync(file, "utf8")));
  }
}

function handlePotentialChange(file) {
  if (applyingBridgeEvent || !file.endsWith(".lua")) return;
  if (pendingTimers.has(file)) clearTimeout(pendingTimers.get(file));
  pendingTimers.set(file, setTimeout(async () => {
    pendingTimers.delete(file);
    try {
      if (!fs.existsSync(file)) return deleteFile(file);
      const content = fs.readFileSync(file, "utf8");
      const current = hash(content);
      if (fileHashes.get(file) !== current) await pushFile(file);
    } catch (err) {
      log(`${C.red}❌ ${err.message}${C.reset}`);
    }
  }, CONFIG.debounceMs));
}

function watchFiles() {
  fs.watch(CONFIG.localDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    handlePotentialChange(path.join(CONFIG.localDir, filename.toString()));
  });
  setInterval(() => {
    if (applyingBridgeEvent) return;
    const currentFiles = new Set(getLuaFiles(CONFIG.localDir));
    for (const file of currentFiles) handlePotentialChange(file);
    for (const file of [...fileHashes.keys()]) {
      if (!currentFiles.has(file)) handlePotentialChange(file);
    }
  }, 3000);
}

async function pollEvents() {
  try {
    const data = await getJson(`/events?since=${lastEventId}&limit=100`);
    if (!data.events?.length) return;
    applyingBridgeEvent = true;
    for (const event of data.events) {
      lastEventId = Math.max(lastEventId, event.id);
      if (event.origin === "local") continue;
      if (event.event === "deleted") deleteMirrorFile(event.path);
      else writeMirrorFile(event.path, event.source || "");
      addMod(event.event, event.path, event.origin || "bridge");
      log(`${icon(event.event)} ${event.event} ${event.path} (${event.origin || "bridge"})`);
    }
    applyingBridgeEvent = false;
    scheduleCommit("Bridge event");
  } catch (err) {
    applyingBridgeEvent = false;
  }
}

function icon(event) {
  if (event === "created") return "✨";
  if (event === "updated") return "📝";
  if (event === "deleted") return "🗑";
  return "⬆️";
}

function printMods() {
  if (!mods.length) return log("No modifications yet.");
  for (const m of mods.slice(0, 20)) {
    log(`${icon(m.event)} ${m.event.padEnd(8)} ${m.target} ${C.dim}${m.origin} ${new Date(m.timestamp).toLocaleTimeString()}${C.reset}`);
  }
}

async function pushAll() {
  log("📤 Pushing local mirror files...");
  for (const file of getLuaFiles(CONFIG.localDir)) await pushFile(file);
}

async function main() {
  log(`\n╔══════════════════════════════════════╗\n║ RoAgent Watcher + Git Mirror         ║\n╚══════════════════════════════════════╝\n`);
  try { await getJson("/health"); } catch { log("❌ Bridge not running. Run `roblox` first."); process.exit(1); }
  gitInit();
  await pullSnapshot();
  baselineHashes();
  watchFiles();
  setInterval(pollEvents, CONFIG.pollMs);

  log("\nCommands: mods/m, log [n], show <commit> <file>, revert <commit> <file>, status, push, quit\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "roagent> " });
  rl.prompt();
  rl.on("line", async (line) => {
    const [cmdRaw, ...args] = line.trim().split(/\s+/);
    const cmd = (cmdRaw || "").toLowerCase();
    try {
      if (cmd === "mods" || cmd === "m") printMods();
      else if (cmd === "log") log(git(["log", "--oneline", `-${Number(args[0] || 10)}`], { allowFail: true }) || "No commits");
      else if (cmd === "show" && args.length >= 2) log(git(["show", `${args[0]}:${args.slice(1).join(" ")}`], { allowFail: true }) || "Not found");
      else if (cmd === "revert" && args.length >= 2) {
        const file = args.slice(1).join(" ");
        const content = git(["show", `${args[0]}:${file}`], { allowFail: true });
        if (!content) log("Not found");
        else { fs.writeFileSync(path.join(CONFIG.localDir, file), content, "utf8"); await pushFile(path.join(CONFIG.localDir, file)); }
      }
      else if (cmd === "status") log(gitStatus() || "clean");
      else if (cmd === "push") await pushAll();
      else if (cmd === "quit" || cmd === "exit") process.exit(0);
      else if (cmd === "help" || cmd === "?") log("mods/m, log [n], show <commit> <file>, revert <commit> <file>, status, push, quit");
      else if (cmd) log(`Unknown: ${cmd}`);
    } catch (err) {
      log(`${C.red}❌ ${err.message}${C.reset}`);
    }
    rl.prompt();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
