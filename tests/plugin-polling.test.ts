import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

function applyScriptListUpdatesBody(): string {
  const source = readFileSync(path.join(repoRoot, "plugin", "main.lua"), "utf8");
  const start = source.indexOf("local function applyScriptListUpdates(scripts)");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\nlocal function applyWatchEvent", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("plugin polling regression", () => {
  it("deploys only pending or legacy records and never deletes from polling", () => {
    const body = applyScriptListUpdatesBody();
    expect(body).toContain("local shouldDeploy = scriptRecord.pendingStudioDeploy == true or scriptRecord.pendingStudioDeploy == nil");
    expect(body).toContain("if shouldDeploy and scriptRecord.path");
    expect(body).toContain('connection:sendScriptEvent("script:ackDeploy", { refs = acknowledged })');
    expect(body).toContain("table.insert(acknowledged, { path = scriptRecord.path, uniqueId = scriptRecord.uniqueId })");
    expect(body).not.toContain("deleteScript(");
    expect(body).toContain("findScript(scriptRecord.path, scriptRecord.uniqueId)");
    expect(body).toContain('upsertScript(scriptRecord.path, scriptRecord.source, scriptRecord.className or "Script", scriptRecord.uniqueId)');
  });

  it("sends Studio UniqueId for live script operations", () => {
    const source = readFileSync(path.join(repoRoot, "plugin", "main.lua"), "utf8");
    expect(source).toContain("uniqueId = getUniqueId(child)");
    expect(source).toContain("uniqueId = uniqueId");
    expect(source).toContain("findScriptByUniqueId");
    expect(source).toContain("deleteScript(path, uniqueId)");
    expect(source).toContain("uniqueIdOwners");
    expect(source).toContain("rememberUniqueId(instance, attrValue, true)");
  });

  it("fires rename events when managed scripts move between parents", () => {
    const source = readFileSync(path.join(repoRoot, "plugin", "main.lua"), "utf8");
    expect(source).toContain("scriptInstance.AncestryChanged:Connect");
    expect(source).toContain("if parent == nil then");
    expect(source).toContain('pushLive("renamed", scriptInstance, newPath');
    expect(source).toContain("local wasWatched = watchedScripts[descendant] ~= nil");
    expect(source).toContain("descendant.Parent and not wasWatched");
    expect(source).toContain("container.DescendantRemoving:Connect");
    expect(source).toContain("if descendant.Parent and isManagedScript(descendant) then");
    expect(source).toContain("return");
  });

  it("rescans for duplicated or pasted scripts missed by Studio events", () => {
    const source = readFileSync(path.join(repoRoot, "plugin", "main.lua"), "utf8");
    expect(source).toContain("local function scanForUnwatchedScripts(emitCreates)");
    expect(source).toContain("not watchedScripts[descendant]");
    expect(source).toContain('pushLive("created", descendant, path)');
    expect(source).toContain("task.wait(2)");
  });
});
