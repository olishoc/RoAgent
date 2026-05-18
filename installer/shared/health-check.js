#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import http from "node:http";

const port = Number(process.env.STUDIOLINK_DAEMON_PORT || 45678);
const logPath = process.platform === "win32"
  ? "%APPDATA%\\StudioLink\\logs\\daemon.log"
  : "~/Library/Logs/StudioLink/daemon.log";

function getHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: "/health", timeout: 1000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Timed out waiting for /health")));
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try { return await getHealth(); } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error("Daemon did not respond within 10 seconds");
}

(async () => {
  try {
    const health = await waitForHealth();
    if (!health.roAgentInstalled) throw new Error(`RoAgent executable missing: ${health.roAgentPath || "unknown path"}`);
    if (!health.gitInstalled) throw new Error("git executable is not installed or not on PATH");
    const roagent = process.env.STUDIOLINK_ROAGENT_PATH || (process.platform === "win32" ? "roagent.exe" : "roagent");
    const versionResult = spawnSync(roagent, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
    const version = `${versionResult.stdout || ""}${versionResult.stderr || ""}`.trim();
    if (versionResult.status !== 0) throw new Error(`roagent --version failed: ${version || versionResult.error?.message || "unknown error"}`);
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error(`roagent --version returned unexpected output: ${version}`);
    console.log("✓ StudioLink is running");
    console.log("✓ RoAgent is ready");
    console.log("You can now install the Roblox plugin from the Roblox toolbox.");
  } catch (error) {
    console.error(`StudioLink post-install check failed: ${error.message}`);
    console.error(`Log file: ${logPath}`);
    console.error("Help: https://studiolink.dev/troubleshooting");
    process.exit(1);
  }
})();
