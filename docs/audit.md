# RoAgent Technical Audit

**Audit date:** 2026-05-15  
**Project root:** `/home/olivi/roagent`  
**Scope:** Roblox Studio Lua plugin code, Node.js backend bridge, file watcher tooling, local data/config, and project docs. `node_modules/` is treated as third-party dependency output and is not line-by-line audited.

## Executive Summary

RoAgent currently has two partially overlapping plugin/backend designs:

1. **Runtime bridge plugin path** — the active `RoAgentPlugin.lua`, `RoAgent2_Plugin.lua`, and `RoAgentPlugin_v3.lua` files are identical monolithic Lua plugins that talk to a local Express bridge on `http://127.0.0.1:8765`. This path implements live Studio script sync, pending Pi writes/deletes, history UI, restore, purge, heartbeat, and event streaming.
2. **Modular v3 editor path** — `src/RoAgent.lua` plus `src/Services/*` and `src/UI/*` implement a custom DockWidget script editor and inline suggestion workflow. This path expects older `/health`, `/ping`, and `/suggest` agent endpoints, but the current real backend does not implement `/ping` or `/suggest`.

The **Node bridge** in `server/src/index.js` is the current runtime source of truth for live scripts, events, pending operations, console/error buffers, and place-aware script history stored in `server/data/history.json`.

---

## Folder and File Structure

### Root

| Path | Role |
|---|---|
| `README.md` | High-level overview and quick-start; partly stale because it documents `/agent`, `/suggest`, and `/config` endpoints that the current bridge no longer implements. |
| `ROADMAP.md` | Feature roadmap; marks file watching, Git versioning, console capture, error forwarding, and script browser as complete; team sync/batch/diff remain open. |
| `default.project.json` | Rojo-style project map for the modular plugin source under `src/`, placing `RoAgent.lua` and service/UI modules under `ServerScriptService.RoAgent`. |
| `RoAgent.rbxmx` | Roblox model/plugin export artifact. Not source-of-truth text for current development. |
| `RoAgentPlugin.lua` | Monolithic runtime bridge plugin; identical to `RoAgent2_Plugin.lua` and `RoAgentPlugin_v3.lua`; communicates with `server/src/index.js`. |
| `RoAgent2_Plugin.lua` | Duplicate of `RoAgentPlugin.lua`. |
| `RoAgentPlugin_v3.lua` | Duplicate of `RoAgentPlugin.lua`; despite the name, this is the bridge/history plugin, not the modular editor in `src/`. |
| `.context/compound-engineering/dialogs/docs-brainstorms-roagent-v3-script-editor-md.json` | Workflow artifact containing brainstorm state for the modular v3 editor idea. |
| `.context/compound-engineering/handoffs/roagent-v3-handoff.md` | Workflow handoff summarizing v3 editor requirements and noting that the server was expected to remain unchanged. |

### Documentation

| Path | Role |
|---|---|
| `docs/api.md` | Stale v3 agent API contract for `/health`, `/ping`, `/suggest`, `/agent`, `/config`, and `/info`; does not match the implemented bridge endpoints in `server/src/index.js`. |
| `docs/architecture.md` | Modular v3 plugin architecture document describing services/UI modules and expected data flow. |
| `docs/changelog.md` | Initial v3 changelog listing modular editor, themes, suggestion popup, tests, and docs. |
| `docs/testing.md` | Unit and mock-server testing guide; mock server exposes the older suggestion API. |
| `docs/themes.md` | Theme schema and built-in theme guidance for the modular editor. |
| `docs/ui.md` | Detailed UI layout plan for the modular editor DockWidget, suggestion popup, commit log, and settings modal. |
| `docs/plans/roagent-rebuild-integration.md` | Integration plan for the active bridge protocol; mostly matches the current backend and monolithic plugin. |
| `docs/plans/roagent-v3-script-editor.md` | Older implementation plan for the modular v3 editor; says server unchanged and includes features not fully implemented. |
| `docs/audit.md` | This audit document. |

### Backend: `server/`

