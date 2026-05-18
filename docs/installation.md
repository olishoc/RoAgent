# StudioLink Installation

StudioLink ships three pieces as one product:

- `studiolink-daemon` — local daemon and Roblox script bridge.
- `roagent` — StudioLink AI terminal assistant for Roblox Studio.
- Roblox Studio plugin — passive UI/log surface inside Studio.

Default daemon port: `45678`.

## Windows self-installing daemon

1. Download `studiolink-daemon.exe` from `https://rblxagent.com/download`. During public test mode this route is open; later it will require purchase/recovery links.
2. Double-click `studiolink-daemon.exe`. It self-installs per-user and does not require Administrator by default.
3. The bootstrapper places files in:
   - Daemon: `%LOCALAPPDATA%\Programs\StudioLink\studiolink-daemon.exe`
   - Bundled RoAgent: `%LOCALAPPDATA%\Programs\StudioLink\roagent\roagent.exe`
   - Data: `%APPDATA%\StudioLink\`
4. The bootstrapper registers Apps & Features uninstall metadata.
5. The bootstrapper enables per-user autostart with the HKCU Run key unless launched with `install --no-autostart`:
   - `Software\Microsoft\Windows\CurrentVersion\Run\StudioLink`
6. The installed daemon starts immediately and listens on `127.0.0.1:45678`.
7. Choose provider/model and enter an API key, or skip and configure later from StudioLink settings.

### Windows uninstall

Use Apps & Features or run:

```powershell
& "$env:LOCALAPPDATA\Programs\StudioLink\studiolink-daemon.exe" uninstall
```

To delete local data too:

```powershell
& "$env:LOCALAPPDATA\Programs\StudioLink\studiolink-daemon.exe" uninstall --delete-data
```

The uninstaller removes the HKCU autostart key, uninstall metadata, and installed files. Local data in `%APPDATA%\StudioLink\` is kept unless `--delete-data` is used.

## macOS installer

1. Download `StudioLink.pkg` from `https://rblxagent.com/download`. During public test mode this route is open; later it will require purchase/recovery links.
2. Open the package and follow prompts.
3. The installer places files in:
   - Daemon: `/usr/local/bin/studiolink-daemon`
   - RoAgent: `/usr/local/bin/roagent`
   - Data: `~/Library/Application Support/StudioLink/`
4. It installs `~/Library/LaunchAgents/com.studiolink.daemon.plist`.
5. It loads the LaunchAgent immediately with `launchctl load`.
6. The post-install health check verifies the daemon, git, and RoAgent.

### macOS uninstall

Run:

```bash
/usr/local/bin/studiolink-uninstall
```

This unloads launchd, deletes the plist, and removes installed executables. To remove user data manually:

```bash
rm -rf "$HOME/Library/Application Support/StudioLink"
rm -rf "$HOME/Library/Logs/StudioLink"
```

## Autostart, repair, and updates

The Studio plugin Settings page can:

- show autostart status;
- enable/disable autostart;
- check the release manifest;
- stage a daemon update when running from a packaged daemon;
- run a repair check;
- create a support bundle.

Default update manifest URL:

```text
https://rblxagent.com/api/releases/studiolink.json
```

Website download/recovery routes:

```text
https://rblxagent.com/download
https://rblxagent.com/recover
https://rblxagent.com/downloads/studiolink-daemon.exe
https://rblxagent.com/downloads/StudioLink.pkg
https://rblxagent.com/downloads/StudioLinkPlugin_Bundled.lua
```

Override for testing or private releases:

```bash
STUDIOLINK_UPDATE_MANIFEST_URL=https://rblxagent.com/api/releases/studiolink.json
```

Manifest artifacts must use HTTPS and include a SHA-256 checksum. Code signing/notarization is still a release prerequisite; current automatic verification is checksum-based unless a signature URL is present in the manifest.

## Manual installation for corporate machines

### Windows

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\Programs\StudioLink\roagent"
Copy-Item studiolink-daemon.exe "$env:LOCALAPPDATA\Programs\StudioLink\studiolink-daemon.exe"
Copy-Item roagent.exe "$env:LOCALAPPDATA\Programs\StudioLink\roagent\roagent.exe"
New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "StudioLink" -Value "`"$env:LOCALAPPDATA\Programs\StudioLink\studiolink-daemon.exe`"" -PropertyType String -Force
Start-Process "$env:LOCALAPPDATA\Programs\StudioLink\studiolink-daemon.exe"
```

### macOS

```bash
sudo install -m 755 studiolink-daemon /usr/local/bin/studiolink-daemon
sudo install -m 755 roagent /usr/local/bin/roagent
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/StudioLink"
cp com.studiolink.daemon.plist "$HOME/Library/LaunchAgents/"
launchctl load "$HOME/Library/LaunchAgents/com.studiolink.daemon.plist"
```

## API key setup and updates

The plugin settings screen should call:

```http
POST http://127.0.0.1:45678/config/api-key
Content-Type: application/json

{
  "provider": "anthropic",
  "apiKey": "sk-...",
  "model": "claude-sonnet-4-20250514"
}
```

The raw API key is stored in the system keychain via `keytar`. `config.json` stores only provider/model metadata and a keychain marker.

## Change AI model

Call the same endpoint with the new model:

```json
{ "provider": "openai", "apiKey": "existing-or-new-key", "model": "gpt-4o" }
```

Provider defaults:

- Anthropic: `claude-sonnet-4-20250514`
- OpenAI: `gpt-4o`
- OpenRouter: provider-qualified model IDs such as `anthropic/claude-sonnet-4`

## Start/stop daemon manually

### Windows

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\StudioLink\studiolink-daemon.exe"
taskkill /IM studiolink-daemon.exe /F
```

### macOS

```bash
launchctl load "$HOME/Library/LaunchAgents/com.studiolink.daemon.plist"
launchctl unload "$HOME/Library/LaunchAgents/com.studiolink.daemon.plist"
```

## Health check

```bash
curl http://127.0.0.1:45678/health
roagent --version
```

Expected success message from installer health check:

```text
✓ StudioLink is running
✓ RoAgent is ready
You can now install the Roblox plugin from the Roblox toolbox.
```

If installation fails, check logs and visit: https://rblxagent.com/troubleshooting
