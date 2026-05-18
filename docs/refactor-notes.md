# RoAgent Backend Refactor Notes

**Date:** 2026-05-15  
**Scope:** WebSocket daemon refactor implementing `docs/protocol.md` and `shared/protocol.ts`.

## Summary

The backend was rewritten from a single HTTP/Express JavaScript bridge into a typed TypeScript WebSocket daemon. The daemon now validates the protocol envelope, routes requests through per-domain handlers, isolates state by `placeId`, persists script registries and history under the configured data directory, uses structured rotating logs, and verifies behavior with a Vitest WebSocket smoke test.

## Audit Gap Resolution Matrix

### Second-user / multi-user gaps

| Audit issue | Status | Files changed | Resolution |
|---|---|---|---|
| No authentication or tenant isolation | Fixed | `server/src/index.ts`, `server/src/config.ts`, `server/src/state/placeStore.ts` | WebSocket upgrades are accepted only from `127.0.0.1` and require `PLUGIN_AUTH_TOKEN` or a generated token stored in the data directory. Tenant/runtime data is keyed by `placeId`. |
| Single shared history file | Fixed | `server/src/history/historyStore.ts` | Replaced `server/data/history.json` runtime use with per-place JSONL files under `${dataDirectory}/history/<placeId>/<encodedScriptPath>.jsonl`. |
| Single active place and registry | Fixed | `server/src/state/placeStore.ts` | Replaced one global script map with `PlaceStore`, a place-keyed registry persisted under `${dataDirectory}/places/<placeId>/scripts.json`. |
| Pending operation collisions | Fixed | `server/src/protocol/router.ts`, `server/src/handlers/scriptHandlers.ts` | Removed HTTP `/pending`/`/acked` model from the new daemon. WebSocket requests are direct request/response interactions correlated by `requestId`; watch pushes are place-scoped. |
| Event stream collisions | Fixed | `server/src/watch/watchService.ts` | Watch subscribers are stored by `placeId`; `watch:event` is broadcast only to subscribers for the same place. |
| No conflict detection | Fixed | `server/src/state/placeStore.ts`, `server/src/handlers/scriptHandlers.ts` | `script:write`, `script:delete`, and `script:rename` support `expectedVersionId` and return typed `GIT_CONFLICT` on mismatch. |
| Shared local mirror path | Fixed | `server/src/watch/watchService.ts`, `server/src/state/placeStore.ts` | Each place watches and stores its own directory under `${dataDirectory}/places/<placeId>`, eliminating a shared `$HOME/roagent/local-scripts` runtime path. Legacy watcher scripts remain but are no longer daemon internals. |
| Secrets in repo-local env files | Fixed | `server/.env`, `server/env.example` | Replaced real-looking OpenRouter keys with placeholder daemon config and auth-token examples. |

### Persistent background service gaps

| Audit issue | Status | Files changed | Resolution |
|---|---|---|---|
| Volatile runtime state disappears on restart | Fixed / scoped | `server/src/state/placeStore.ts`, `server/src/history/historyStore.ts` | Script registry and history now persist under `${dataDirectory}`. Old volatile pending/events/console buffers are removed from the protocol. Watch subscriptions remain connection-scoped by design. |
| No service supervisor integration | Partially fixed; OS packaging deferred to Prompt 5 | `server/package.json`, `server/src/index.ts`, `server/src/logger.ts` | Added `npm start`, graceful SIGINT/SIGTERM shutdown, structured logs, and clear startup errors. systemd/launchd/Windows service unit files are deferred to Prompt 5: service packaging. |
| No durable operation queue | Fixed by protocol change | `server/src/protocol/router.ts`, `server/src/handlers/scriptHandlers.ts` | The new WebSocket protocol uses immediate request/response operations instead of a daemon-side pending queue. There is no cross-client global queue to lose or collide. |
| History writes are non-atomic | Fixed for registries; history append is crash-tolerant | `server/src/state/placeStore.ts`, `server/src/history/historyStore.ts` | Script registries use temp-file + rename atomic writes. History uses append-only JSONL, and readers skip corrupted/partial lines without crashing. |
| No log rotation/structured logs | Fixed | `server/src/logger.ts` | Added pino structured logging to `${dataDirectory}/logs/daemon.log` with 10MB rotation and 3 retained files. |
| Port conflicts are fatal | Fixed with clearer operation | `server/src/config.ts`, `server/src/index.ts`, `config/default.json` | Port is validated and configurable through `PLUGIN_PORT`; listen failures produce a clear startup error and structured log entry. Automatic port discovery is intentionally not used because plugin configuration must target a stable port. |
| `.env` is not actually loaded | Fixed by explicit config model | `server/src/config.ts`, `config/default.json`, `server/env.example` | Runtime config is loaded once from `config/default.json` and environment variables. `.env` is now only an example/local override file for process managers; the daemon does not read arbitrary inline env outside `config.ts`. |
| No readiness distinction | Fixed | `server/src/handlers/daemonHandlers.ts` | Added `daemon:health` response containing protocol version, uptime, active connections, active places, storage, git, agent, and license status. |