| Path | Role |
|---|---|
| `server/package.json` | Express backend package manifest; scripts: `start`, `dev`, `watch`; deps: `express`, `cors`. |
| `server/package-lock.json` | npm lockfile for 72 packages. |
| `server/env.example` | Example environment file, but it contains a real-looking OpenRouter key and duplicate `OPENROUTER_API_KEY` entries; should be sanitized. |
| `server/.env` | Local environment file with provider/model/limits/port and a real-looking OpenRouter key; not consumed by `server/src/index.js` unless loaded externally because the code does not import `dotenv`. |
| `server/src/index.js` | Main Express bridge. Implements live Studio sync, event log, pending Pi operations, history storage, script browser/search, console/error buffers, health/status. |
| `server/data/history.json` | Current persistent place-aware history store. Top-level keys: `nextVersionId`, `places`, `scripts`; current sample has 5 places and `nextVersionId: 410`. |
| `server/data/history.json.bak-20260512-212934` | Legacy backup history file with top-level `scripts` only and no `places`; retained after migration. |
| `server/data/history.json.polluted-20260512-212934` | Legacy/polluted history backup with the same legacy shape as the `.bak` file. |
| `server/local-scripts/ServerScriptService.ExampleScript.lua` | Example mirrored local script. |
| `server/local-scripts/StarterPlayerScripts.MyClientScript.lua` | Example mirrored local client script. |
| `server/node_modules/` | Installed third-party dependencies; generated/vendor content, not audited file-by-file. |

### Modular plugin source: `src/`

| Path | Role |
|---|---|
| `src/RoAgent.lua` | Entry point for modular v3 editor; initializes services/UI, creates toolbar, cleans up on `plugin.Unloading`. |
| `src/Services/ConfigService.lua` | Plugin settings persistence with defaults for server URL, polling interval, queue depth, theme, font/tab size, and script type toggles. |
| `src/Services/ThemeService.lua` | Built-in/custom theme registry and active theme management. |
| `src/Services/EventBus.lua` | Pub/sub event dispatcher with `on`, `off`, `emit`, `clear`. |
| `src/Services/StateStore.lua` | Reactive in-memory UI state store backed by EventBus notifications. |
| `src/Services/SyntaxService.lua` | Lua tokenizer for syntax highlighting. |
| `src/Services/DiffService.lua` | Simple line-level LCS diff, formatter, apply, and revert helpers. |
| `src/Services/HistoryService.lua` | In-memory per-script undo history capped at 20 versions; separate from backend persistent history. |
| `src/Services/ScriptWriter.lua` | Writes full source or diff changes back to Script/LocalScript/ModuleScript instances. |
| `src/Services/AgentService.lua` | Older HTTP client for `/health`, `/ping`, and `/suggest`; manages suggestion queue and heartbeat. |
| `src/Services/EditorService.lua` | DockWidget lifecycle and SelectionService-driven script tab management. |
| `src/Services/FileSyncService.lua` | Placeholder only; no real implementation. |
| `src/Services/index.lua` | Service registry scaffold; contains duplicate `ConfigService`/`ThemeService` keys and attempts to reassign a local `Registry` declared as `local`, which is fragile. |
| `src/UI/Components.lua` | UI primitive constructors for Frames, Labels, Buttons, TextBoxes, ScrollFrames, layouts, padding, corners, strokes. |
| `src/UI/EditorWidget.lua` | Custom editor panel UI; renders tabs, toolbar, syntax-highlighted content, status bar; has ordering/duplicate-function issues noted below. |
| `src/UI/SuggestionPopup.lua` | Inline diff suggestion popup; applies/dismisses suggestions and pushes entries to in-memory history. |
| `src/UI/CommitLogPanel.lua` | Collapsible commit log and revert UI for applied suggestions. |
| `src/UI/SettingsPanel.lua` | Settings modal for server URL, polling interval, queue depth, and visual script type toggles. |
| `src/UI/ToolbarDropdown.lua` | Dropdown menu for connect/disconnect, theme, settings, and editor toggle. |
| `src/tests/run.lua` | Lua test runner for modular services. |
| `src/tests/test_EventBus.lua` | Unit tests for EventBus. |
| `src/tests/test_StateStore.lua` | Unit tests for StateStore. |
| `src/tests/test_ThemeService.lua` | Unit tests for ThemeService. |
| `src/tests/test_ScriptWriter.lua` | Unit tests for ScriptWriter. |
| `src/tests/test_DiffService.lua` | Unit tests for DiffService. |
| `src/tests/test_SyntaxService.lua` | Unit tests for SyntaxService. |
| `src/tests/test_HistoryService.lua` | Unit tests for in-memory HistoryService. |

### Tools: `tools/`

| Path | Role |
|---|---|
| `tools/package.json` | Minimal `{ "type": "module" }` so watcher scripts can use ES modules. |
| `tools/file-watcher-git.js` | Current recommended local mirror watcher. Pulls bridge snapshot, mirrors scripts under `~/roagent/local-scripts`, watches local edits, pushes `/push` or `/delete`, polls `/events`, and commits changes to a Git repo. |
| `tools/file-watcher.js` | Older interactive local file watcher. Watches `$HOME/roagent/local-scripts`, pushes changed `.lua` files to `/push`, but deletion handling is incomplete. |
| `tools/file-watcher-daemon.js` | Older daemon watcher. Pushes initial and changed `.lua` files to `/push`; no delete propagation. |
| `tools/mock_agent.py` | Mock server for older modular editor suggestion workflow; implements `/health`, `/ping`, `/suggest`, `/agent`, `/config`, `/info`, `/mock/set`; does not emulate the current bridge protocol. |
| `tools/run_tests.js` | Node-based test harness/stub runner for modular Lua-like services. |

