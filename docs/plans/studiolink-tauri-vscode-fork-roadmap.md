# StudioLink Tauri + VS Code Fork Roadmap

Status: active migration plan  
Target product: StudioLink, a Roblox-specific Cursor-style coding environment built from a true VS Code fork, with Roblox Studio reduced to a bridge-only plugin.

## Product Shape

StudioLink becomes the primary UI. Roblox Studio keeps only a background bridge that syncs script state, applies desktop-authored edits, and reports place metadata. All configuration, history, Git, AI, daemon, debugging, and coding surfaces move into the Tauri desktop app and then into the VS Code fork shell.

The visual direction is technical rather than friendly: dark transparent shell, small mono text, terminal red lighting, high contrast panels, classic app menu, dense controls, and a professional operator-console feel.

## Current State

- Tauri app exists under `desktop/`.
- The app can inspect daemon status, start/stop/restart the daemon, toggle autostart, check updates, repair, open downloads, reveal logs, and list Roblox projects from daemon `project:list` with local cache fallback.
- The polished shell includes a loading screen, transparent frame support, classic menu strip, multi-page navigation, project browser, Studio setup page, VS Code-style coding page, debugger page, daemon page, and logs page.
- The desktop app now has a native authenticated daemon RPC bridge, so license, GitHub, project script, Git, agent, and AI setup flows can be owned by Tauri rather than Roblox Studio.
- The Projects page now renders daemon project metadata including live/cached state, place name, game id, job id, script/byte counts, last sync, and cache/repo folder actions.
- The current Roblox Studio plugin still owns substantial UI through DockWidgets and panels.
- A separate `plugin/StudioLinkBridgeOnly.lua` entrypoint exists and is guarded by tests to prevent DockWidget, toolbar, panel UI, and UI helper code in the generated bridge bundle.
- `npm run build:plugin` generates `plugin/StudioLinkBridgeOnly_Bundled.lua` and embeds it as the default `/downloads/StudioLinkPlugin_Bundled.lua` website artifact, while keeping the old UI plugin at `/downloads/StudioLinkPlugin_LegacyUI.lua`.
- The daemon already exposes local RPC for script, project, history, Git, agent, license, watch, and daemon operations. The project RPC family covers `project:list`, `project:scripts`, `project:read`, and `project:write` for desktop/editor ownership.
- A local VS Code source checkout exists at `C:\Users\olivi\OneDrive\Documents\StudioLinkCode` on branch `studiolink/bootstrap`. Its `upstream` remote is `https://github.com/microsoft/vscode.git`; `origin` is the real fork `https://github.com/olishoc/studiolink-vscode.git`.
- The VS Code checkout has a first built-in `studiolink-terminal-red-theme` extension under `extensions/studiolink-terminal-red-theme`.
- The VS Code checkout now has a first daemon-backed `studiolink-roblox` extension under `extensions/studiolink-roblox`. It contributes a StudioLink activity-bar project tree backed by daemon project APIs with local cache fallback, daemon health checks, project open command, active Lua/Luau apply-to-Studio through `project:write`, and initial inline Luau suggestions.
- The fork root `product.json` has started the Code - OSS to StudioLink rename for application names, data folders, shell labels, URL protocol, and issue routing. Icons, signing IDs, installer identity, and a full build pass remain open.
- GitHub CLI is authenticated as `olishoc`. The GitHub fork exists at `https://github.com/olishoc/studiolink-vscode`, and branch `studiolink/bootstrap` has been pushed with commit `4cc08b9a`.

## Non-Negotiable End State

1. StudioLink app is the main product surface.
2. Roblox Studio plugin has no product UI. It only links Studio to the daemon.
3. Users can see all synced Roblox projects in StudioLink.
4. Users can configure everything currently configured inside the Studio plugin from StudioLink.
5. The coding surface is not a simulation. It is based on a true VS Code fork.
6. The VS Code fork is styled into the StudioLink terminal-red technical theme.
7. Roblox script editing, suggestions, deploy/apply, Git history, and debugging are first-class flows.

## Architecture

### Process Layout

- `studiolink-daemon.exe`
  - Local protocol server.
  - Owns place cache, script history, Git operations, agent launching, license, updates, and support bundles.
- Tauri StudioLink shell
  - Native command/control shell.
  - Owns setup and operational UI.
  - Hosts project selection and migration flows.
  - Eventually launches or embeds the VS Code fork.
- VS Code fork
  - Real fork of `microsoft/vscode`, renamed and themed as StudioLink.
  - Ships bundled StudioLink extensions for Roblox project tree, daemon RPC, Luau editing, AI suggestions, deploy/apply, history, and debug.
- Roblox Studio bridge plugin
  - No DockWidget panels.
  - No settings UI.
  - No onboarding UI.
  - Connects to localhost daemon.
  - Sends place info and script snapshots.
  - Watches Studio script changes.
  - Applies script changes requested by daemon/desktop.

## Concrete Steps

### Phase 1: Tauri Shell Hardening

1. Keep polishing the shell until it has the final visual language.
2. Add app-level loading states for boot, daemon reconnection, project scan, and update checks.
3. Add transparent native window support and decide whether to keep OS window chrome or implement custom window controls.
4. Replace static Code and Debugger pages with daemon-backed data. Status: Code page uses daemon project scripts, Git status, and agent status; Debugger is still a planned shell.
5. Add persistent selected project state.
6. Add project detail page with scripts, history, Git status, recent agent actions, and daemon watch status. Status: first selected-project detail panel exists with project metadata and cache/repo actions; history/recent actions/watch status still need dedicated panels.
7. Add setup pages for AI provider, license, GitHub remote, plugin install, daemon install, and diagnostics.

### Phase 2: Daemon API for Desktop Ownership

