# RoAgent WebSocket Protocol v1

**Status:** Frozen for implementation planning  
**Protocol version:** `"1"`  
**Transport:** WebSocket JSON text frames  
**Scope:** Official communication contract between the Roblox Studio plugin and the local RoAgent backend daemon.

This document defines message shapes only. It does **not** define handler implementation details.

---

## 1. Transport and Envelope Rules

Clients open a WebSocket connection to the daemon and exchange UTF-8 JSON text frames.

Every message uses the same base envelope:

```json
{
  "version": "1",
  "type": "<message_type>",
  "requestId": "<uuid>",
  "placeId": "<roblox_place_id>",
  "payload": {}
}
```

### Required envelope fields

| Field | Type | Rules |
|---|---|---|
| `version` | string | Must be `"1"` for this protocol version. Unknown versions return `error` with `INVALID_PAYLOAD`. |
| `type` | string | Discriminates the message. Request types use names like `script:read`. Success responses use `<request_type>:response`. Generic errors use `error`. |
| `requestId` | UUID string | Client-generated for requests. Server responses preserve it. Server pushes use a server-generated UUID. |
| `placeId` | string | Roblox place id as a string. For daemon/license/global messages before a place is known, use `"__global__"`. |
| `payload` | object | Type-specific payload. Empty requests use `{}`. |

### Full-shape convention

Per-operation sections below document the payload object for readability. The full frame always wraps that payload in the mandatory envelope:

```json
{
  "version": "1",
  "type": "<operation>",
  "requestId": "<uuid>",
  "placeId": "<roblox_place_id>",
  "payload": { "...": "documented request payload" }
}
```

Successful responses use the same envelope with `type: "<operation>:response"` and the documented response payload:

```json
{
  "version": "1",
  "type": "<operation>:response",
  "requestId": "<same request id>",
  "placeId": "<same place id>",
  "payload": { "...": "documented response payload" }
}
```

### Correlation rules

- Every client request receives exactly one terminal response: either `<type>:response`, `license:error`, or generic `error`.
- Response envelopes preserve `version`, `requestId`, and `placeId` from the request.
- Server push messages are unsolicited and use server-generated `requestId` values.
- Clients must ignore unknown fields for forward-compatible minor additions.
- Clients must treat unknown `type` values as unsupported and may close or report them.

### Server push messages

The daemon can push these messages without a matching client request:

- `watch:event`
- `agent:action`
- `license:warning`
- `license:revoked`

---

## 2. Common Types

### Scalar conventions

| Name | Type | Description |
|---|---|---|
| `Uuid` | string | RFC 4122 UUID. |
| `IsoTimestamp` | string | ISO-8601 timestamp, e.g. `2026-05-15T19:13:38.833Z`. |
| `PlaceId` | string | Roblox place id as a string; `"__global__"` for global daemon/license messages. |
| `ScriptPath` | string | Dot-separated Roblox instance path, e.g. `ServerScriptService.Main`. |
| `ScriptClassName` | string | One of `Script`, `LocalScript`, `ModuleScript`. |
| `VersionId` | string | Stable history version id. |
| `CommitRef` | string | Git commit hash, tag, branch, or other ref accepted by git. |

### Script record

```json
{
  "path": "ServerScriptService.Main",
  "className": "Script",
  "source": "print('hello')",
  "size": 14,
  "versionId": "42",
  "updatedAt": "2026-05-15T19:13:38.833Z",
  "deleted": false
}
```

### History version

```json
{
  "versionId": "42",
  "path": "ServerScriptService.Main",
  "className": "Script",
  "source": "print('hello')",
  "action": "updated",
  "timestamp": "2026-05-15T19:13:38.833Z",
  "summary": "Updated script source",
  "actor": "studio-plugin",
  "commitHash": "abc123"
}
```

### Error codes

The TypeScript enum is canonical:

```ts
export enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  GIT_CONFLICT = "GIT_CONFLICT",
  AGENT_UNAVAILABLE = "AGENT_UNAVAILABLE",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  LICENSE_INVALID = "LICENSE_INVALID",
  LICENSE_EXPIRED = "LICENSE_EXPIRED",
  LICENSE_ALREADY_ACTIVATED = "LICENSE_ALREADY_ACTIVATED",
}
```

