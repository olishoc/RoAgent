import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addPathEntry, commandShimContents, copyRoAgentRuntimeAssets, defaultInstallDir, isInstalledPath, isPackagedWindowsDaemon, pathListContains, removePathEntry, shouldRunSelfInstall } from "../server/src/services/selfInstallService.ts";

describe("self-install helpers", () => {
  it("uses per-user LocalAppData install directory", () => {
    expect(defaultInstallDir({ LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local" }, "C:\\Users\\Ada")).toBe(path.join("C:\\Users\\Ada\\AppData\\Local", "Programs", "StudioLink"));
  });

  it("detects packaged Windows daemon names", () => {
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\studiolink-daemon.exe")).toBe(true);
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\studiolink-daemon (1).exe")).toBe(true);
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\StudioLinkSetup.exe")).toBe(true);
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\StudioLinkSetup (2).exe")).toBe(true);
    expect(isPackagedWindowsDaemon("linux", "/tmp/studiolink-daemon")).toBe(false);
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\node.exe")).toBe(false);
  });

  it("detects installed daemon path", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    expect(isInstalledPath("C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink\\studiolink-daemon.exe", dir)).toBe(true);
    expect(isInstalledPath("C:\\Users\\Ada\\Downloads\\studiolink-daemon.exe", dir)).toBe(false);
  });

  it("runs installer when downloaded exe is double-clicked", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    expect(shouldRunSelfInstall(["C:\\Downloads\\studiolink-daemon.exe"], "win32", "C:\\Downloads\\studiolink-daemon.exe", dir)).toBe(true);
    expect(shouldRunSelfInstall(["C:\\Downloads\\studiolink-daemon (1).exe"], "win32", "C:\\Downloads\\studiolink-daemon (1).exe", dir)).toBe(true);
  });

  it("does not reinstall when installed daemon starts normally", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    expect(shouldRunSelfInstall([`${dir}\\studiolink-daemon.exe`], "win32", `${dir}\\studiolink-daemon.exe`, dir)).toBe(false);
  });

  it("runs explicit self-install commands", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    for (const command of ["install", "uninstall", "repair", "start", "stop", "restart", "status", "settings", "version", "doctor", "autostart", "logs", "help", "--help", "-h"]) {
      expect(shouldRunSelfInstall(["C:\\Downloads\\studiolink-daemon.exe", command], "win32", "C:\\Downloads\\studiolink-daemon.exe", dir)).toBe(true);
    }
  });

  it("leaves run command for foreground daemon debugging", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    expect(shouldRunSelfInstall([`${dir}\\studiolink-daemon.exe`, "run"], "win32", `${dir}\\studiolink-daemon.exe`, dir)).toBe(false);
  });

  it("creates a StudioLink command shim that starts the daemon by default", () => {
    const shim = commandShimContents("C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink\\studiolink-daemon.exe");
    expect(shim).toContain('if "%~1"==""');
    expect(shim).toContain('studiolink-daemon.exe" start');
    expect(shim).not.toContain("start \"\" /b");
  });

  it("creates a StudioLink command shim that passes arguments through", () => {
    const shim = commandShimContents("C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink\\studiolink-daemon.exe");
    expect(shim).toContain('studiolink-daemon.exe" %*');
  });

  it("adds the install directory to PATH idempotently", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    const original = "C:\\Windows\\System32;C:\\Tools";
    const once = addPathEntry(original, dir);
    const twice = addPathEntry(once, dir.toUpperCase());
    expect(pathListContains(once, dir)).toBe(true);
    expect(twice).toBe(once);
  });

  it("removes the install directory from PATH", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    expect(removePathEntry(`C:\\Windows\\System32;${dir};C:\\Tools`, dir)).toBe("C:\\Windows\\System32;C:\\Tools");
  });

  it("copies the RoAgent runtime assets required by the installed executable", () => {
    const root = mkdtempSync(path.join(tmpdir(), "studiolink-roagent-assets-"));
    const source = path.join(root, "source");
    const destination = path.join(root, "destination");
    try {
      mkdirSync(path.join(source, "theme"), { recursive: true });
      mkdirSync(path.join(source, "assets"), { recursive: true });
      writeFileSync(path.join(source, "package.json"), '{"name":"roagent"}', "utf8");
      writeFileSync(path.join(source, "theme", "dark.json"), '{"name":"dark"}', "utf8");
      writeFileSync(path.join(source, "assets", "logo.png"), Buffer.from([1, 2, 3]));

      copyRoAgentRuntimeAssets(source, destination);

      expect(readFileSync(path.join(destination, "package.json"), "utf8")).toContain("roagent");
      expect(readFileSync(path.join(destination, "theme", "dark.json"), "utf8")).toContain("dark");
      expect(existsSync(path.join(destination, "assets", "logo.png"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
