# StudioLink Roblox Studio Plugin

Source layout:

```text
/plugin/
  main.lua
  ConnectionManager.lua
  Panels/
    Home.lua
    History.lua
    AgentLog.lua
  Theme.lua
  Utils.lua
```

`main.lua` contains `PLUGIN_VERSION = "1.0.8"` and preserves the existing RoAgent script scanning, path resolution, suppression, write/delete, and live feed watcher logic. The plugin uses HTTP RPC against the local daemon at `http://127.0.0.1:45678`; WebSocket is not required.

## Local development in Roblox Studio

1. Start the StudioLink daemon on your machine.
2. Copy the `/plugin/` files into a Roblox plugin project as ModuleScripts:
   - `main.lua` as the plugin entry Script/LocalPlugin source.
   - `ConnectionManager.lua`, `Theme.lua`, and `Utils.lua` as children of the entry script.
   - `Panels/Home.lua`, `Panels/History.lua`, and `Panels/AgentLog.lua` under a `Panels` Folder child.
3. The plugin bootstraps its auth token from loopback-only `/auth-token` and appends it as `?token=<token>` for local daemon mutations.
4. Run the plugin in Studio. The toolbar should show `Home`, `History`, and `Agent Log`.

On first connection, the plugin requests `script:list` with sources and sends the current Studio scripts to the daemon through `script:syncSnapshot`. After that initial snapshot has completed, polling only deploys active daemon records that are explicitly marked `pendingStudioDeploy` or legacy records missing that field, then sends `script:ackDeploy` after a successful Studio upsert. Polling never deletes Studio instances, which prevents stale daemon state from destroying scripts in a new/unsaved place.

## Bundling for Toolbox publishing

Roblox Toolbox plugins are commonly published as one plugin asset. Bundle this directory by converting each file to its matching Roblox object tree:

```text
PluginScript
  ConnectionManager (ModuleScript)
  Theme (ModuleScript)
  Utils (ModuleScript)
  Panels (Folder)
    Home (ModuleScript)
    History (ModuleScript)
    AgentLog (ModuleScript)
```

For a single-file publishing workflow, concatenate modules into a generated plugin script with a small module loader table, or use a Roblox plugin build tool that preserves the object hierarchy above. Do not hand-edit the preserved watcher/path/suppression code during bundling.

## Updating the plugin version

Update this line at the top of `main.lua`:

```lua
local PLUGIN_VERSION = "1.0.8"
```

The version is sent in the `watch:subscribe` payload so the daemon can enforce compatibility and show update banners.