### Local script exports

| Path | Role |
|---|---|
| `local-scripts/` | Large local mirror/export of Roblox place scripts. Not core backend/plugin source. Used as local file mirror input/output by watcher tooling. |
| `backups/` | Timestamped backups of older plugin files. Not source of truth. |

---

## Current Communication Protocol

### Transport

- **Protocol:** HTTP only. No WebSocket implementation was found.
- **Serialization:** JSON request/response bodies for all active backend routes except path/query parameters.
- **Backend bind:** `HOST = process.env.HOST || "127.0.0.1"`, `PORT = Number(process.env.PORT || 8765)`.
- **Plugin target:** hardcoded `SERVER_URL = "http://127.0.0.1:8765"` in monolithic plugins.
- **Modular editor target:** default `serverUrl = "http://127.0.0.1:8765"` in `ConfigService`, editable through SettingsPanel.
- **CORS:** backend uses unrestricted `cors()`.
- **Body size:** Express JSON limit is `32mb`.

### Active bridge flow

1. Plugin starts and after 1 second calls `POST /sync` with a full script snapshot, then `POST /heartbeat`.
2. After 2 seconds plugin starts live event watchers on configured root services.
3. Plugin sends:
   - `POST /sync` full snapshots when manually synced or when heartbeat detects drift.
   - `POST /heartbeat` every 2 seconds.
   - `POST /live` for Studio-created, updated, renamed, and deleted scripts.
   - `GET /pending` every 1 second to pull Pi/local-file operations.
   - `POST /acked` after applying pending operation IDs.
   - `GET /history`, `GET /history/*`, `POST /history/restore`, `POST /history/purge` from the History widget.
   - `GET /status` from the toolbar Status button.
4. Pi/local tools use bridge APIs such as `/scripts`, `/script/*`, `/push`, `/delete`, `/events`, `/browser`, `/grep`.

### Message identity and context

The active plugin includes place metadata on sync/heartbeat/live messages:

```json
{
  "placeName": "Place1",
  "placeId": "134109928056755",
  "gameId": "10143565338",
  "jobId": ""
}
```

Scripts are identified primarily by path, with optional `uniqueId` for rename detection:

```json
{
  "path": "ServerScriptService.MyScript",
  "className": "Script",
  "uniqueId": "...",
  "source": "print('hi')",
  "size": 11
}
```

---

## Implemented API Endpoints and Message Types

All implemented active endpoints are in `server/src/index.js`.

### Liveness and status

#### `GET /health`

- **Input:** none.
- **Output:** `{ ok: true, bridgeOk: true, port }`.
- **Used by:** watchers and modular `AgentService.connect()`.
- **Purpose:** backend liveness only.

#### `POST /heartbeat`

- **Input:** place context plus optional `scriptCount`.
- **Output:** `{ ok: true, status: statusPayload() }`.
- **Used by:** monolithic plugin every 2 seconds.
- **Purpose:** marks Studio/plugin as seen, applies place context, updates `lastHeartbeat`.

#### `GET /status`

- **Input:** none.
- **Output:** `statusPayload()` with `ok`, `bridgeOk`, `studioConnected`, place fields, `scriptCount`, `totalBytes`, `pendingCount`, `eventCount`, `lastEventId`, console/error counts, `lastSync`, `uptime`, `port`, `previousPlaceContext`, `lastPlaceChange`, `sameGameAsPrevious`.
- **Used by:** plugin Status button, watcher startup/pull.

### Studio to backend sync/events

#### `POST /sync`

- **Input:** `{ placeName, placeId, gameId, jobId, scripts: Script[] }`.
- **Script object:** `{ path, className, uniqueId, source, size? }`.
- **Output:** `{ ok: true, count, status }` or `{ ok: true, ignored: true, reason: "missing placeId", status }`.
- **Does:** applies place context, diffs incoming snapshot against current in-memory map, detects creates/updates/deletes/renames, records events and history, replaces `scripts` map with the incoming snapshot.
- **Important behavior:** missing deletes are only recorded when the place identity is stable and unchanged.

#### `POST /live`