1. Add HTTP/Tauri-safe endpoints for listing projects with place name, game id, script count, last sync, repo path, dirty status, and active Studio connection state. Status: daemon RPC project summaries now expose place metadata, paths, script counts, total bytes, repo presence, and active/cache state.
2. Add endpoints for reading/writing desktop settings currently stored in the plugin.
3. Add bridge health endpoint showing connected Studio sessions.
4. Add plugin install/export endpoint so StudioLink can generate and install the bridge-only plugin artifact.
5. Add project-scoped script list/read/write endpoints that do not require the app to manually craft protocol envelopes. Status: `project:scripts`, `project:read`, and `project:write` exist as editor-safe RPC wrappers.
6. Add daemon tests for the new desktop endpoints. Status: e2e coverage exercises the project RPC family over WebSocket.

### Phase 3: Bridge-Only Roblox Plugin

1. Create a new `StudioLinkBridgeOnly` plugin entrypoint.
2. Keep script scanning, UniqueId tracking, snapshot sync, change debouncing, stale cleanup, and deploy acknowledgement.
3. Keep daemon auth token refresh and localhost RPC transport.
4. Remove all DockWidget creation.
5. Remove toolbar buttons except a minimal optional diagnostic command if Studio requires discoverability.
6. Remove theme, home, history, settings, and agent-log panels from the default bundled plugin.
7. Replace in-Studio setup prompts with daemon events surfaced in the desktop app.
8. Add automated plugin checks proving the bridge-only build contains no `CreateDockWidgetPluginGui`, no panel modules, and no setup UI strings.
9. Update `website-worker/src/pluginBundle.ts` generation to publish the bridge-only plugin after parity is verified. Status: generated and wired as the default download, with old UI plugin retained as a legacy fallback.

### Phase 4: True VS Code Fork

1. Create a real GitHub fork of `microsoft/vscode` under the product owner account. Status: done at `https://github.com/olishoc/studiolink-vscode`.
2. Clone that fork into a dedicated workspace, not as a mock editor inside the Tauri app. Status: local checkout exists at `C:\Users\olivi\OneDrive\Documents\StudioLinkCode`.
3. Rename product metadata from Code - OSS to StudioLink where license-compatible.
4. Keep upstream remote as `microsoft/vscode` and origin as the StudioLink fork.
5. Add a StudioLink product configuration, icons, application name, and update channel.
6. Build Code - OSS from the fork on Windows first.
7. Add a StudioLink theme extension with the terminal-red transparent/dark operator aesthetic.
8. Add a StudioLink Roblox extension that connects to `127.0.0.1:45678`. Status: first extension scaffold added with health/RPC client.
9. Add project provider that maps daemon places to VS Code workspaces. Status: project tree reads daemon project APIs first, falls back to the local StudioLink cache, and opens synced repo/place folders.
10. Add commands for script read/write/create/delete/rename/restore. Status: active Lua/Luau write/apply command exists; create/delete/rename/restore are still open.
11. Add AI suggestions panel backed by the RoAgent daemon/agent runtime. Status: first inline completion provider exists with local Roblox-aware suggestions; daemon-backed AI suggestions are still open.
12. Add debugger adapter plan for Roblox/Luau once bridge telemetry supports breakpoints and output streaming.
13. Add CI for fork build artifacts.
14. Decide final packaging: ship standalone StudioLink Code fork, or launch it from Tauri Mission Control.

### Phase 5: Coding Surface

1. Replace the Tauri mock Code page with a launcher/status panel for the VS Code fork.
2. In the fork, implement a Roblox project explorer backed by daemon project APIs. Status: first daemon-backed explorer exists with cache fallback.
3. Use Luau language support and Roblox-aware path conventions.
4. Implement inline suggestions, patch previews, and accept/reject flows.
5. Implement apply-to-Studio and deploy acknowledgement flows.
6. Implement history/diff views using daemon history and Git endpoints.
7. Implement terminal panels for RoAgent actions and daemon logs.
8. Implement debugger UI once the daemon/plugin support breakpoint state and output events.

### Phase 6: Release and Migration

1. Build and publish the polished Tauri shell.
2. Build and publish bridge-only Roblox plugin as a separate beta artifact.
3. Keep old UI plugin available as fallback until desktop parity is proven.
4. Add migration warnings in the old plugin telling users to install StudioLink desktop.
5. Publish the VS Code fork as an alpha once it can open a synced place and edit a script round trip.
6. Make `rblxagent.com/download` present the correct app, daemon, plugin, and fork builds.

## Verification Gates

- Desktop build: `npm run build` in `desktop`.
- Native check: `cargo check` in `desktop/src-tauri`.
- Tauri bundle: `npm run tauri:build` in `desktop`.
- Worker tests: `npx vitest run ..\tests\website-worker.test.ts` in `server`.
- Plugin bridge-only test: prove bundled plugin has no DockWidget/panel UI code and the public Worker plugin route serves the bridge-only build.
- VS Code fork proof: fork remote exists, local clone remote origin points to the fork, upstream points to `microsoft/vscode`, branch `studiolink/bootstrap` is pushed, StudioLink built-in extensions typecheck, and a Windows build launches.
- Round-trip proof: edit a Roblox script from StudioLink fork, apply it to Studio, receive acknowledgement, and see history/Git update.

## Immediate Next Slice

1. Add daemon desktop endpoints for project metadata and config ownership.
2. Add daemon desktop endpoints for bridge plugin install/export and project-scoped script read/write.
3. Add persistent selected project state and a real project detail page with history, Git, recent agent actions, and watch/session status.
4. Broaden the VS Code extension beyond active-script apply into create/delete/rename/restore/history UI.
5. Run the first Windows Code - OSS build from the StudioLink fork checkout after dependency install.
