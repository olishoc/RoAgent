# RoAgent Commercial Product Rewrite Plan

**Date:** 2026-05-17  
**Status:** Phase 0 started  
**RepoRoot:** `/home/olivi/roagent`  
**Priority order:** reliability → UI → updater/installer → licensing/commercial polish

---

## 1. Requirements from clarification

- Launch platform: **Windows first**.
- Plugin distribution: **Roblox Creator Store** for Studio plugin.
- Daemon/backend distribution: **rblxagent.com** sells and updates the Windows daemon installer.
- Price/licensing: website sells daemon installer for **$20** through **Polar**; licensing/payment enforcement belongs primarily on website/download entitlement, not inside an in-Studio chat flow.
- AI UX: **no full chat inside Roblox Studio**. The Studio plugin launches RoAgent in a separate terminal window.
- Studio plugin UI: serious Roblox Studio-like UI, rounded edges, subtle transparency, terminal-inspired, animated, minimal emojis, theme setting. Main plugin pages should open centered, especially history.
- Git/history model: internal versions first; git commits on demand, batched after time, and when unsaved/closing if possible.
- Repos: automatic per-place repo by default, with setting to use an existing repo.
- Diffs: rich diff UI inside Roblox Studio plugin.
- Safety: ignore Roblox default/runtime scripts unless user explicitly opts in.
- Scope: all modules may be rewritten over phases; keep this Markdown as the cross-session tracker.

---

## 2. Current state and known risks

### Current working pieces

- Roblox Studio can open/launch RoAgent terminal through daemon/plugin flow.
- Studio can open `rblxagent.com` update/download pages.
- HTTP RPC daemon/plugin integration is on `127.0.0.1:45678`.
- Token auth exists for local mutating endpoints.
- Plugin/daemon support script inventory, reads, writes, creates, deletes, renames, history, recent actions, update status, and agent launch/recent action display.
- Pending deploy architecture exists so daemon-created/agent-created scripts can be safely applied to Studio.

### Known risks

- Live users may still run old daemon/plugin until they restart daemon and reload/update plugin.
- Roblox plugin publishing is not fully automatable from Studio itself; manual Creator Store publishing remains the safe default.
- Stale daemon state previously caused daemon-only scripts to appear active and risked deletes/overwrites.
- Plugin polling must stay conservative: deploy pending/legacy only, never delete from polling.
- Roblox default scripts (`PlayerModule`, `CameraScript`, `ControlScript`, `Animate`, plugin scripts) must remain protected by default.
- Website currently provides basic pages/downloads but not a complete commercial installer purchase/update portal.
- Windows installer/updater exists only as early scaffolding and needs production hardening.
- Main README still contained old `8765`/embedded chat assumptions before Phase 0.

---

## 3. Non-negotiable constraints

- Preserve HTTP RPC as primary transport on **`127.0.0.1:45678`**.
- Do **not** require WebSocket for normal operation.
- Do **not** return to old `127.0.0.1:8765` docs/runtime.
- Roblox plugin cannot start a dead daemon; it may only call a reachable daemon to open URLs/restart/update itself.
- Daemon may perform OS actions: open trusted URLs, launch terminal, restart/update itself.
- No full AI chat inside Studio. Studio launches RoAgent terminal.
- Plugin polling must never delete Studio instances.
- Polling deploys only `pendingStudioDeploy == true` records or legacy records missing the field, then ACKs deployment.
- Studio snapshot sync is authoritative for Studio-present scripts but must preserve pending/legacy daemon-only records until deployed/ACKed.
- Default/runtime Roblox scripts are ignored unless explicit opt-in is added later.
- Place-specific history must be isolated by `placeId`; unsaved places need unique unsaved IDs.
- All mutating local HTTP routes must stay token-protected and loopback-only.

---

## 4. Verified Roblox publishing/update facts

Sources checked:

