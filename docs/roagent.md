# RoAgent — StudioLink AI

RoAgent is the StudioLink-branded fork of pi agent. It runs as a terminal AI coding assistant for Roblox Studio projects and talks to the local StudioLink daemon, not directly to the Roblox plugin.

## Startup

StudioLink launches RoAgent with:

```bash
roagent \
  --studiolink \
  --studiolink-place-id <placeId> \
  --studiolink-place-name <placeName> \
  --studiolink-daemon-port 45678 \
  --studiolink-scripts-dir <absolute scripts dir>
```

On startup, RoAgent reads the current script list and git status. It does not write anything until the user asks.

## Tools

- `script_read({ path })` — read full Luau source.
- `script_write({ path, content })` — overwrite source.
- `script_create({ path, content })` — create a script.
- `script_delete({ path })` — delete a script; RoAgent must ask first.
- `script_rename({ from, to })` — rename or move a script.
- `script_list({})` — list place scripts.
- `script_restore({ path, toCommit })` — restore from git.
- `git_status({})` — inspect repository state.
- `git_commit({ message })` — commit all changes.
- `git_log({ limit })` — recent history.
- `git_diff({ path, fromCommit, toCommit })` — unified diff.

## Example conversations

User: `Add sprint stamina to the character controller.`  
RoAgent: reads the relevant StarterPlayerScripts controller, edits it with `task.wait()` rather than `wait()`, then summarizes the changed script.

User: `Commit that as player movement polish.`  
RoAgent: checks git status and runs `git_commit({ message: "player movement polish" })`.

## Built-in Roblox/Luau knowledge

RoAgent's StudioLink system prompt reminds the model that Roblox uses Luau, `game:GetService()`, Roblox service hierarchy, `task.wait()`, and `task.spawn()`.

## API key updates

StudioLink stores AI settings in the OS user config and stores the raw API key in the system keychain through the daemon endpoint:

```http
POST http://127.0.0.1:45678/config/api-key
{ "provider": "anthropic", "apiKey": "...", "model": "claude-sonnet-4-20250514" }
```

If no key is configured, RoAgent should exit with:

```text
No API key configured. Run the StudioLink installer setup or visit: studiolink.dev/setup-api-key
```

## Getting best results

- Refer to Roblox services and script paths explicitly.
- Ask for one feature or bug fix at a time.
- Ask RoAgent to run `git_status` before committing.
- Review summaries in the plugin's passive action log.
