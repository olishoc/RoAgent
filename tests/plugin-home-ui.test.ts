import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

describe("plugin Home UI reliability", () => {
  it("shows one-window navigation, reliable status, history, github, settings, and logs UI", () => {
    const source = readFileSync(path.join(repoRoot, "plugin", "Panels", "Home.lua"), "utf8");
    expect(source).toContain('key = "home"');
    expect(source).toContain('key = "history"');
    expect(source).toContain('key = "github"');
    expect(source).toContain('key = "settings"');
    expect(source).toContain('key = "logs"');
    expect(source).toContain("function Home:renderShell");
    expect(source).toContain("Project status");
    expect(source).toContain("Launch RoAgent");
    expect(source).toContain("Github setup");
    expect(source).toContain("Create repo");
    expect(source).toContain("function Home:renderHistoryPage");
    expect(source).toContain("function Home:renderPreview");
    expect(source).toContain("codePalette");
    expect(source).toContain("Restore selected");
    expect(source).toContain("function Home:renderLogsPage");
    expect(source).toContain("DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float");
  });

  it("has Phase 3 theme tokens and animated controls", () => {
    const theme = readFileSync(path.join(repoRoot, "plugin", "Theme.lua"), "utf8");
    const utils = readFileSync(path.join(repoRoot, "plugin", "Utils.lua"), "utf8");
    const main = readFileSync(path.join(repoRoot, "plugin", "main.lua"), "utf8");
    expect(theme).toContain("terminal = {");
    expect(theme).toContain("accentSoft");
    expect(theme).toContain("radiusLarge");
    expect(theme).toContain("buttonHover");
    expect(theme).toContain("buttonPressed");
    expect(theme).toContain("glow");
    expect(theme).toContain("roblox_studio = {");
    expect(theme).toContain("high_contrast = {");
    expect(theme).toContain("vscode_dark = {");
    expect(theme).toContain("strokeHoverTransparency");
    expect(theme).toContain("Theme.ORDER = { \"dark\", \"roblox_studio\", \"vscode_dark\", \"light\", \"high_contrast\", \"terminal\" }");
    expect(utils).toContain("TweenService");
    expect(utils).toContain("UICorner");
    expect(utils).toContain("UIStroke");
    expect(utils).toContain("UIGradient");
    expect(utils).toContain("MouseEnter");
    expect(utils).toContain("MouseLeave");
    expect(utils).toContain("StudioLinkHoverBound");
    expect(utils).toContain("StudioLinkNormalColor");
    expect(utils).toContain("MouseButton1Down");
    expect(utils).toContain("MouseButton1Up");
    expect(utils).not.toContain("button.Rotation");
    expect(utils).not.toContain("Rotation = 0.15");
    expect(utils).not.toContain("Scale = 1.025");
    expect(utils).toContain("function Utils.animateIn");
    expect(main).toContain('PLUGIN_VERSION = "1.0.9"');
  });
});
