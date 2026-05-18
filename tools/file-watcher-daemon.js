// RoAgent Local File Watcher - Daemon Mode
// Watches local .lua files and auto-pushes changes to Studio

import fs from "fs";
import path from "path";
import { watch } from "fs";

const CONFIG = {
  watchDir: process.env.HOME + "/roagent/local-scripts",
  serverUrl: "http://127.0.0.1:8765",
  debounceMs: 300,
};

const pending = new Map();
const watchedFiles = new Map();

async function httpPost(p, body) {
  try {
    const res = await fetch(CONFIG.serverUrl + p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  } catch (e) {
    return null;
  }
}

function localToRobloxPath(localPath) {
  const rel = path.relative(CONFIG.watchDir, localPath);
  return rel.replace(/\.lua$/, "").replace(/\\/g, ".");
}

function getClassName(filename) {
  if (filename.includes("LocalScript") || filename.includes("Client")) return "LocalScript";
  if (filename.includes("Module")) return "ModuleScript";
  return "Script";
}

function getFileHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

function getLuaFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getLuaFiles(fullPath, files);
    } else if (entry.name.endsWith(".lua")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function pushFile(filePath, content) {
  const robloxPath = localToRobloxPath(filePath);
  const filename = path.basename(filePath, ".lua");
  const className = getClassName(filename);
  
  const result = await httpPost("/push", {
    path: robloxPath,
    source: content,
    className,
  });
  
  if (result && result.ok) {
    console.log(`✅ ${robloxPath}`);
  } else {
    console.log(`❌ ${robloxPath}`);
  }
}

async function scanAndSync() {
  const files = getLuaFiles(CONFIG.watchDir);
  console.log(`📁 Found ${files.length} files`);
  
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    await pushFile(file, content);
  }
}

function startWatching() {
  console.log(`👁 Watching ${CONFIG.watchDir}...`);
  
  watch(CONFIG.watchDir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith(".lua")) return;
    
    const fullPath = path.join(CONFIG.watchDir, filename);
    
    setTimeout(async () => {
      if (!fs.existsSync(fullPath)) return;
      
      const content = fs.readFileSync(fullPath, "utf-8");
      const hash = getFileHash(content);
      const existing = watchedFiles.get(fullPath);
      
      if (!existing || existing.hash !== hash) {
        watchedFiles.set(fullPath, { hash });
        console.log(`📝 ${filename} changed`);
        await pushFile(fullPath, content);
      }
    }, CONFIG.debounceMs);
  });
}

async function main() {
  console.log(`\n╔════════════════════════════════════════════╗
║  RoAgent File Watcher (Daemon)           ║
╚════════════════════════════════════════════╝\n`);
  
  // Check server
  try {
    const res = await fetch(CONFIG.serverUrl + "/health");
    if (!res.ok) throw new Error();
  } catch {
    console.log("❌ Cannot reach RoAgent server");
    console.log("   Run 'roblox' first\n");
    process.exit(1);
  }
  console.log("✅ Connected to RoAgent server\n");
  
  // Create local-scripts if missing
  if (!fs.existsSync(CONFIG.watchDir)) {
    fs.mkdirSync(CONFIG.watchDir, { recursive: true });
    console.log(`📁 Created ${CONFIG.watchDir}\n`);
  }
  
  // Initial sync
  await scanAndSync();
  
  // Start watching
  startWatching();
  
  console.log("\n💡 Edit files in VS Code - changes auto-sync!\n");
  console.log("Press Ctrl+C to stop\n");
}

main();