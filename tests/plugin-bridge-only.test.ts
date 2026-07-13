import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("bridge-only Roblox Studio plugin", () => {
  const source = readFileSync(path.join(repoRoot, "plugin", "StudioLinkBridgeOnly.lua"), "utf8");
  const bundle = readFileSync(path.join(repoRoot, "plugin", "StudioLinkBridgeOnly_Bundled.lua"), "utf8");

  function expectNoProductUi(text: string) {
    expect(text).not.toContain("CreateDockWidgetPluginGui");
    expect(text).not.toContain("CreateToolbar");
    expect(text).not.toContain("CreateButton");
    expect(text).not.toContain('require(script:WaitForChild("Theme"))');
    expect(text).not.toContain('require(script:WaitForChild("Panels")');
    expect(text).not.toContain("HomePanel");
    expect(text).not.toContain("HistoryPanel");
    expect(text).not.toContain("AgentLogPanel");
    expect(text).not.toContain("DockWidgetPluginGuiInfo");
    expect(text).not.toContain("makeButton");
    expect(text).not.toContain("stylePanel");
    expect(text).not.toContain("StudioLinkHome");
    expect(text).not.toContain("StudioLinkHistory");
    expect(text).not.toContain("StudioLinkAgentLog");
  }

  it("contains no Studio product UI surfaces in source or generated bundle", () => {
    expectNoProductUi(source);
    expectNoProductUi(bundle);
  });

  it("keeps the bridge responsibilities required by the desktop app", () => {
    expect(source).toContain('PLUGIN_VERSION = "2.0.0-bridge"');
    expect(source).toContain('require(script:WaitForChild("BridgeUtils"))');
    expect(source).toContain("ConnectionManager.new");
    expect(source).toContain('connection:send("script:syncSnapshot"');
    expect(source).toContain('connection:sendScriptEvent("script:create"');
    expect(source).toContain('connection:sendScriptEvent("script:write"');
    expect(source).toContain('connection:sendScriptEvent("script:delete"');
    expect(source).toContain('connection:sendScriptEvent("script:rename"');
    expect(source).toContain('connection:sendScriptEvent("script:ackDeploy"');
    expect(source).toContain('connection:on("watch:event", applyWatchEvent)');
    expect(source).toContain("scanForUnwatchedScripts");
    expect(source).toContain("RoAgentUniqueId");
  });

  it("generates a standalone local plugin bundle", () => {
    expect(bundle).toContain("StudioLink bridge-only bundled Roblox Studio plugin");
    expect(bundle).toContain("local function load_BridgeUtils()");
    expect(bundle).toContain("local function load_ConnectionManager()");
    expect(bundle).toContain("local Utils = load_BridgeUtils()");
    expect(bundle).toContain("local ConnectionManager = load_ConnectionManager()");
    expect(bundle).not.toContain("require(script:WaitForChild");
    expect(bundle).toContain('PLUGIN_VERSION = "2.0.0-bridge"');
  });
});