### 3+ simultaneous Roblox places gaps

| Audit issue | Status | Files changed | Resolution |
|---|---|---|---|
| Only one live `scripts` map | Fixed | `server/src/state/placeStore.ts` | Registries are loaded and persisted per `placeId`. |
| One `lastStudioSeenAt` | Fixed by removal/replacement | `server/src/handlers/daemonHandlers.ts`, `server/src/watch/watchService.ts` | The old single Studio heartbeat model was removed. Health now reports active places and connections; future plugin heartbeat can be added place-scoped. |
| One pending queue | Fixed | `server/src/protocol/router.ts` | Removed global pending queue; all operations are request/response and place-scoped by envelope `placeId`. |
| One `/history` current context | Fixed | `server/src/handlers/historyHandlers.ts`, `server/src/history/historyStore.ts` | History handlers always read from the envelope `placeId`. |
| Place changes clear volatile state | Fixed | `server/src/state/placeStore.ts` | No global current place exists, so one place cannot reset another. |
| Event stream not partitioned | Fixed | `server/src/watch/watchService.ts` | Subscriptions and `watch:event` pushes are keyed by `placeId`. |
| Path identity is not globally unique | Fixed | `server/src/state/placeStore.ts`, `server/src/history/historyStore.ts` | Script paths are unique only within a `placeId`; all registry/history paths are nested under place directories. |
| Plugin instances have no client IDs | Addressed via WebSocket session; durable client IDs deferred to Prompt 3 plugin update | `server/src/index.ts`, `server/src/watch/watchService.ts` | Each WebSocket connection acts as a session for response routing and subscriptions. A persistent plugin-generated client ID requires plugin-side protocol implementation and is deferred to Prompt 3: Roblox plugin WebSocket client. |

### Production readiness recommendations

| Recommendation | Status | Files changed | Resolution |
|---|---|---|---|
| Stable client/session ID | Partially fixed; persistent plugin ID deferred to Prompt 3 | `server/src/index.ts`, `server/src/watch/watchService.ts` | WebSocket sessions are tracked per connection. Persistent client IDs will be added when the Roblox plugin implements this protocol. |
| Durable place/session registry | Fixed for place registry; session registry runtime-scoped | `server/src/state/placeStore.ts`, `server/src/index.ts` | Place registries persist under `${dataDirectory}/places`. Session subscriptions are intentionally runtime-only. |
| Place-scoped pending queues | Fixed by removing pending queues | `server/src/protocol/router.ts` | New protocol uses correlated WebSocket request/response instead of global polling queues. |
| Proper persistent store for history/events/pending/console/script snapshots | Partially fixed | `server/src/state/placeStore.ts`, `server/src/history/historyStore.ts`, `server/src/watch/watchService.ts` | Script snapshots and history are persistent. Watch events are live pushes, not a durable event log. Console/error telemetry is outside protocol v1 and deferred to a future telemetry prompt. |
| Atomic writes or DB transactions | Fixed for registry; JSONL for history | `server/src/state/placeStore.ts`, `server/src/history/historyStore.ts` | Registry uses atomic rename. History is append-only JSONL with corrupt-line tolerance. |
| Auth token/shared secret and loopback restriction | Fixed | `server/src/index.ts`, `server/src/config.ts` | WebSocket upgrades require loopback `127.0.0.1` plus auth token. |
| Endpoint contract cleanup | Fixed | `docs/protocol.md`, `shared/protocol.ts`, `server/src/protocol/router.ts` | New daemon implements the protocol message types instead of old HTTP route drift. Old `server/src/index.js` was removed. |
| Background-service deployment story | Partially fixed; supervisor files deferred to Prompt 5 | `server/package.json`, `server/src/index.ts`, `server/src/logger.ts`, `server/src/config.ts` | Added typed config, startup validation, graceful shutdown, and rotating logs. OS service definitions are deferred. |
| Conflict detection | Fixed | `server/src/state/placeStore.ts` | `expectedVersionId` is enforced where the protocol supports it. |
| Path encoding supporting dots/stable instance IDs | Partially fixed; full stable IDs deferred to Prompt 3 | `server/src/history/historyStore.ts`, `server/src/state/placeStore.ts` | Disk paths are `encodeURIComponent`-encoded to prevent traversal/collisions. The protocol still uses display `ScriptPath`; stable Roblox instance IDs require plugin support and are deferred to Prompt 3. |

