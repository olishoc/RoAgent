import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (full.endsWith(".ts")) files.push(full);
  }
  return files;
}

describe("Windows child process visibility", () => {
  it("hides maintenance child processes that are not intentional terminals", () => {
    const root = path.resolve(__dirname, "../server/src");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const rel = path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/");
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!/(execFileSync|spawnSync|spawn\()/.test(line)) return;
        if (/^\s*import\s/.test(line)) return;
        if (/windowsHide: true/.test(line)) return;
        if (/launchctl|\/bin\/sh|\/usr\/bin\/env|xdg-open|open\]|osascript|Terminal\" to do script|scriptBin|spawnLinux|findLinuxTerminal|spawnWindowsCmd|Start-Process|cmd\.exe.*\/k|RoAgent — StudioLink AI|terminal ===|return spawn\(terminal|spawn\(scriptBin|spawn\(executable|const helper = `setTimeout/.test(line)) return;
        offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
