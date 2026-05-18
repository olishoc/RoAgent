# RoAgent — StudioLink for Roblox Studio

RoAgent connects Roblox Studio to a local Windows daemon and a terminal-based AI coding agent. The Studio plugin tracks place-specific script history, shows recent activity, opens RoAgent in a terminal, and safely applies daemon/agent script changes back into Studio.

## How It Works

```text
┌──────────────┐  HTTP RPC  ┌──────────────┐  terminal/tools  ┌──────────┐
│ Roblox       │ ─────────→ │ RoAgent      │ ───────────────→ │ RoAgent  │
│ Studio       │ ←───────── │ daemon       │ ←─────────────── │ terminal │
│ plugin       │ 127.0.0.1  │ Node.js      │   script tools   │ agent    │
└──────────────┘  :45678    └──────────────┘                  └──────────┘
```

1. **Studio plugin (Lua)** — scans managed Studio scripts, records live created/modified/renamed/deleted events, shows history/activity, and opens RoAgent terminal through the daemon.
2. **Local daemon (Node.js)** — owns HTTP RPC on `127.0.0.1:45678`, stores place-scoped script state/history, performs safe OS actions, manages git checkpoints, and exposes tools to RoAgent.
3. **RoAgent terminal** — runs outside Roblox Studio and receives ready-to-use StudioLink tools for reading, creating, writing, renaming, and deleting managed scripts.

## Quick Start for Local Development

### 1. Start the daemon

```bash
cd server
npm install
npm start
```

The daemon listens on `http://127.0.0.1:45678` by default.

### 2. Install or update the Studio plugin

1. Open Roblox Studio.
2. Make sure **HttpService is enabled** for the place.
3. Use the Creator Store/plugin workflow for production, or use the generated local bundle during development:
   - `plugin/StudioLinkPlugin_Bundled.lua`
   - `plugin/PluginLua.lua` for manual upload/copy workflows
4. Reload Roblox Studio/plugin after updating the plugin source.

### 3. Use it

- Open the StudioLink toolbar panel.
- Check daemon connection status.
- Launch RoAgent in a terminal from Studio.
- Use the terminal agent to create/read/write scripts through StudioLink tools.
- Use the plugin history/activity UI to inspect script changes and deleted records.

RoAgent does **not** embed a full AI chat inside Studio. Studio is the control/status surface; the comfortable coding chat happens in the launched terminal.

## Current HTTP RPC Areas

The daemon accepts token-protected loopback RPC for:

- Script CRUD and list: `script:create`, `script:read`, `script:write`, `script:delete`, `script:rename`, `script:list`
- Studio snapshot/deploy safety: `script:syncSnapshot`, `script:ackDeploy`
- History and deleted records
- Git status/commit/log/diff/restore/remotes
- Agent launch/status/recent actions
- Daemon health, update/status, trusted URL opening

## Safety Rules

- HTTP RPC stays on `127.0.0.1:45678`.
- Mutating local routes require an auth token.
- Plugin polling never deletes Studio instances.
- Polling only deploys records marked `pendingStudioDeploy` or legacy records missing that field, then ACKs successful deploys.
- Roblox default/runtime scripts such as `PlayerModule`, `CameraScript`, `ControlScript`, and `Animate` are ignored unless an explicit opt-in is added later.
- Git is a checkpoint/history layer and must not overwrite Studio from stale local files without explicit user action.

## Project Plan

The commercial rewrite tracker lives at:

- `docs/plans/roagent-commercial-product-rewrite.md`