- **Input:** `{ placeName, placeId, gameId, jobId, event, path, oldPath?, className, uniqueId?, source?, timestamp?, origin? }`.
- **Allowed `event`:** `created`, `updated`, `renamed`, `deleted`.
- **Output:** `{ ok: true, event, id }` or `400` for missing/unknown data.
- **Does:** applies incremental changes to backend `scripts`, appends event, records history. Rename uses `oldPath` or matching `uniqueId`.

#### `GET /events?since=<id>&limit=<n>`

- **Input query:** `since` default `0`; `limit` default `100`, max `500`.
- **Output:** `{ events, count, latestId, hasMore }`.
- **Event object:** `{ id, timestamp, isoTime, event, path, oldPath?, uniqueId?, placeName, placeId, gameId, className, size, source, origin }`.
- **Used by:** `tools/file-watcher-git.js` to mirror Studio/Pi changes to local files.

### Script registry/read APIs

#### `GET /scripts`

- **Input:** none.
- **Output:** `{ placeName, placeId, gameId, jobId, lastSync, scriptCount, totalBytes, scripts }`.
- **Script list excludes source:** each item has `{ path, className, uniqueId, size }`.

#### `GET /script/*`

- **Input path param:** Roblox script path.
- **Output:** full script object including `source`, or `404 { error: "not found", path }`.

#### `GET /browser?q=&class=&offset=&limit=`

- **Input query:** optional text query, class filter, offset, limit max `200`.
- **Output:** paged list with `{ path, className, size, preview, hasMore }`, plus `total`, `offset`, `limit`, `hasMore`.
- **Does:** script browser/search endpoint over current scripts, with 200-character source previews.

#### `GET /browser/*`

- **Input path param:** script path.
- **Output:** full script object or 404.

#### `GET /search`

- **Input query:** same as `/browser`.
- **Output:** delegated to `/browser` by rewriting `req.url` and calling `app._router.handle`.
- **Fragility:** uses Express internals.

#### `GET /grep?pattern=&path=`

- **Input query:** required regex `pattern`, optional `path` prefix filter.
- **Output:** `{ pattern, results, totalFiles, totalMatches }`, where each result includes matching line numbers/content.
- **Errors:** `400` for missing/bad regex.

### Pi/local-file to Studio operation queue

#### `POST /push`

- **Input upsert:** `{ path, source, className? }`.
- **Input delete compatibility:** `{ path, delete: true, className? }`.
- **Output:** `{ ok: true, action: "created"|"updated"|"delete", pending }`.
- **Does:** updates backend immediately, records event/history with origin `pi`, queues pending op for plugin.
- **Pending upsert shape:** `{ id, createdAt, type: "upsert", path, source, className }`.
- **Pending delete shape:** `{ id, createdAt, type: "delete", path }`.

#### `POST /delete`

- **Input:** `{ path }`.
- **Output:** `{ ok: true, action: "delete", pending }`.
- **Does:** deletes from backend immediately, records event/history with origin `pi`, queues pending delete.

#### `GET /pending`

- **Input:** none; no place/client selector.
- **Output:** `{ ops, pushes, deletes }`.
- **Does:** marks all current pending op IDs as delivered by setting `deliveredPendingIds = new Set(pendingOps.map(...))`, but does not clear them.
- **Compatibility:** returns both modern `ops` and old `pushes`/`deletes`.

#### `POST /acked`

- **Input modern:** `{ ids: number[] }`.
- **Input old:** `{}`.
- **Output:** `{ ok: true, cleared, pendingCount }`.
- **Does:** with IDs, removes only matching pending ops. Without IDs, clears whatever was delivered by last `/pending` call.

### Persistent history APIs

#### `GET /history`

- **Input:** none.
- **Output:** `{ ok: true, placeName, placeId, gameId, scripts }`.
- **Script summary:** `{ path, placeId, gameId, className, current, deleted, versionCount, latestVersionId, latestAction, latestTimestamp, size }`.
- **Scope:** current backend place only, using `currentPlaceKey()`.

#### `GET /history/*`

- **Input path param:** script path.
- **Output:** `{ ok, path, placeId, gameId, className, current, deleted, versions }` or 404.
- **Versions include full source.**

#### `POST /history/restore`

- **Input:** `{ path, versionId }`.
- **Output:** `{ ok: true, action: "restore", path, placeId, gameId, versionId, source, className, pending }` or errors.
- **Does:** finds selected version in current place history, upserts it into backend with origin `history-restore`, queues pending upsert for plugin.
- **Plugin behavior:** monolithic plugin applies the returned source immediately, then acks the returned pending op.

#### `POST /history/purge`