- Roblox Studio plugin docs: <https://create.roblox.com/docs/studio/plugins>
- Roblox Creator Store docs: <https://create.roblox.com/docs/production/creator-store>
- Roblox Open Cloud asset usage docs: <https://create.roblox.com/docs/cloud/guides/usage-assets>

Verified:

- Studio plugins are created as Studio extensions and can be published through Studio using **Plugins → Publish as Plugin**.
- Creator Store supports public distribution and sale of plugins; seller setup is required for USD pricing on Roblox's marketplace.
- Creator Store plugin installation happens through Creator Hub/Toolbox/Studio asset flows.
- Open Cloud Assets API supports asset upload/update/version operations for some asset types, but the official docs warn asset content update endpoints are beta and have asset-type restrictions.
- The Open Cloud usage page confirms API key/OAuth scopes for asset read/write, but the researched docs do **not** prove a stable, safe automated Creator Store plugin publishing pipeline for this product.

Plan consequence:

- Default plugin update strategy is **manual Creator Store publishing** by the owner.
- RoAgent will generate and keep `plugin/PluginLua.lua` and `plugin/StudioLinkPlugin_Bundled.lua` ready for manual upload/publishing from `/home/olivi/roagent/plugin` (`\\wsl.localhost\Ubuntu\home\olivi\roagent\plugin` on Windows).
- The daemon/plugin can open an update page and report compatibility, but will not promise silent plugin hot-update.
- If future Roblox Open Cloud documentation confirms reliable plugin asset content updates, add a separate guarded publisher tool that requires explicit credentials and dry-run checks.

---

## 5. Target architecture

```text
Roblox Creator Store Plugin
  ↕ HTTP RPC, token-protected loopback
Local Windows Daemon 127.0.0.1:45678
  ↕ local process launch
RoAgent Terminal + StudioLink Tools
  ↕ place-scoped state
Local data + internal history + optional git repos
  ↕ trusted HTTPS release/update checks
rblxagent.com downloads, update manifest, purchase portal
```

### Plugin responsibilities

- Detect daemon health and update compatibility.
- Show Home, History, Deleted Scripts, Agent Activity, Settings.
- Launch RoAgent terminal through daemon when daemon is reachable.
- Scan only managed scripts and ignore protected/default/runtime scripts.
- Send authoritative Studio snapshot at startup.
- Send live events: created, modified, renamed, deleted.
- Apply daemon pending/legacy deploys safely; ACK successful deploys.
- Never delete from polling.
- Render rich internal history diffs in Studio.
- Display last 3 script modifications under the terminal launch/action area.

### Daemon responsibilities

- Own HTTP RPC on `127.0.0.1:45678`.
- Persist place-scoped script state, history versions, deleted records, action log, settings, update state.
- Manage internal versions separate from git commits.
- Batch/manual/on-close commit to per-place git repos.
- Launch RoAgent terminal with correct place ID, auth token, and ready-to-use StudioLink tools.
- Validate paths defensively even if plugin already validates them.
- Open trusted URLs and perform daemon self-update only after explicit user action.

### Website responsibilities

- Sell/download Windows daemon installer through Polar checkout/entitlements.
- Serve release manifest: latest daemon, minimum daemon, latest plugin, minimum plugin, download URLs, checksums/signatures.
- Host update/download instructions.
- Manage purchase entitlement and installer access.
- Later: account/license recovery and support portal.

### Git responsibilities

- Internal history is the immediate source for UI and rollback.
- Git is a durable batch/checkpoint layer, not a destructive source of truth.
- Per-place repo is automatic by default.
- Users can choose an existing repo per place.
- Git operations must never overwrite Studio from stale files without explicit user action.

---

## 6. Phased execution plan

### Phase 0 — Reliability docs and release artifacts

Status: **complete**

- [x] Clarify commercial product requirements.
- [x] Research official Roblox plugin/Creator Store/Open Cloud docs.
- [x] Create this durable project plan.
- [x] Update root README from old `8765`/embedded chat assumptions to current `45678` terminal model.
- [x] Update plugin README to describe pending/legacy deploy behavior.
- [x] Create `plugin/PluginLua.lua` as exact copy of generated bundle for GitHub/manual Creator Store upload.
- [x] Verify `PluginLua.lua` equals `StudioLinkPlugin_Bundled.lua`.