### Generic error envelope

`error` is the generic server-side error response envelope. It uses the same `requestId` as the failed request.

```json
{
  "version": "1",
  "type": "error",
  "requestId": "<same request id>",
  "placeId": "134109928056755",
  "payload": {
    "code": "NOT_FOUND",
    "message": "Script not found",
    "retryable": false,
    "details": {
      "path": "ServerScriptService.Missing"
    }
  }
}
```

---

## 3. Script Operations

### 3.1 `script:read`

Read a script's source by path.

**Direction:** client → server

Request:

```json
{
  "version": "1",
  "type": "script:read",
  "requestId": "uuid",
  "placeId": "134109928056755",
  "payload": {
    "path": "ServerScriptService.Main"
  }
}
```

Response type: `script:read:response`

```json
{
  "script": {
    "path": "ServerScriptService.Main",
    "className": "Script",
    "source": "print('hello')",
    "size": 14,
    "versionId": "42",
    "updatedAt": "2026-05-15T19:13:38.833Z",
    "deleted": false
  }
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 3.2 `script:write`

Write or overwrite an existing script's source.

**Direction:** client → server

Request:

```json
{
  "path": "ServerScriptService.Main",
  "source": "print('new source')",
  "className": "Script",
  "expectedVersionId": "42",
  "summary": "Replace Main source"
}
```

Fields:

| Field | Required | Description |
|---|---:|---|
| `path` | yes | Existing script path. |
| `source` | yes | Full replacement source. |
| `className` | no | If omitted, preserves existing class. |
| `expectedVersionId` | no | Optional optimistic concurrency guard. |
| `summary` | no | Human-readable history summary. |

Response type: `script:write:response`

```json
{
  "script": { "path": "ServerScriptService.Main", "className": "Script", "source": "print('new source')", "size": 19, "versionId": "43", "updatedAt": "2026-05-15T19:20:00.000Z", "deleted": false },
  "historyVersion": { "versionId": "43", "path": "ServerScriptService.Main", "className": "Script", "source": "print('new source')", "action": "updated", "timestamp": "2026-05-15T19:20:00.000Z", "summary": "Replace Main source", "actor": "studio-plugin" }
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 3.3 `script:create`

Create a new script at a path.

**Direction:** client → server

Request:

```json
{
  "path": "ServerScriptService.NewScript",
  "className": "Script",
  "source": "print('created')",
  "createParents": true,
  "overwrite": false,
  "summary": "Create NewScript"
}
```

Response type: `script:create:response`

```json
{
  "script": { "path": "ServerScriptService.NewScript", "className": "Script", "source": "print('created')", "size": 16, "versionId": "44", "updatedAt": "2026-05-15T19:21:00.000Z", "deleted": false },
  "historyVersion": { "versionId": "44", "path": "ServerScriptService.NewScript", "className": "Script", "source": "print('created')", "action": "created", "timestamp": "2026-05-15T19:21:00.000Z", "summary": "Create NewScript", "actor": "studio-plugin" }
}
```

Common errors: `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 3.4 `script:delete`

Delete a script while preserving history.

**Direction:** client → server

Request:

```json
{
  "path": "ServerScriptService.OldScript",
  "expectedVersionId": "44",
  "summary": "Remove obsolete script"
}
```

Response type: `script:delete:response`

```json
{
  "path": "ServerScriptService.OldScript",
  "deleted": true,
  "historyVersion": { "versionId": "45", "path": "ServerScriptService.OldScript", "className": "Script", "source": "print('last known source')", "action": "deleted", "timestamp": "2026-05-15T19:22:00.000Z", "summary": "Remove obsolete script", "actor": "studio-plugin" }
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 3.5 `script:rename`

Rename or move a script.

**Direction:** client → server

Request:

```json
{
  "fromPath": "ServerScriptService.OldName",
  "toPath": "ServerScriptService.Folder.NewName",
  "createParents": true,
  "expectedVersionId": "45",
  "summary": "Move script into Folder"
}
```

Response type: `script:rename:response`

```json
{
  "fromPath": "ServerScriptService.OldName",
  "toPath": "ServerScriptService.Folder.NewName",
  "script": { "path": "ServerScriptService.Folder.NewName", "className": "Script", "source": "print('source')", "size": 15, "versionId": "46", "updatedAt": "2026-05-15T19:23:00.000Z", "deleted": false },
  "historyVersion": { "versionId": "46", "path": "ServerScriptService.Folder.NewName", "className": "Script", "source": "print('source')", "action": "renamed", "timestamp": "2026-05-15T19:23:00.000Z", "summary": "Move script into Folder", "actor": "studio-plugin" }
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 3.6 `script:restore`

Restore a script to a specific historical version.

**Direction:** client → server

Request:

```json
{
  "path": "ServerScriptService.Main",
  "versionId": "42",
  "summary": "Restore stable version"
}
```

Response type: `script:restore:response`

```json
{
  "script": { "path": "ServerScriptService.Main", "className": "Script", "source": "print('old source')", "size": 19, "versionId": "47", "updatedAt": "2026-05-15T19:24:00.000Z", "deleted": false },
  "restoredFromVersionId": "42",
  "historyVersion": { "versionId": "47", "path": "ServerScriptService.Main", "className": "Script", "source": "print('old source')", "action": "restored", "timestamp": "2026-05-15T19:24:00.000Z", "summary": "Restore stable version", "actor": "studio-plugin" }
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 3.7 `script:list`

List scripts in a place.

**Direction:** client → server

Request:

```json
{
  "includeSource": false,
  "includeDeleted": false
}
```

Response type: `script:list:response`

```json
{
  "scripts": [
    { "path": "ServerScriptService.Main", "className": "Script", "size": 14, "versionId": "42", "updatedAt": "2026-05-15T19:13:38.833Z", "deleted": false }
  ],
  "count": 1,
  "totalBytes": 14
}
```

If `includeSource` is true, each script summary includes `source`.

Common errors: `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

---

## 4. History Operations

### 4.1 `history:get`

Get the full modification history for one script.

**Direction:** client → server

Request:

```json
{
  "path": "ServerScriptService.Main",
  "includeSource": true
}
```

Response type: `history:get:response`

```json
{
  "path": "ServerScriptService.Main",
  "versions": [
    { "versionId": "42", "path": "ServerScriptService.Main", "className": "Script", "source": "print('hello')", "action": "created", "timestamp": "2026-05-15T19:13:38.833Z", "summary": "Initial create", "actor": "studio-plugin" }
  ]
}
```

If `includeSource` is false, version objects may omit `source`.

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 4.2 `history:getDeleted`

Get deleted scripts with their last known content.

**Direction:** client → server

Request:

```json
{
  "includeSource": true
}
```

Response type: `history:getDeleted:response`

```json
{
  "scripts": [
    {
      "path": "ServerScriptService.DeletedScript",
      "className": "Script",
      "deletedAt": "2026-05-15T19:22:00.000Z",
      "lastVersionId": "45",
      "lastKnownSource": "print('last known source')",
      "size": 26
    }
  ]
}
```

If `includeSource` is false, `lastKnownSource` may be omitted.

Common errors: `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

---

## 5. Watch Operations

### 5.1 `watch:subscribe`

Subscribe to real-time changes for a place.

**Direction:** client → server

Request:

```json
{
  "sinceVersionId": "42",
  "includeSource": true
}
```

Response type: `watch:subscribe:response`

```json
{
  "subscribed": true,
  "subscriptionId": "uuid",
  "placeId": "134109928056755"
}
```

After subscription, the server may push `watch:event` messages for the same `placeId`.

Common errors: `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 5.2 `watch:unsubscribe`

Unsubscribe from real-time changes.

**Direction:** client → server

Request:

```json
{
  "subscriptionId": "uuid"
}
```

Response type: `watch:unsubscribe:response`

```json
{
  "subscribed": false,
  "subscriptionId": "uuid"
}
```

Common errors: `NOT_FOUND`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 5.3 `watch:event`

Real-time place change push.

**Direction:** server → subscribed clients

Push payload:

```json
{
  "eventId": "uuid",
  "kind": "updated",
  "path": "ServerScriptService.Main",
  "oldPath": null,
  "script": { "path": "ServerScriptService.Main", "className": "Script", "source": "print('changed')", "size": 16, "versionId": "48", "updatedAt": "2026-05-15T19:25:00.000Z", "deleted": false },
  "historyVersion": { "versionId": "48", "path": "ServerScriptService.Main", "className": "Script", "source": "print('changed')", "action": "updated", "timestamp": "2026-05-15T19:25:00.000Z", "summary": "Live update", "actor": "studio-plugin" },
  "timestamp": "2026-05-15T19:25:00.000Z",
  "origin": "studio-plugin"
}
```

`kind` is one of: `created`, `updated`, `deleted`, `renamed`, `restored`.

---

## 6. Git Operations

Git operations are scoped to the repository associated with the envelope `placeId`. File statuses are one of `added`, `modified`, `deleted`, `renamed`, `copied`, `staged`, `untracked`, or `conflicted`.

### 6.1 `git:status`

Get current git status of the place repository.

Request payload: `{}`

Response type: `git:status:response`

```json
{
  "repoPath": "/home/user/roagent/data/places/134109928056755",
  "branch": "main",
  "remoteUrl": "https://github.com/org/place.git",
  "ahead": 1,
  "behind": 0,
  "clean": false,
  "files": [
    { "path": "ServerScriptService.Main.lua", "status": "modified" }
  ]
}
```

Common errors: `PERMISSION_DENIED`, `GIT_CONFLICT`, `INTERNAL_ERROR`.

### 6.2 `git:commit`

Commit current state with a message. If `message` is omitted, the daemon generates `auto: <N> files changed at <timestamp>`.

Request:

```json
{
  "message": "Update scripts",
  "authorName": "RoAgent User",
  "authorEmail": "user@example.com"
}
```

Response type: `git:commit:response`

```json
{
  "commit": { "hash": "abc123", "message": "Update scripts", "authorName": "RoAgent User", "authorEmail": "user@example.com", "timestamp": "2026-05-15T19:30:00.000Z" }
}
```

Common errors: `PERMISSION_DENIED`, `GIT_CONFLICT`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 6.3 `git:log`

Get git log for the place. The daemon returns at most the last 50 commits.

Request:

```json
{
  "limit": 20,
  "skip": 0
}
```

Response type: `git:log:response`

```json
{
  "commits": [
    { "hash": "abc123", "message": "Update scripts", "authorName": "RoAgent User", "authorEmail": "user@example.com", "timestamp": "2026-05-15T19:30:00.000Z" }
  ],
  "hasMore": false
}
```

Common errors: `PERMISSION_DENIED`, `INTERNAL_ERROR`.

### 6.4 `git:diff`

Get diff for a specific script between two commits. If `toCommit` is omitted, the daemon compares `fromCommit` to the working tree.

Request:

```json
{
  "path": "ServerScriptService.Main",
  "fromCommit": "abc123",
  "toCommit": "def456"
}
```

Response type: `git:diff:response`

```json
{
  "path": "ServerScriptService.Main",
  "fromCommit": "abc123",
  "toCommit": "def456",
  "diff": "@@ -1 +1 @@\n-print('old')\n+print('new')\n"
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 6.5 `git:restore`

Restore a script to a specific commit.

Request:

```json
{
  "path": "ServerScriptService.Main",
  "commit": "abc123",
  "summary": "Restore from git"
}
```

Response type: `git:restore:response`

```json
{
  "script": { "path": "ServerScriptService.Main", "className": "Script", "source": "print('old')", "size": 12, "versionId": "49", "updatedAt": "2026-05-15T19:35:00.000Z", "deleted": false },
  "restoredFromCommit": "abc123",
  "historyVersion": { "versionId": "49", "path": "ServerScriptService.Main", "className": "Script", "source": "print('old')", "action": "restored", "timestamp": "2026-05-15T19:35:00.000Z", "summary": "Restore from git", "actor": "studio-plugin", "commitHash": "abc123" }
}
```

Common errors: `NOT_FOUND`, `PERMISSION_DENIED`, `GIT_CONFLICT`, `INTERNAL_ERROR`.

### 6.6 `git:push`

Push the place repo to remote.

Request:

```json
{
  "remote": "origin",
  "branch": "main"
}
```

Response type: `git:push:response`

```json
{
  "ok": true,
  "remote": "origin",
  "branch": "main",
  "pushedAt": "2026-05-15T19:36:00.000Z"
}
```

Common errors: `PERMISSION_DENIED`, `GIT_CONFLICT`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 6.7 `git:pull`

Pull from remote using rebase. If a conflict occurs, the daemon returns `GIT_CONFLICT` with `details.conflictingFiles`.

Request:

```json
{
  "remote": "origin",
  "branch": "main",
  "rebase": true
}
```

Response type: `git:pull:response`

```json
{
  "ok": true,
  "remote": "origin",
  "branch": "main",
  "pulledAt": "2026-05-15T19:37:00.000Z",
  "fastForward": true
}
```

Common errors: `PERMISSION_DENIED`, `GIT_CONFLICT`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 6.8 `git:setRemote`

Set the remote URL for the place repo. `remote` defaults to `origin`. Clients may send `remoteUrl` or legacy `url`. Only `https://` URLs for GitHub, GitLab, Bitbucket, and Azure DevOps are accepted. If credentials are embedded, the daemon strips them from the configured remote URL and stores credentials separately.

Request:

```json
{
  "remote": "origin",
  "remoteUrl": "https://token@github.com/org/place.git"
}
```

Response type: `git:setRemote:response`

```json
{
  "ok": true,
  "remote": "origin",
  "url": "https://github.com/org/place.git"
}
```

Common errors: `PERMISSION_DENIED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

---

## 7. Agent Operations

### 7.1 `agent:launch`

Launch the RoAgent terminal for the current `placeId`.

Request:

```json
{
  "cwd": "/home/user/roagent/repos/134109928056755",
  "args": ["--place", "134109928056755"]
}
```

Response type: `agent:launch:response`

```json
{
  "running": true,
  "pid": 12345,
  "terminalId": "uuid",
  "launchedAt": "2026-05-15T19:40:00.000Z",
  "placeId": "134109928056755"
}
```

Common errors: `PERMISSION_DENIED`, `AGENT_UNAVAILABLE`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### 7.2 `agent:kill`

Kill the RoAgent terminal for the current `placeId`.

Request payload: `{}`

Response type: `agent:kill:response`

```json
{
  "running": false,
  "pid": 12345,
  "killedAt": "2026-05-15T19:45:00.000Z"
}
```

Common errors: `AGENT_UNAVAILABLE`, `PERMISSION_DENIED`, `INTERNAL_ERROR`.

### 7.3 `agent:status`

Get RoAgent process status.

Request payload: `{}`

Response type: `agent:status:response`

```json
{
  "running": true,
  "pid": 12345,
  "terminalId": "uuid",
  "launchedAt": "2026-05-15T19:40:00.000Z",
  "lastSeenAt": "2026-05-15T19:44:00.000Z",
  "placeId": "134109928056755"
}
```

Common errors: `PERMISSION_DENIED`, `INTERNAL_ERROR`.

### 7.4 `agent:action`

Server push: a new agent action was just performed.

**Direction:** server → client

Push payload:

```json
{
  "id": "uuid",
  "timestamp": "2026-05-15T19:46:00.000Z",
  "summary": "Updated SprintSystem script",
  "tool": "script:write"
}
```

The required business fields are exactly `{ timestamp, summary, tool }`; `id` is included for deduplication.

### 7.5 `agent:recentActions`

Return the last 5 `agent:action` entries for the current place.

Request payload: `{}`

Response type: `agent:recentActions:response`

```json
{
  "actions": [
    { "id": "uuid", "timestamp": "2026-05-15T19:46:00.000Z", "summary": "Updated SprintSystem script", "tool": "script:write" }
  ]
}
```

Common errors: `PERMISSION_DENIED`, `INTERNAL_ERROR`.

---

## 8. License Operations

License messages may use `placeId: "__global__"` if no Roblox place is active.

### 8.1 `license:activate`

Activate a license key.

Request:

```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceName": "Olivi Workstation"
}
```

Response type: `license:activate:response`

```json
{
  "status": "active",
  "activatedAt": "2026-05-15T19:50:00.000Z",
  "expiresAt": "2027-05-15T19:50:00.000Z",
  "licenseeEmail": "user@example.com",
  "plan": "pro"
}
```

License-specific failures should use `license:error`.

Common license errors: `LICENSE_INVALID`, `LICENSE_EXPIRED`, `LICENSE_ALREADY_ACTIVATED`, `PERMISSION_DENIED`, `INTERNAL_ERROR`.

### 8.2 `license:status`

Get current license status.

Request payload: `{}`

Response type: `license:status:response`

```json
{
  "status": "active",
  "activatedAt": "2026-05-15T19:50:00.000Z",
  "expiresAt": "2027-05-15T19:50:00.000Z",
  "licenseeEmail": "user@example.com",
  "plan": "pro",
  "lastCheckedAt": "2026-05-15T20:00:00.000Z"
}
```

Common errors: `PERMISSION_DENIED`, `INTERNAL_ERROR`.

### 8.3 `license:warning`

Server push: license expiry warning.

```json
{
  "message": "License expires soon",
  "expiresAt": "2026-06-01T00:00:00.000Z",
  "daysRemaining": 14
}
```

### 8.4 `license:revoked`

Server push: license was revoked.

```json
{
  "code": "LICENSE_INVALID",
  "message": "License was revoked",
  "revokedAt": "2026-05-15T20:00:00.000Z"
}
```

### 8.5 `license:error`

License-specific error response. This is distinct from generic `error` so the UI can show license remediation flows.

```json
{
  "version": "1",
  "type": "license:error",
  "requestId": "<same request id>",
  "placeId": "__global__",
  "payload": {
    "code": "LICENSE_INVALID",
    "message": "License key is invalid",
    "retryable": false,
    "details": {}
  }
}
```

---

## 9. Daemon Operations

### 9.1 `daemon:health`

Get full daemon health status.

Request payload: `{}`

Response type: `daemon:health:response`

```json
{
  "ok": true,
  "daemonVersion": "1.0.0",
  "protocolVersion": "1",
  "uptimeSeconds": 3600,
  "startedAt": "2026-05-15T19:00:00.000Z",
  "activeConnections": 2,
  "activePlaces": ["134109928056755"],
  "storage": {
    "ok": true,
    "path": "/home/user/.roagent/state.sqlite"
  },
  "git": {
    "available": true,
    "version": "2.43.0"
  },
  "agent": {
    "running": true,
    "pid": 12345,
    "terminalId": "uuid",
    "launchedAt": "2026-05-15T19:40:00.000Z",
    "lastSeenAt": "2026-05-15T19:44:00.000Z",
    "placeId": "134109928056755"
  },
  "license": {
    "status": "active",
    "expiresAt": "2027-05-15T19:50:00.000Z",
    "plan": "pro"
  }
}
```

Common errors: `INTERNAL_ERROR`.

---

## 10. Complete Message Type List

### Client request types

- `script:read`
- `script:write`
- `script:create`
- `script:delete`
- `script:rename`
- `script:restore`
- `script:list`
- `history:get`
- `history:getDeleted`
- `watch:subscribe`
- `watch:unsubscribe`
- `git:status`
- `git:commit`
- `git:log`
- `git:diff`
- `git:restore`
- `git:push`
- `git:pull`
- `git:setRemote`
- `agent:launch`
- `agent:kill`
- `agent:status`
- `agent:recentActions`
- `license:activate`
- `license:status`
- `daemon:health`

### Success response types

- `script:read:response`
- `script:write:response`
- `script:create:response`
- `script:delete:response`
- `script:rename:response`
- `script:restore:response`
- `script:list:response`
- `history:get:response`
- `history:getDeleted:response`
- `watch:subscribe:response`
- `watch:unsubscribe:response`
- `git:status:response`
- `git:commit:response`
- `git:log:response`
- `git:diff:response`
- `git:restore:response`
- `git:push:response`
- `git:pull:response`
- `git:setRemote:response`
- `agent:launch:response`
- `agent:kill:response`
- `agent:status:response`
- `agent:recentActions:response`
- `license:activate:response`
- `license:status:response`
- `daemon:health:response`

### Server push types

- `watch:event`
- `agent:action`
- `license:warning`
- `license:revoked`

### Error response types

- `error`
- `license:error`
