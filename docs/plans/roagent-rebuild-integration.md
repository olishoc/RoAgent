# RoAgent Rebuild Integration Plan

## Goals

- Pi can list, read, write, create, and delete Roblox Studio scripts live.
- Studio-originated creates, edits, renames, and deletes are visible to Pi without manual resync.
- Pi-originated writes/deletes are applied by the Studio plugin and acknowledged safely.
- WSL shortcuts make bridge/plugin connection state obvious.
- Git history is available through an optional local mirror without making local files the primary sync source.

## Source of truth

The Node bridge at `~/roagent/server/src/index.js` is the runtime source of truth.

- Roblox Studio plugin: scans Studio, applies pending operations, sends heartbeat and events.
- Node bridge: stores current script registry, event log, pending Pi→Studio ops, status, and optional console/error buffers.
- Pi extension: exposes `roblox_list`, `roblox_read`, `roblox_write`, and `roblox_delete`, injects capped live context, and displays recent events.
- Local Git mirror: diagnostic/history layer only. It mirrors bridge state and can push deliberate local edits, but it must not overwrite Studio on startup.

## Bridge protocol

- `GET /health` — bridge liveness.
- `POST /heartbeat {placeName, scriptCount}` — Studio plugin liveness.
- `GET /status` — bridge + Studio/plugin status.
- `POST /sync {scripts, placeName}` — full Studio snapshot; bridge diffs against old registry and logs created/updated/deleted events.
- `POST /live {event,path,className,source,timestamp,origin}` — incremental Studio event.
- `GET /events?since=<id>&limit=<n>` — durable event log, including deletes.
- `GET /scripts` and `GET /script/*` — Pi read APIs.
- `POST /push` — Pi/file upsert or backward-compatible `{delete:true}` delete.
- `POST /delete` — explicit delete API.
- `GET /pending` — pending operations with ids; does not clear.
- `POST /acked {ids:[...]}` — clear acknowledged pending ops; `{}` keeps backward-compatible clear-delivered behavior.

## Deletion and rename handling

- Studio delete: plugin sends `/live` deleted before object is gone from path context.
- Pi delete: bridge queues a pending delete id; plugin destroys the script, then acknowledges id.
- Rename: plugin treats as deleted old path + created new path, because paths are identity keys.

## Loop prevention

- Plugin suppresses local live echoes while applying Pi pending ops.
- Bridge still records Pi-originated write/delete events so Pi UI and Git mirror see a complete timeline.

## Git/debug mirror

- `roblox-watch` starts bridge if needed, pulls bridge registry to `~/roagent/local-scripts`, commits a snapshot, then watches changes.
- Startup never pushes stale local files to Studio.
- File edits after baseline push to bridge.
- File deletes after baseline post deletes and `git rm`.
- Bridge events update the mirror and create Git history for Studio/Pi changes.

## Shortcuts

- `roblox`: ensure bridge is running, check Windows Roblox Studio process via `powershell.exe`, show bridge status and plugin heartbeat freshness.
- `roblox-watch`: ensure bridge is running and run Git/debug watcher.
- `roblox-stop`: stop only the bridge process that owns port 8765 or saved pidfile, not a broad `pkill`.

## Safety choices

- No global `print`/`warn` override in the plugin. Console capture can be reintroduced later via `LogService.MessageOut` behind a config flag.
- `PORT` environment variable supported for test bridge (`PORT=18765`).
- Local Git mirror is optional and subordinate to bridge/Studio state.