Acceptance criteria:

- Docs no longer tell users to use old port or in-Studio AI chat.
- `plugin/PluginLua.lua` exists and is upload-ready.
- Bundle sync and artifact comparison pass.

### Phase 1 — Script sync and history hardening

- [x] HTTP RPC primary on `127.0.0.1:45678`.
- [x] Token auth for local mutating routes.
- [x] Path denylist and allowed-root validation.
- [x] Startup Studio snapshot sync.
- [x] Pending deploy + deploy ACK.
- [x] Polling deploys only pending/legacy and never deletes.
- [x] Add focused tests for plugin polling semantics via Lua/unit harness or integration simulation.
- [x] Add migration/cleanup command for stale records per place.
- [ ] Add explicit opt-in settings for protected/default script management.
- [x] Ensure history tracks created, modified, renamed, deleted with origin and actor.
- [x] Ensure deleted scripts have a dedicated restore path and never vanish from history.
- [x] Ensure recent action feed exposes last 3 modifications for plugin UI and RoAgent terminal context.

Acceptance criteria:

- Agent-created scripts appear in Studio after plugin reload without stale deletions.
- Existing/default Roblox scripts remain untouched by default.
- Place A history cannot leak into Place B.
- Deleted scripts appear only in deleted page/history, not active list.
- Reconnect/restart tests pass repeatedly.

### Phase 2 — History, diff, deleted scripts UI

- [x] Start replacing current history page with a larger Studio-like panel.
- [x] Add tab foundation: Script History, Deleted Scripts, Git Commits.
- [ ] Add Settings tab.
- [ ] Add side-by-side or unified diff renderer in Lua UI.
- [ ] Add filters by path/event type/actor/date.
- [x] Add restore buttons with confirmation.
- [x] Add last 3 modifications component under RoAgent terminal launch area.
- [ ] Add non-destructive warning banners for protected/default scripts.

Acceptance criteria:

- User can inspect grouped versions inside Studio; richer diff polish remains.
- User can restore active history versions and deleted scripts deliberately.
- UI clearly separates active scripts from deleted scripts.
- Last 3 modifications visible without opening full history.

### Phase 3 — Studio-like UI revamp

- [x] Create design system: theme tokens, spacing, radius, animation constants.
- [x] Add dark/light/terminal themes.
- [x] Use Roblox Studio-like panels with slightly nicer rounded/translucent styling.
- [x] Reduce emojis to near zero.
- [x] Animate page open/close, status transitions, loading states.
- [x] Center main plugin pages by default.
- [x] Add Settings page: daemon status, autostart, repo mode, theme, protected-script opt-in status, update status.
- [x] Add connection diagnostics page.

Acceptance criteria:

- UI feels coherent and commercial, not prototype-like.
- Theme switch persists.
- Offline daemon state is clear and actionable.
- Plugin never crashes if daemon is missing.

### Phase 4 — Windows installer, autostart, updater

- [x] Choose installer technology and finalize packaging: self-installing Windows daemon bootstrapper with embedded RoAgent; pkg/LaunchAgent for macOS. NSIS is deprecated fallback only.
- [x] Install daemon executable, embedded RoAgent CLI, uninstall entry.
- [x] Add Windows autostart enabled by default with setting to disable.
- [x] Add health check and repair command.
- [x] Add update checker using checksum-verified manifest from `rblxagent.com` (`STUDIOLINK_UPDATE_MANIFEST_URL` override supported).
- [x] Add explicit one-click daemon update flow: download, verify checksum, stage replacement, restart when running packaged daemon.
- [x] Add rollback backup during staged replacement; full signed rollback policy remains a release prerequisite.
- [x] Add installer logs and support bundle export.

Acceptance criteria:

