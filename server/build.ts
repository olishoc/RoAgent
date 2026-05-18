import { mkdirSync, copyFileSync, existsSync, chmodSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(serverRoot, "..");
const distDir = path.join(serverRoot, "dist");
const nccOut = path.join(distDir, "ncc");
const buildSrc = path.join(distDir, "build-src");
const platform = process.env.STUDIOLINK_TARGET_PLATFORM ?? process.platform;
const target = platform === "win32" ? "node20-win-x64" : platform === "darwin" ? "node20-macos-x64" : "node20-linux-x64";
const exeName = platform === "win32" ? "studiolink-daemon.exe" : "studiolink-daemon";

function run(command: string, args: string[], cwd = serverRoot): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function copyTransformed(src: string, dest: string): void {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) copyTransformed(path.join(src, entry), path.join(dest, entry));
    return;
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  if (src.endsWith(".ts")) {
    const transformed = readFileSync(src, "utf8").replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1$2");
    writeFileSync(dest, transformed, "utf8");
  } else {
    copyFileSync(src, dest);
  }
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(nccOut, { recursive: true });
copyTransformed(path.join(serverRoot, "src"), path.join(buildSrc, "server", "src"));
copyTransformed(path.join(repoRoot, "shared"), path.join(buildSrc, "shared"));
const buildInfoPath = path.join(buildSrc, "server", "src", "buildInfo.ts");
writeFileSync(buildInfoPath, `export interface BuildInfo {\n  releaseTag: string;\n  commitSha: string;\n  buildTime: string;\n}\n\nexport const BUILD_INFO: BuildInfo = {\n  releaseTag: ${JSON.stringify(process.env.STUDIOLINK_RELEASE_TAG || "dev")},\n  commitSha: ${JSON.stringify(process.env.STUDIOLINK_COMMIT_SHA || "unknown")},\n  buildTime: ${JSON.stringify(process.env.STUDIOLINK_BUILD_TIME || new Date().toISOString())},\n};\n`, "utf8");
writeFileSync(path.join(buildSrc, "server", "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  },
}, null, 2), "utf8");

const entry = path.join(buildSrc, "server", "src", "index.ts");
run("npx", ["ncc", "build", entry, "--out", nccOut, "--target", "es2022", "--transpile-only", "--external", "keytar"], path.join(buildSrc, "server"));

const pkgJson = JSON.parse(readFileSync(path.join(serverRoot, "package.json"), "utf8")) as Record<string, unknown>;
pkgJson.main = "index.js";
pkgJson.bin = "index.js";
if (platform === "win32") {
  const roAgentSource = process.env.STUDIOLINK_EMBED_ROAGENT_PATH || path.join(repoRoot, "dist", "roagent.exe");
  if (existsSync(roAgentSource)) {
    const embeddedDir = path.join(nccOut, "embedded");
    mkdirSync(embeddedDir, { recursive: true });
    copyFileSync(roAgentSource, path.join(embeddedDir, "roagent.exe"));
    pkgJson.pkg = {
      ...((typeof pkgJson.pkg === "object" && pkgJson.pkg !== null) ? pkgJson.pkg as Record<string, unknown> : {}),
      assets: ["embedded/**/*"],
    };
    console.log(`Embedded RoAgent from ${roAgentSource}`);
  } else {
    console.warn(`RoAgent executable not found at ${roAgentSource}; Windows daemon will self-install without embedded RoAgent.`);
  }
}
writeFileSync(path.join(nccOut, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");

const output = path.join(distDir, exeName);
const pkgInput = path.join(nccOut, "package.json");
const pkgResult = spawnSync("npx", ["pkg", pkgInput, "--targets", target, "--output", output], {
  cwd: serverRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (pkgResult.status !== 0) {
  const fallback = path.join(distDir, platform === "win32" ? "studiolink-daemon.cmd" : "studiolink-daemon");
  copyFileSync(path.join(nccOut, "index.js"), fallback);
  if (platform !== "win32") chmodSync(fallback, 0o755);
  console.warn("pkg executable build failed; wrote ncc single-file fallback instead.");
} else if (platform !== "win32" && existsSync(output)) {
  chmodSync(output, 0o755);
}

mkdirSync(path.join(repoRoot, "dist"), { recursive: true });
if (existsSync(output)) copyFileSync(output, path.join(repoRoot, "dist", exeName));
