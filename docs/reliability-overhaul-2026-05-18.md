# StudioLink/RoAgent Reliability Overhaul Plan — 2026-05-18

## Goal
Make StudioLink feel commercial-grade: install once, daemon stays reliably available, updates are automatic/easy, plugin UI clearly reflects daemon/update state, and users never need to guess which version they are running.

## Current user pain
- User installed RC4 but cannot tell from `status` whether RC4 bits are actually running because daemon reports only `3.0.0`.
- `StudioLink` command shim exists and user PATH is configured, but current PowerShell session cannot resolve it until PATH refresh.
- Opening/switching plugin pages causes fast black terminal flashes.
- Updates currently require manually downloading/running the new installer despite an update service existing.
- Plugin offline state treats restart/update downtime like missing daemon and pushes users toward re-download.

## Wiring map

### Website / release
- `website-worker/wrangler.toml` publishes the Windows daemon URL, SHA256, and size.
- `website-worker/src/index.ts` serves `/api/releases/studiolink.json` and `/downloads/studiolink-daemon.exe`.
- `website-worker/src/pluginBundle.ts` exposes plugin bundle and plugin version to update payloads.

### Installer / CLI
- `server/src/services/selfInstallService.ts` handles first-run install, repair, uninstall, start, stop, restart, status, settings, autostart, logs.
- It writes `%LOCALAPPDATA%\Programs\StudioLink\studiolink-daemon.exe` and `StudioLink.cmd`.
- It adds install dir to HKCU user PATH, but live terminals keep stale PATH until reopened.
- `status` currently says daemon version `3.0.0`, not RC/build identity.

### Daemon runtime
- `server/src/index.ts` `/health` returns version, RoAgent path, git installed, license status, uptime.
- WebSocket RPC handles plugin calls through `server/src/protocol/router.ts`.
- `/daemon/update/check` and `/daemon/update/apply` exist in `server/src/routes/daemonRoutes.ts` backed by `updateService.ts`.
- Update apply currently stages a new executable and runs an external script, but plugin UI does not present this as a clear safe update state.

### Roblox plugin UI
- `plugin/Panels/Home.lua` is the current main multi-page UI.
- Every page refresh sends daemon health, git status, GitHub status, and agent status. Settings additionally calls autostart status and update check.
- This means switching History/GitHub/Settings can trigger several Windows child-process checks through the daemon.
- Missing/restarting daemon state is not distinguished from a truly absent install.

### Roblox plugin distribution
- `plugin/StudioLinkPlugin_Bundled.lua` is latest manual upload source.
- Roblox plugin publishing is blocked by Roblox Open Cloud not supporting `TargetType Plugin` for API keys.
- Manual plugin asset update remains required.

## Root-cause hypotheses
1. Terminal flash: plugin page switch triggers status calls; daemon runs Windows helper commands (`git`, registry, GitHub/git checks). Some child process or credential helper can still create a visible `cmd.exe` window even if many calls use `windowsHide`. The safest product fix is to stop doing expensive OS/git checks on every page switch and provide cached/background status instead.
2. Version uncertainty: daemon version is semver-only and does not expose release channel/tag/commit/build time/checksum. RC3/RC4 both report `3.0.0`.
3. PATH confusion: installer writes HKCU PATH correctly, but existing shell environments do not update. This is normal Windows behavior but bad UX unless the installer/status makes it explicit and offers direct command path.
4. Update pain: update service exists but is not automatically checked/applied on daemon startup and plugin UI does not manage update/restart states.

## Fix plan

### A. Version identity and diagnostics
- Add build metadata constants/env support: release tag, commit, build time.
- Include these in `/health`, daemon health RPC, CLI `status`, and `settings`.
- Add `installedDaemonPath`, `commandShim`, `userPathConfigured`, `pathRefreshRequiredHint` to health/status.

### B. Stop terminal flashes
- Change plugin page refresh so it does not call git/GitHub status on every page switch.
- Only fetch git status on Home/History/GitHub pages when needed, debounced.
- Settings should call only health, license, autostart, and update check.
- Add daemon-side hidden process defaults and avoid shell-based commands wherever possible.
- Add a regression audit for `spawn/execFileSync/spawnSync` without `windowsHide` in Windows code paths.

### C. Robust daemon updater
- On daemon startup, schedule update check after a short delay.
- If manifest has newer build identity or newer semver, download/stage and apply automatically when safe.
- Persist update state in data dir: idle/checking/downloading/applying/restarting/failed/lastCheckedAt/lastError.
- Add `/daemon/update/status` route.
- Ensure restart script launches daemon hidden and writes update logs.
- Plugin should show `Updating/restarting` instead of `Download daemon` during update restart grace period.

### D. Plugin UI reliability UX
- Add `daemonTransitionState` in ConnectionManager: connected, reconnecting, updating, missing, blocked-http, unknown.
- During update/restart, show calm banner: “StudioLink is updating/restarting — reconnecting automatically.”
- Do not show Download StudioLink button during known restart/update grace period.
- Add Settings card showing daemon release tag/build/commit and update status.
- Improve page-switch refresh throttling/debouncing.

### E. CLI/app access
- Keep `StudioLink.cmd`, improve status/help text to explain stale PATH.
- Add `StudioLink update`, `StudioLink version`, `StudioLink doctor`.
- `doctor` should print actionable checks: daemon path, running health, PATH live/current, HKCU PATH, autostart registry, logs, plugin guidance.

### F. Tests and release
- Add tests for version metadata, updater status behavior, CLI commands, website manifest.
- Typecheck and run targeted tests.
- Build Windows artifact through GitHub Actions.
- Create RC5 release, update rblxagent.com, verify live manifest/download.
- Produce updated plugin Lua script and attach/send it.

## Acceptance checklist
- Opening/switching plugin pages does not spawn visible terminals.
- `/health` and CLI `status` identify exact release/build, not just `3.0.0`.
- Daemon checks updates automatically on startup.
- Plugin distinguishes restarting/updating from missing daemon.
- `StudioLink doctor` explains PATH/session problems clearly.
- New release downloadable from rblxagent.com and GitHub.
- Updated plugin bundled Lua is generated for manual Roblox upload.