- Fresh Windows machine can install and autostart daemon.
- Plugin connects after Studio opens if daemon is installed/running.
- User can update daemon from Studio when daemon is reachable.
- Failed updates leave previous daemon working.

### Phase 5 — rblxagent.com commerce/download/update backend

- [x] Add real Windows self-installing daemon download endpoint (`/downloads/studiolink-daemon.exe`, backed by R2 or fallback URL once artifact is uploaded).
- [x] Add release manifest with version, URLs, checksums, minimum compatible versions (`/api/releases/studiolink.json`; checksum fields activate from env vars).
- [x] Add Polar purchase flow for $20 daemon installer (`/checkout` + Polar access-token wiring; final webhook secret still required).
- [x] Add entitlement-gated download links (implemented with KV tokens; currently `PUBLIC_DOWNLOADS=true` for testing).
- [x] Add account/email recovery flow (`/recover`, `/api/recover`; Resend email optional).
- [x] Add update page opened by plugin/daemon.
- [x] Add docs: install, update, uninstall, troubleshooting, Creator Store plugin install.
- [x] Add privacy/terms/refund text appropriate for commercial release baseline.

Production follow-ups before paid launch:

- [ ] Upload Windows self-installing daemon/macOS artifacts to R2 or set fallback URLs and checksum/size vars.
- [ ] Set `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` as Worker secrets.
- [ ] Add R2/KV binding IDs to `website-worker/wrangler.toml` after Cloudflare resource creation.
- [ ] Set `PUBLIC_DOWNLOADS=false` after purchase/recovery smoke tests pass.

Acceptance criteria:

- User can buy/download installer from website.
- Daemon/plugin can query update manifest.
- Manifest is machine-readable and cache-safe.
- Website clearly explains plugin manual update limitations.

### Phase 6 — Creator Store/manual publishing and GitHub artifact

- [ ] Maintain `plugin/PluginLua.lua` for manual upload.
- [ ] Add publishing checklist for Creator Store asset `138113402658474`.
- [ ] Add GitHub release checklist for `https://github.com/olishoc/RoAgentTest`.
- [ ] Add optional script to copy `PluginLua.lua` into a separate checkout if remote/credentials exist.
- [ ] Investigate future Open Cloud plugin asset update support, but keep it optional until official docs prove it.

Acceptance criteria:

- Owner can manually publish a new plugin version from a single file.
- Plugin release version matches website manifest.
- No unverified automatic Creator Store publishing is promised.

### Phase 7 — CI and release checklist

- [ ] CI: server typecheck/tests.
- [ ] CI: coding-agent build.
- [ ] CI: website-worker build/dry-run.
- [ ] CI: bundle sync and `PluginLua.lua` equality.
- [ ] CI: installer smoke/health check where possible.
- [ ] Release checklist: bump plugin version, daemon version, manifest, changelog, bundle, PluginLua, installer.
- [ ] Add manual Roblox Studio smoke checklist.

Acceptance criteria:

- No release can ship with stale bundle/artifact mismatch.
- Every release has explicit compatibility versions and rollback notes.

### Phase 8 — 3D model and instance bridge exploration

- [ ] Add safe instance creation/editing tools for Model, Part, MeshPart, Attachment, Motor6D, constraints, and folders.
- [ ] Add property editing for Size, CFrame, Color, Material, Transparency, Anchored, CanCollide, MeshId, TextureID, and parentage.
- [ ] Add model inspection for selected descendants, hierarchy, key properties, constraints, meshes, and bounds.
- [ ] Add a Studio selection bridge so the user can select an instance and ask RoAgent to edit it.
- [ ] Add viewport/camera preview commands: focus model, set view angle, show bounds/wireframe if possible, and capture thumbnails/screenshots.
- [ ] Investigate asset import/upload support for Roblox mesh asset IDs plus .fbx/.obj/.glb workflows where Roblox APIs allow it.
- [ ] Design a JSON model schema for parts, CFrames, materials, attachments, welds, constraints, and mesh references.

Acceptance criteria:

- RoAgent can create and revise persisted Studio instances, not just runtime script-generated placeholder parts.
- RoAgent can inspect selected models and use visual feedback to iterate on shape/proportion.
- Mesh import/upload remains gated behind official Roblox-supported workflows and explicit user action.

---

## 7. Cross-session progress log

### 2026-05-17

- Clarified product direction: Windows commercial daemon, Creator Store plugin, no in-Studio AI chat, reliability first.
- Verified official Roblox docs support manual Studio plugin publishing and Creator Store distribution; automatic Creator Store publishing remains unproven and must not be promised.
- Created this rewrite tracker.
- Previous reliability work completed before this plan:
  - HTTP RPC on `127.0.0.1:45678`.
  - Auth token protection for local mutating routes.
  - Path safety/denylist.
  - Snapshot sync with pending deploy preservation.
  - `script:ackDeploy`.
  - Plugin polling deploys pending/legacy only and never deletes.
  - Bundles regenerated and verified.
- Added `script:cleanupStale` safe daemon-state cleanup with dry-run default, no Studio delete broadcast, and tests.
- Improved Home UI reliability: explicit plugin/daemon version mismatch banners, endpoint/version/uptime status, daemon-dead warning, and Last 3 Script Changes from action/watch events.
- Fixed HTTP-mode Studio-origin script changes not appearing in Last 3 by listening to local script RPC responses and marking Studio-origin history as `studio-plugin`.
- Started Phase 2 History UI: tabs for Script History, Deleted Scripts, and Git Commits; active history uses daemon `history:get`; deleted page uses `history:getDeleted` with restore pending deploy.
- Started Phase 3 History polish: larger History window, time-grouped script modification folders, and fixed active history restore to use `script:restore` instead of git restore.
- Added recent StudioLink actions to RoAgent terminal startup context and a `recent_actions` tool so Studio/RoAgent logs are visible in chat context.
- Added dedicated StudioLink Settings page/panel with daemon status, account/update actions, repo/autostart status, theme switching, protected-script status, and reachable-daemon restart action; regenerated plugin bundles and website bundle.
- Softened dark/terminal theme colors and made pill text contrast-aware so status pills like Online remain readable.
- Renamed Agent Log to Activity and expanded it to show general script/watch/git activity; History now explains automatic script history vs Git snapshots and shows Git snapshots alongside per-script versions.
- Added non-destructive overlay panel fade-in/fade-out transitions for programmatic panel switches, including pre-open cover to avoid white flashes and fast-switch grey-state regressions.
- Combined Home and Settings into one Settings/status page with connection, diagnostics, Git, RoAgent terminal, recent changes, account/update, theme, protected-script status, and daemon restart controls.
- Fixed Activity clear so refreshed recent actions remain hidden until newer activity arrives, and made toolbar buttons toggle pages open/closed.
- Simplified History for usability and restyled it around the RoAgentV3 three-column layout: script search/list, version search/list, and source preview. Script History now shows only per-script automatic versions; Git Snapshots / Repo Checkpoints are kept in the separate Git tab. Added search, readable dates, action-colored rows, content-change plus markers, and pre-created hidden widgets to reduce first-open white flashes.
- Hardened Studio duplicate/copy-paste detection by making copied fallback IDs unique and periodically rescanning for unmanaged new scripts missed by DescendantAdded events.
- Captured future StudioLink 3D model/instance bridge ideas: instance editing, mesh import, viewport screenshots, model inspection, selection bridge, preview commands, and JSON model schema.

---

## 8. Open decisions

- Which Windows installer technology will be final?
- [decided] Use Polar for the $20 daemon installer purchase flow.
- Should daemon entitlement be checked online only at download time, or also periodically at runtime?
- Should per-place git repos be visible to users by default or hidden in app data unless configured?
- How aggressive should auto-commit batching be: time interval, script-count threshold, or save/close event only?
- What exact logo/icon source should be committed for UI: user referenced `C:\Users\olivi\Downloads\Icon.png`, which is not currently available in this Linux workspace.