## Structural Changes Made

- Replaced old single-file Express bridge with a TypeScript WebSocket daemon.
- Added strict protocol envelope validation and typed error envelopes.
- Split handlers by protocol domain.
- Added typed config loaded once at startup.
- Added structured pino logging with rotation.
- Added place-scoped persistent script registries.
- Added JSONL per-place/per-script history storage.
- Added place-scoped watch subscriptions and broadcasts.
- Added local token authentication and loopback-only WebSocket upgrades.
- Added Vitest smoke coverage for WebSocket script CRUD and watch subscription flow.
- Sanitized repo-local env files to remove real-looking API keys.

## New / Changed Folder Structure

| Path | Role |
|---|---|
| `config/default.json` | Default daemon config: port, data directory, log level. |
| `package.json` | Root package marker with `type: module` so shared TypeScript exports work consistently. |
| `shared/protocol.ts` | Canonical protocol constants, enums, interfaces, and unions. |
| `server/package.json` | TypeScript daemon package scripts and dependencies. |
| `server/tsconfig.json` | Strict TypeScript config for daemon and shared protocol types. |
| `server/vitest.config.ts` | Vitest config including `/tests/smoke.ts`. |
| `server/src/index.ts` | WebSocket daemon entry point, loopback/auth upgrade checks, message lifecycle. |
| `server/src/config.ts` | Sole config/env loader and startup validator. |
| `server/src/logger.ts` | Pino logger and rotating file stream with sanitization. |
| `server/src/errors.ts` | Typed `AppError` and error normalization. |
| `server/src/types.ts` | Shared handler context and handler signature. |
| `server/src/protocol/validate.ts` | Base envelope parser/validator. |
| `server/src/protocol/respond.ts` | Success/error envelope helpers. |
| `server/src/protocol/router.ts` | Message type router and handler timing/error logging. |
| `server/src/state/placeStore.ts` | Place-scoped script registry persistence and optimistic version checks. |
| `server/src/history/historyStore.ts` | Per-place/per-script JSONL history append/read with corrupt-line tolerance. |
| `server/src/watch/watchService.ts` | Place-scoped file watching, subscriptions, and `watch:event` push delivery. |
| `server/src/handlers/scriptHandlers.ts` | `script:*` protocol handlers. |
| `server/src/handlers/historyHandlers.ts` | `history:*` protocol handlers. |
| `server/src/handlers/watchHandlers.ts` | `watch:*` protocol handlers. |
| `server/src/handlers/gitHandlers.ts` | `git:*` protocol handlers; `git:restore` materialization deferred to Prompt 4 Git integration. |
| `server/src/handlers/agentHandlers.ts` | `agent:*` protocol handlers; real terminal launch deferred to Prompt 6 Agent terminal integration. |
| `server/src/handlers/licenseHandlers.ts` | Local license activation/status handlers and license error responses. |
| `server/src/handlers/daemonHandlers.ts` | `daemon:health` handler. |
| `tests/smoke.ts` | Vitest smoke test that starts daemon, connects WebSocket, subscribes, does script CRUD, unsubscribes. |
| `server/.env` | Sanitized local daemon override example; no secrets. |
| `server/env.example` | Sanitized environment example. |

## Verification Performed

```bash
cd /home/olivi/roagent/server
npm install
npm run typecheck
PLUGIN_PORT=<free-port> PLUGIN_DATA_DIR=/tmp/roagent-manual-start-<port> PLUGIN_LOG_LEVEL=debug PLUGIN_AUTH_TOKEN=manual-token npm start
npm run test:smoke
```

Results:

- TypeScript strict typecheck passed.
- Daemon started successfully on a free loopback port (`ws://127.0.0.1:<free-port>`) with no stderr output.
- Vitest smoke test passed: subscribe, create, write, read, delete, unsubscribe.