- **Input:** `{ path }`.
- **Output:** `{ ok: true, action: "purge", path, placeId, gameId, deletedCurrent, pending }`.
- **Does:** deletes history entry, removes current script and events for that path, saves history, queues a delete if script was current.

### Console/error APIs

#### `POST /console`

- **Input:** `{ messages: [{ type?, message?, path?, timestamp? }] }`.
- **Output:** `{ ok: true, count }`.
- **Does:** appends to in-memory `consoleBuffer` capped at 500; `type === "error"` also appends to `errorBuffer` capped at 100.
- **Current plugin:** no active code in monolithic plugin sends console messages.

#### `GET /console?since=&type=`

- **Output:** `{ entries, count, total, latestTimestamp }`.

#### `POST /error`

- **Input:** arbitrary error object.
- **Output:** `{ ok: true }`.
- **Does:** appends `{ ...body, type: "script_error", timestamp }` to error buffer.

#### `GET /errors?since=`

- **Output:** `{ errors, count, total }`.

### Older documented/mock endpoints not implemented by real bridge

The current real backend **does not implement** these endpoints even though docs/mock/modular client mention them:

- `GET /ping` — modular `AgentService` heartbeat calls this; real bridge will 404.
- `POST /suggest` — modular editor calls this; real bridge will 404.
- `POST /agent` — documented in README/API and mock, not implemented by real bridge.
- `GET /config`, `POST /config`, `GET /info` — documented/mock only, not implemented by real bridge.
- `POST /mock/set` — mock server only.

---

## How the File Watcher Works

There are three watcher scripts. The current integration plan favors `tools/file-watcher-git.js`.

### `tools/file-watcher-git.js` — current Git mirror watcher

- **Config:**
  - `ROAGENT_LOCAL_DIR` or `$HOME/roagent/local-scripts`.
  - `ROAGENT_BRIDGE_URL` or `http://127.0.0.1:8765`.
  - Debounce `300ms`, event poll `1500ms`, auto-commit `1500ms`.
- **Startup:**
  1. Checks `GET /health`; exits if bridge is down.
  2. Initializes a Git repo in the local mirror directory if missing.
  3. Calls `GET /status`, `GET /scripts`, then `GET /script/<path>` for each script.
  4. Writes mirror files as `${localDir}/${robloxPath}.lua`.
  5. Deletes local `.lua` files not present in bridge snapshot, unless bridge has no live Studio snapshot and existing mirror files exist.
  6. Commits a `Snapshot <iso>` if there are changes.
  7. Baselines file hashes and starts watching.
- **Local edit trigger:** `fs.watch(..., { recursive: true })` plus periodic full scan every 3 seconds.
- **Local edit payload:** `POST /push { path, source, className }`.
- **Local delete payload:** `POST /delete { path }`.
- **Class inference:** path containing `StarterPlayerScripts` or `/client/i` becomes `LocalScript`; `/module/i` becomes `ModuleScript`; otherwise `Script`.
- **Bridge event trigger:** polls `GET /events?since=<lastEventId>&limit=100` every `1500ms`.
- **Bridge event handling:** writes or deletes mirror files, records modification log, commits `Bridge event ...`.
- **Loop prevention:** `applyingBridgeEvent` suppresses pushing writes caused by bridge event mirroring; file hashes are updated after mirror writes.

### `tools/file-watcher.js` — older interactive watcher

- Watches `$HOME/roagent/local-scripts` with `fs.watch` and a 1-second polling fallback.
- Creates sample files if the directory is missing.
- Maintains `pending[]` queue of local changes and flushes every 500ms to `POST /push`.
- Does **not** propagate deletes; deletion code only logs and removes internal state.
- Hardcodes bridge URL; no env override.

### `tools/file-watcher-daemon.js` — older daemon watcher

- Performs initial `scanAndSync()` that pushes every existing local `.lua` file to `/push`.
- Watches `fs.watch` and pushes changed files after a 300ms delay.
- Does not propagate deletes and has no bridge event mirror/pull phase.
- Hardcodes bridge URL; no env override.

---

## How the History System Works

There are **two separate history systems**.

### Backend persistent history: `server/src/index.js` + `server/data/history.json`

- **Storage file:** `HISTORY_FILE = process.env.ROAGENT_HISTORY_FILE || server/data/history.json`.
- **Load behavior:** if absent or invalid, initializes `{ nextVersionId: 1, places: {}, scripts: {} }`.
- **Save behavior:** writes entire JSON file synchronously with `JSON.stringify(..., null, 2)` after history changes.
- **Top-level shape:**

