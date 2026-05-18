import { describe, expect, it } from "vitest";
import path from "node:path";
import { defaultInstallDir, isInstalledPath, isPackagedWindowsDaemon, shouldRunSelfInstall } from "../server/src/services/selfInstallService.ts";

describe("self-install helpers", () => {
  it("uses per-user LocalAppData install directory", () => {
    expect(defaultInstallDir({ LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local" }, "C:\\Users\\Ada")).toBe(path.join("C:\\Users\\Ada\\AppData\\Local", "Programs", "StudioLink"));
  });

  it("detects packaged Windows daemon names", () => {
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\studiolink-daemon.exe")).toBe(true);
    expect(isPackagedWindowsDaemon("win32", "C:\\Downloads\\StudioLinkSetup.exe")).toBe(true);
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
  });

  it("does not reinstall when installed daemon starts normally", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    expect(shouldRunSelfInstall([`${dir}\\studiolink-daemon.exe`], "win32", `${dir}\\studiolink-daemon.exe`, dir)).toBe(false);
  });

  it("runs explicit self-install commands", () => {
    const dir = "C:\\Users\\Ada\\AppData\\Local\\Programs\\StudioLink";
    for (const command of ["install", "uninstall", "repair", "start", "status"]) {
      expect(shouldRunSelfInstall(["C:\\Downloads\\studiolink-daemon.exe", command], "win32", "C:\\Downloads\\studiolink-daemon.exe", dir)).toBe(true);
    }
  });
});
