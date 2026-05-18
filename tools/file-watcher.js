// RoAgent Local File Watcher
// Watches local .lua files and auto-pushes changes to Studio via /pending

import fs from "fs";
import path from "path";
import { watch } from "fs";
import readline from "readline";

const CONFIG = {
  watchDir: process.env.HOME + "/roagent/local-scripts",
  serverUrl: "http://127.0.0.1:8765",
  debounceMs: 300,
  pushInterval: 1000,
};

const pending = [];
const watchedFiles = new Map(); // path → { mtime, hash }
const recentChanges = new Map(); // path → timestamp

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function httpPost(path, body) {
  try {
    const res = await fetch(CONFIG.serverUrl + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  } catch (e) {
    return null;
  }
}

async function httpGet(path) {
  try {
    const res = await fetch(CONFIG.serverUrl + path);
    return res.json();
  } catch (e) {
    return null;
  }
}

// ── Path mapping ─────────────────────────────────────────────────────────────
// Local file: local-scripts/ServerScriptService/MyScript.lua
// → Roblox path: ServerScriptService.MyScript
function localToRobloxPath(localPath) {
  const rel = path.relative(CONFIG.watchDir, localPath);
  const withoutExt = rel.replace(/\.lua$/, "").replace(/\\/g, ".");
  return withoutExt;
}

function getClassFromFilename(filename) {
  // If filename contains "LocalScript", "Module", "Script" in name
  if (filename.includes("Client") || filename.includes("LocalScript")) return "LocalScript";
  if (filename.includes("Module")) return "ModuleScript";
  return "Script";
}

// ── File hashing (simple) ─────────────────────────────────────────────────────
function getFileHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// ── Scan and register existing files ─────────────────────────────────────────
function scanExistingFiles() {
  if (!fs.existsSync(CONFIG.watchDir)) {
    console.log(`[Watcher] Creating ${CONFIG.watchDir}`);
    fs.mkdirSync(CONFIG.watchDir, { recursive: true });
    createSampleFiles();
    return;
  }

  const files = getLuaFiles(CONFIG.watchDir);
  for (const file of files) {
    registerFile(file);
  }
  console.log(`[Watcher] Registered ${files.length} files`);
}

function createSampleFiles() {
  const sampleScript = `-- ServerScriptService.ExampleScript.lua
-- Example script in local-scripts folder

-- This file will sync to:
--   ServerScriptService.ExampleScript

local HttpService = game:GetService("HttpService")

print("Hello from synced script!")

-- Auto-reload when this file changes in VS Code
_G.reloadScript = function()
    print("Script reloaded!")
end
`;
  
  const sampleLocal = `-- StarterPlayerScripts.MyClientScript.lua
-- Example LocalScript in local-scripts folder

-- This file will sync to:
--   StarterPlayerScripts.MyClientScript

local Players = game:GetService("Players")
local Player = Players.LocalPlayer

print("Client script loaded!")

-- Your code here...
`;

  fs.writeFileSync(path.join(CONFIG.watchDir, "ServerScriptService.ExampleScript.lua"), sampleScript);
  fs.writeFileSync(path.join(CONFIG.watchDir, "StarterPlayerScripts.MyClientScript.lua"), sampleLocal);
  
  console.log(`[Watcher] Created sample files in ${CONFIG.watchDir}`);
}

function getLuaFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getLuaFiles(fullPath, files);
    } else if (entry.name.endsWith(".lua")) {
      files.push(fullPath);
    }
  }
  return files;
}

function registerFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const hash = getFileHash(content);
    
    watchedFiles.set(filePath, {
      mtime: stats.mtimeMs,
      hash,
    });
  } catch (e) {
    // File might not exist yet
  }
}

// ── Watch file changes ────────────────────────────────────────────────────────
function startWatching() {
  console.log(`[Watcher] Watching ${CONFIG.watchDir} for changes...`);
  
  const watcher = watch(CONFIG.watchDir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith(".lua")) return;
    
    const fullPath = path.join(CONFIG.watchDir, filename);
    const now = Date.now();
    
    // Debounce rapid changes
    const lastChange = recentChanges.get(fullPath) || 0;
    if (now - lastChange < CONFIG.debounceMs) return;
    recentChanges.set(fullPath, now);
    
    // Schedule actual check
    setTimeout(() => checkFileChange(fullPath), CONFIG.debounceMs);
  });

  // Also poll periodically as fallback
  setInterval(pollForChanges, CONFIG.pushInterval);
}