```json
{
  "nextVersionId": 410,
  "places": {
    "134109928056755": {
      "placeId": "134109928056755",
      "gameId": "10143565338",
      "placeName": "Place1",
      "scripts": {
        "StarterPlayer.StarterPlayerScripts.LoadingScreen": {
          "path": "StarterPlayer.StarterPlayerScripts.LoadingScreen",
          "className": "LocalScript",
          "uniqueId": "...",
          "deleted": false,
          "versions": [
            {
              "id": 2,
              "timestamp": 1778610000000,
              "isoTime": "2026-05-13T01:30:27.334Z",
              "action": "created",
              "origin": "studio-sync",
              "path": "StarterPlayer.StarterPlayerScripts.LoadingScreen",
              "oldPath": null,
              "uniqueId": "...",
              "placeId": "134109928056755",
              "gameId": "10143565338",
              "placeName": "Place1",
              "className": "LocalScript",
              "size": 9229,
              "source": "... full source ..."
            }
          ]
        }
      }
    }
  },
  "scripts": {}
}
```

- **Per-place isolation:** history is scoped by `currentPlaceKey()`, which returns `placeId || "unknown"`. Roblox `PlaceId`/`GameId` value `0` is normalized to `"unsaved"`.
- **Legacy compatibility:** old top-level `scripts` are only copied into `places.unknown.scripts` when the current key is `unknown`.
- **Version cap:** each script keeps the last 200 versions.
- **Duplicate suppression:** `recordVersion` avoids writing a new version if latest version has same `source`, same `action`, and same `className`.
- **Rename behavior:** `moveHistoryEntry(oldPath, newPath, uniqueId)` moves/merges history entries and rewrites version paths where needed.
- **Delete behavior:** records a `deleted` version with the last known source, then marks entry `deleted = true`.
- **Restore behavior:** replays a historical full source and queues an upsert pending op.
- **Purge behavior:** deletes the history entry entirely and optionally queues a pending delete.
- **Backups/pollution:** two legacy files remain with `{ nextVersionId, scripts }` and no `places`; current history has 5 place keys including `unsaved` and `unknown`, indicating migration/identity edge cases already occurred.

### Modular plugin in-memory history: `src/Services/HistoryService.lua`

- **Storage:** Lua table only; not persisted.
- **Key:** `scriptPath` string.
- **Entry:** `{ timestamp = os.clock(), label, source, diff }`.
- **Cap:** 20 versions per script.
- **Used by:** `SuggestionPopup` and `CommitLogPanel` in the modular editor path.
- **Isolation:** no place ID/game ID isolation.
- **Relation to backend:** none; this is separate and can diverge from backend persistent history.

---

## Hardcoded Values, Magic Strings, and Config Needing Work for Multi-User/Distributed Use

### Network and process config

- `http://127.0.0.1:8765` hardcoded in all monolithic plugin files.
- `SERVER_URL`, `POLL_INTERVAL = 1`, `HEARTBEAT_INTERVAL = 2`, `SOURCE_DEBOUNCE_SECONDS = 0.5` hardcoded in monolithic plugin.
- Backend defaults to `HOST=127.0.0.1`, `PORT=8765`.
- Watchers hardcode `http://127.0.0.1:8765` except `file-watcher-git.js`, which supports `ROAGENT_BRIDGE_URL`.
- Watchers default to `$HOME/roagent/local-scripts`, not repo-relative or user/session-specific.

### Single global backend state

The bridge uses process-global variables for:

- `scripts`
- `placeName`, `placeId`, `gameId`, `jobId`
- `pendingOps`, `deliveredPendingIds`
- `events`, `consoleBuffer`, `errorBuffer`
- `lastStudioSeenAt`, `lastHeartbeat`, `lastSync`
- `previousPlaceContext`, `lastPlaceChange`

There is no user ID, plugin/client ID, session ID, auth token, or per-place active registry map.

### History and storage

- Single default `server/data/history.json` for all users/places.
- Entire history file rewritten synchronously for each version; no DB, locking, or atomic write temp/rename.
- Place key is only `placeId`; unsaved places collapse to `unsaved` and missing context to `unknown`.
- `jobId` is stored in status but not part of history key.

### Security/secrets

- `server/.env` contains a real-looking OpenRouter key.
- `server/env.example` also contains a real-looking key and duplicate `OPENROUTER_API_KEY` lines.
- Backend does not import `dotenv`, so `.env` is misleading for the actual current bridge.
- No authentication or origin restriction on HTTP endpoints. Any local process can read/write/delete scripts and purge history.
- CORS is unrestricted.

### Magic route/string dependencies

