import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const roagentRoot = process.env.ROAGENT_SOURCE_DIR
  ? path.resolve(process.env.ROAGENT_SOURCE_DIR)
  : process.cwd();
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const codingAgent = path.join(roagentRoot, "packages", "coding-agent");
const outDir = path.join(roagentRoot, "dist");
const rootDist = path.join(repoRoot, "dist");
const bunVersion = "1.3.14";
const runtimeAssetNames = [
  "package.json",
  "README.md",
  "CHANGELOG.md",
  "theme",
  "assets",
  "export-html",
  "docs",
  "examples",
  "photon_rs_bg.wasm",
];

mkdirSync(outDir, { recursive: true });
mkdirSync(rootDist, { recursive: true });

function run(command, args, cwd = roagentRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32" && !command.endsWith(".exe"),
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status ?? "unknown"}`);
  }
}

run("npm", ["run", "build"], path.join(roagentRoot, "packages", "tui"));
run("npx", ["tsgo", "-p", "tsconfig.build.json"], path.join(roagentRoot, "packages", "ai"));
run("npm", ["run", "build"], path.join(roagentRoot, "packages", "agent"));
run("npm", ["run", "build"], codingAgent);

function patchProxyDependencyForBun() {
  const proxyModule = path.join(roagentRoot, "packages", "ai", "dist", "utils", "node-http-proxy.js");
  const proxyOriginal = readFileSync(proxyModule, "utf8");
  const withoutCreateRequire = proxyOriginal.replace(/^import \{ createRequire \} from "node:module";\r?\n/m, "");
  const proxyPatched = withoutCreateRequire.includes('import proxyFromEnv from "proxy-from-env";')
    ? withoutCreateRequire
    : withoutCreateRequire.replace(
        /const require = createRequire\(import\.meta\.url\);\r?\nconst \{ getProxyForUrl \} = require\("proxy-from-env"\);/,
        'import proxyFromEnv from "proxy-from-env";\nconst { getProxyForUrl } = proxyFromEnv;',
      );
  if (proxyPatched.includes("createRequire(import.meta.url)")) {
    throw new Error(`Unable to make proxy-from-env statically visible to Bun in ${proxyModule}`);
  }
  writeFileSync(proxyModule, proxyPatched, "utf8");

  const codexProvider = path.join(roagentRoot, "packages", "ai", "dist", "providers", "openai-codex-responses.js");
  const codexOriginal = readFileSync(codexProvider, "utf8");
  const withProxyImport = codexOriginal.includes('import proxyFromEnv from "proxy-from-env";')
    ? codexOriginal
    : `import proxyFromEnv from "proxy-from-env";\n${codexOriginal}`;
  const codexPatched = withProxyImport.replace(
    /const m = await dynamicImport\("proxy-from-env"\);\r?\n\s*const getProxyForUrl = m\.getProxyForUrl;/,
    "const { getProxyForUrl } = proxyFromEnv;",
  );
  if (codexPatched.includes('dynamicImport("proxy-from-env")')) {
    throw new Error(`Unable to make proxy-from-env statically visible to Bun in ${codexProvider}`);
  }
  writeFileSync(codexProvider, codexPatched, "utf8");
}

patchProxyDependencyForBun();

const targetPlatform = process.env.STUDIOLINK_TARGET_PLATFORM ?? process.platform;
const binaryName = targetPlatform === "win32" ? "roagent.exe" : "roagent";
const binaryPath = path.join(outDir, binaryName);
const packagePath = path.join(codingAgent, "package.json");
const version = JSON.parse(readFileSync(packagePath, "utf8")).version;
const bunTarget =
  targetPlatform === "win32"
    ? ["--target", "bun-windows-x64"]
    : targetPlatform === "darwin"
      ? ["--target", "bun-darwin-x64"]
      : [];
const bunArgs = ["build", "--compile", ...bunTarget, "./dist/bun/cli.js", "--outfile", binaryPath];
const bunTsconfig = path.join(codingAgent, "tsconfig.json");
if (existsSync(bunTsconfig)) {
  throw new Error(`Refusing to replace existing Bun build config at ${bunTsconfig}`);
}
writeFileSync(bunTsconfig, `${JSON.stringify({ extends: "./tsconfig.build.json", compilerOptions: { declaration: false, declarationMap: false } }, null, 2)}\n`, "utf8");
rmSync(binaryPath, { force: true });

let bunResult;
try {
  const bunCommand = process.platform === "win32" ? "bun.exe" : "bun";
  const installedBun = spawnSync(bunCommand, ["--version"], { encoding: "utf8", shell: false });
  const hasPinnedBun = installedBun.status === 0 && String(installedBun.stdout).trim() === bunVersion;
  const command = hasPinnedBun ? bunCommand : process.platform === "win32" ? "npx.cmd" : "npx";
  const args = hasPinnedBun ? bunArgs : ["--yes", `bun@${bunVersion}`, ...bunArgs];
  bunResult = spawnSync(command, args, {
    cwd: codingAgent,
    stdio: "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
} finally {
  rmSync(bunTsconfig, { force: true });
}

if (bunResult.error || bunResult.status !== 0) {
  const cliPath = path.join(codingAgent, "dist", "cli.js");
  if (targetPlatform === "win32") {
    throw new Error(`Bun failed to compile roagent.exe (exit ${bunResult.status ?? "unknown"})`);
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
  run("npm", ["run", "copy-binary-assets"], codingAgent);
  copyFileSync(binaryPath, path.join(rootDist, binaryName));
  for (const assetName of runtimeAssetNames) {
    const source = path.join(codingAgent, "dist", assetName);
    if (!existsSync(source)) throw new Error(`RoAgent runtime asset was not produced: ${source}`);
    for (const destinationRoot of [outDir, rootDist]) {
      const destination = path.join(destinationRoot, assetName);
      rmSync(destination, { recursive: true, force: true });
      cpSync(source, destination, { recursive: true });
    }
  }
}
