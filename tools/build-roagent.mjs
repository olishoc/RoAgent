import { mkdirSync, copyFileSync, existsSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const roagentRoot = process.env.ROAGENT_SOURCE_DIR
  ? path.resolve(process.env.ROAGENT_SOURCE_DIR)
  : process.cwd();
const repoRoot = path.resolve(roagentRoot, "..");
const codingAgent = path.join(roagentRoot, "packages", "coding-agent");
const outDir = path.join(roagentRoot, "dist");
const rootDist = path.join(repoRoot, "dist");

mkdirSync(outDir, { recursive: true });
mkdirSync(rootDist, { recursive: true });

function run(command, args, cwd = roagentRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "build"], codingAgent);

const targetPlatform = process.env.STUDIOLINK_TARGET_PLATFORM ?? process.platform;
const binaryName = targetPlatform === "win32" ? "roagent.exe" : "roagent";
const binaryPath = path.join(outDir, binaryName);
const version = JSON.parse(readFileSync(path.join(codingAgent, "package.json"), "utf8")).version;
const bunTarget =
  targetPlatform === "win32"
    ? ["--target", "bun-windows-x64"]
    : targetPlatform === "darwin"
      ? ["--target", "bun-darwin-x64"]
      : [];
const bunArgs = ["build", "--compile", ...bunTarget, "./dist/bun/cli.js", "--outfile", binaryPath];

let bunResult = spawnSync("bun", bunArgs, {
  cwd: codingAgent,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (bunResult.error && bunResult.error.message.includes("ENOENT")) {
  bunResult = spawnSync("npx", ["--yes", "bun", ...bunArgs], {
    cwd: codingAgent,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

if (bunResult.status !== 0) {
  const cliPath = path.join(codingAgent, "dist", "cli.js");
  if (targetPlatform === "win32") {
    writeFileSync(
      binaryPath,
      `@echo off\r\nif "%1"=="--version" echo ${version}& exit /b 0\r\nif "%1"=="-v" echo ${version}& exit /b 0\r\nnode "${cliPath}" %*\r\n`,
      "utf8",
    );
  } else {
    writeFileSync(
      binaryPath,
      `#!/bin/sh\nif [ "$1" = "--version" ] || [ "$1" = "-v" ]; then\n  echo "${version}"\n  exit 0\nfi\nexec node "${cliPath}" "$@"\n`,
      "utf8",
    );
    chmodSync(binaryPath, 0o755);
  }
  console.warn("Bun executable build unavailable; wrote development launcher fallback instead.");
}

if (existsSync(binaryPath)) {
  copyFileSync(binaryPath, path.join(rootDist, binaryName));
}