- Plugin expects `ops`, `pushes`, `deletes` from `/pending` and acks `{ ids }`.
- Backend expects live event strings exactly `created`, `updated`, `renamed`, `deleted`.
- Class names are free strings but plugin only creates `Script`, `LocalScript`, `ModuleScript` safely by convention.
- Root services scanned are hardcoded: `Workspace`, `ServerScriptService`, `ServerStorage`, `ReplicatedStorage`, `ReplicatedFirst`, `StarterGui`, `StarterPack`, `StarterPlayer`, `Lighting`, `Teams`, `SoundService`, `Chat`.
- Special path aliases hardcoded for `StarterPlayerScripts` and `StarterCharacterScripts`.

---

## Fragile Areas, Missing Error Handling, and TODOs

### Protocol/API drift

- Docs and modular editor expect `/ping`, `/suggest`, `/agent`, `/config`, `/info`; real bridge does not implement them.
- Modular `AgentService._startHeartbeat()` calls `/ping`, so it will mark a real bridge connection as failed after the first 30-second heartbeat even if `/health` succeeded.
- README quick-start text appears from an older v2/v3 design and does not reflect the current bridge startup output or active endpoint set.

### Single-client pending delivery

- `GET /pending` sets `deliveredPendingIds` globally for all ops.
- Old `{}` ack mode clears the last globally delivered IDs, not client-specific delivered IDs.
- Multiple plugin instances polling simultaneously can cause one instance to ack or clear operations intended for another.
- Pending ops are not scoped to `placeId`; if place A and place B are open, both poll the same queue.

### Single active place model

- Backend has one global `scripts` map and one current `placeId`.
- `applyPlaceContext` resets volatile state when place changes, so multiple open places will overwrite each other's active registry.
- History is place-aware, but the live registry, pending ops, events, status, console, and errors are not fully place/session partitioned.

### Error handling gaps

- Monolithic plugin `httpPost`/`httpGet` return errors but most callers ignore them.
- `syncToServer` and `heartbeat` do not surface failures except toolbar Status warning.
- `pollPending` acks all op IDs even if `upsertScript` or `deleteScript` failed; `upsertScript` can fail if path root/class is invalid.
- Backend `saveHistory()` logs but otherwise ignores write failures; clients still receive success from operations that may not be persisted.
- No validation of `className` on `/push`; invalid class names can produce plugin-side failures.
- No request timeout handling in watchers' `fetch` calls.
- `POST /console` and `/error` accept arbitrary payloads without size/shape validation beyond Express's global JSON limit.

### Data consistency and durability

- In-memory `scripts`, `pendingOps`, `events`, console, and errors are lost on backend restart.
- Pending operations are lost on backend restart before Studio applies them.
- History writes are synchronous whole-file writes and not atomic; interruption could corrupt the JSON file.
- `historyStore.nextVersionId` is global across all places; okay for uniqueness but not partitioned.
- `events` are capped and volatile; watcher Git mirror can miss events after restart or cap overflow.

### File watcher fragility

- `fs.watch(..., { recursive: true })` is platform-dependent and can behave differently on Linux/macOS/Windows.
- Older watchers push local files on startup, risking stale overwrite; `file-watcher-git.js` avoids this better by pulling first.
- File-to-Roblox path mapping uses dots and path separators; Roblox instance names containing dots cannot be round-tripped safely.
- Class inference from filename/path is heuristic.
- `file-watcher.js` and daemon do not propagate deletes.

### Lua/plugin fragility

- Monolithic plugin path parsing uses dot-separated paths, so instance names containing `.` are ambiguous.
- `resolvePath(path, true)` creates `Folder` instances for missing intermediate path segments, which can create unintended hierarchy.
- Suppression is path-based and delayed 1 second; renames or rapid operations can leak echo events.
- `getUniqueId` falls back to setting `RoAgentUniqueId` attribute, but if attributes cannot be set the generated ID is not persisted.
- History UI loads full version sources into a TextBox; large histories/sources can be slow.
- Plugin scans all scripts every heartbeat (2 seconds), which can be expensive for large places.

### Modular editor code issues

- `src/UI/EditorWidget.lua` calls `renderEditorContent` before its local definition in `themeAll`; in Lua, later `local function` declarations are not visible to earlier local functions unless forward-declared. This can cause nil/global lookup issues.
- `src/UI/EditorWidget.lua` has a duplicated stray block after `clearContainer`, suggesting a copy/paste artifact.
- `src/UI/EditorWidget.lua` emits `suggestionReceived` from `onSuggestionReceived` while also subscribing to `suggestionReceived`, risking recursive re-emission.
- `src/Services/index.lua` duplicates keys and later assigns `Registry = {}` despite `Registry` being a local table intended as registry; this breaks the original registry reference.
- `FileSyncService.lua` is a placeholder.
- SettingsPanel script type toggles only change button colors; they are not persisted or wired to actual filtering.
- `ThemeService.validateTheme` only checks presence, not that values are `Color3`, despite docs saying it validates Color3 values.