function checkFileChange(filePath) {
  if (!fs.existsSync(filePath)) {
    // File deleted
    if (watchedFiles.has(filePath)) {
      watchedFiles.delete(filePath);
      const robloxPath = localToRobloxPath(filePath);
      console.log(`[Watcher] 📁 Deleted: ${robloxPath}`);
      // Could queue delete here
    }
    return;
  }

  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const hash = getFileHash(content);
    
    const existing = watchedFiles.get(filePath);
    
    if (!existing || existing.hash !== hash) {
      watchedFiles.set(filePath, { mtime: stats.mtimeMs, hash });
      
      const robloxPath = localToRobloxPath(filePath);
      const filename = path.basename(filePath, ".lua");
      const className = getClassFromFilename(filename);
      
      console.log(`[Watcher] 📝 Changed: ${robloxPath}`);
      
      pending.push({
        path: robloxPath,
        source: content,
        className,
        event: existing ? "updated" : "created",
      });
    }
  } catch (e) {
    console.error(`[Watcher] Error checking ${filePath}: ${e.message}`);
  }
}

function pollForChanges() {
  for (const filePath of watchedFiles.keys()) {
    checkFileChange(filePath);
  }
  
  // Also check for new files
  const files = getLuaFiles(CONFIG.watchDir);
  for (const file of files) {
    if (!watchedFiles.has(file)) {
      registerFile(file);
      checkFileChange(file);
    }
  }
}

// ── Push changes to server ────────────────────────────────────────────────────
async function pushChanges() {
  if (pending.length === 0) return;
  
  // Push via /push endpoint (which queues to /pending)
  while (pending.length > 0) {
    const change = pending.shift();
    
    const result = await httpPost("/push", {
      path: change.path,
      source: change.source,
      className: change.className,
    });
    
    if (result && result.ok) {
      console.log(`[Watcher] ✅ Pushed: ${change.path} (${change.event})`);
    } else {
      console.log(`[Watcher] ❌ Failed: ${change.path}`);
    }
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────
function listFiles() {
  const files = getLuaFiles(CONFIG.watchDir);
  console.log(`\n📁 Local scripts (${files.length} files):`);
  console.log("─".repeat(50));
  for (const file of files) {
    const rel = path.relative(CONFIG.watchDir, file);
    const robloxPath = localToRobloxPath(file);
    const size = fs.statSync(file).size;
    console.log(`  ${rel.padEnd(40)} → ${robloxPath}`);
  }
  console.log("");
}

function syncAll() {
  console.log("\n🔄 Syncing all local files to Studio...");
  pollForChanges();
  pushChanges();
}

// ── REPL for interactive commands ─────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "roagent-watcher> ",
});

rl.prompt();

rl.on("line", (line) => {
  const cmd = line.trim().toLowerCase();
  
  switch (cmd) {
    case "list":
    case "ls":
      listFiles();
      break;
    case "sync":
    case "push":
      syncAll();
      break;
    case "status":
      httpGet("/status").then((s) => {
        if (s && s.ok) {
          console.log(`✅ Server: ${s.scriptCount} scripts, ${s.errorCount} errors`);
        } else {
          console.log("❌ Server unreachable");
        }
      });
      break;
    case "help":
    case "?":
      console.log(`
Commands:
  list/ls   - List local script files
  sync      - Push all local files to Studio
  status    - Check server connection
  quit/exit - Exit watcher
`);
      break;
    case "quit":
    case "exit":
      console.log("👋 Goodbye!");
      process.exit(0);
    default:
      if (cmd) console.log(`Unknown: ${cmd}. Type 'help' for commands.`);
  }
  
  rl.prompt();
});

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║  RoAgent Local File Watcher               ║
║  Watches local .lua files and syncs       ║
║  to Roblox Studio automatically           ║
╚════════════════════════════════════════════╝
`);
  
  // Check server
  const status = await httpGet("/health");
  if (!status || !status.ok) {
    console.log("❌ Cannot reach RoAgent server at", CONFIG.serverUrl);
    console.log("   Start the server first: roblox");
    process.exit(1);
  }
  console.log("✅ Connected to RoAgent server");
  
  // Setup
  scanExistingFiles();
  startWatching();
  
  // Auto-sync on startup
  console.log("\n🔄 Syncing all local files to Studio...");
  pollForChanges();
  pushChanges();
  
  // Push loop
  setInterval(pushChanges, 500);
  
  console.log(`
📋 Commands:
  list/ls   - List local script files
  sync      - Push all local files to Studio
  status    - Check server connection
  help      - Show all commands
  quit      - Exit

💡 Edit .lua files in local-scripts/ folder
   Changes auto-sync to Studio!
`);
}

main();