### TODOs / planned but absent features

No literal `TODO`/`FIXME` comments were found in the core grep results, but roadmap/docs identify missing features:

- Bidirectional diff / dry-run before applying.
- Batch operations.
- Search-and-replace write API.
- Dependency graph.
- Templates.
- Team sync/conflict handling.
- Persistent service lifecycle support.
- Game state inspection and selection sync.

---

## Gaps Before Production

### If a second user tries to use the system

1. **No authentication or tenant isolation.** Any user/process that can reach the port can read, write, delete, restore, and purge all scripts/history.
2. **Single shared history file.** Histories from all users go into one `history.json` unless each user manually overrides `ROAGENT_HISTORY_FILE`.
3. **Single active place and registry.** A second user or Studio instance changes global `placeId` and resets `scripts`, affecting the first user.
4. **Pending operation collisions.** `/pending` and `/acked` are global; one user's plugin can receive or clear another user's writes.
5. **Event stream collisions.** `/events` mixes all origins/places and is volatile; no per-user cursor.
6. **No conflict detection.** Concurrent edits to the same script are last-writer-wins with no version precondition or diff/merge.
7. **Shared local mirror path.** Watchers default to `$HOME/roagent/local-scripts`, so separate users/sessions on the same machine collide.
8. **Secrets in repo-local env files.** The current `.env`/`env.example` pattern is unsafe for distribution.

### If the backend runs as a persistent background service

1. **Volatile runtime state disappears on restart.** Current scripts, pending operations, event cursors, console, and errors are memory-only.
2. **No service supervisor integration.** `package.json` only provides `npm start`/`dev`; no systemd/launchd/Windows service config, PID handling, logs, health restart policy, or graceful shutdown persistence.
3. **No durable operation queue.** If Pi queues `/push` and backend restarts before Studio polls, the op is lost.
4. **History writes are non-atomic.** Long-running service plus whole-file rewrites risks JSON corruption; no compaction/backup rotation.
5. **No log rotation/structured logs.** Console output only; no persistent diagnostic logs for service operation.
6. **Port conflicts are fatal.** Server logs listen errors and sets `process.exitCode`, but no alternate port discovery or user-facing recovery.
7. **`.env` is not actually loaded.** Persistent deployment likely expects dotenv, but `server/src/index.js` only reads process env already supplied by the shell/service manager.
8. **No readiness distinction.** `/health` returns bridge liveness even if no Studio plugin is connected; service managers/users may misinterpret it as full readiness.

### If the system needs to handle 3+ Roblox places open simultaneously

1. **Only one live `scripts` map.** The latest place to heartbeat/sync owns the active registry; other places are overwritten/reset.
2. **One `lastStudioSeenAt`.** `studioConnected` only represents any recent plugin, not which places are live.
3. **One pending queue.** A `/push` for place A can be applied by place B because pending ops are not keyed by place/client.
4. **One `/history` current context.** History APIs read from the current global place; a UI in place A can see place B after B heartbeats.
5. **Place changes clear volatile state.** `resetVolatilePlaceState` clears scripts and pending ops on place ID change, destructive for concurrent places.
6. **Event stream not partitioned.** Watchers and Pi tools cannot reliably subscribe to only one place without client-side filtering, and current `/events` has no place query.
7. **Path identity is not globally unique.** `ServerScriptService.Main` can exist in every place; current live APIs need place-scoped keys.
8. **Plugin instances have no client IDs.** Backend cannot route operation acknowledgements, health, or status to a specific Studio window.

### Production readiness recommendations

Before production/multi-user use, RoAgent should add:

- A stable **client/session ID** generated by each plugin instance and included in every request.
- A durable **place/session registry**: `places[placeKey].sessions[clientId].scripts`, not one global `scripts` map.
- **Place-scoped pending queues** and `/pending?placeId=&clientId=` with per-client delivery/ack tracking.
- A proper persistent store such as SQLite for history, events, pending ops, console/error logs, and script snapshots.
- Atomic writes or DB transactions for history.
- Auth token/shared secret at minimum for local HTTP, plus CORS/origin restrictions if exposed beyond loopback.
- Endpoint contract cleanup: either implement `/ping`/`/suggest`/`/agent`/`/config` or remove/update docs and modular client code.
- A background-service deployment story: config file/env loading, logs, supervisor unit, graceful shutdown, restart recovery.
- Conflict detection: include base version/event IDs on writes and reject or merge stale writes.
- Path encoding that supports Roblox names containing dots, or use stable instance IDs plus display paths.
