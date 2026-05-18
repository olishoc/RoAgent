# RblxAgent website worker

This Cloudflare Worker serves `rblxagent.com` pages, release manifests, test downloads, Polar webhook entitlement wiring, and recovery links.

## Routes

- `GET /` — landing page
- `GET /download` — purchase/download page
- `GET /recover` — email recovery form
- `POST /api/recover` — recovery endpoint
- `GET /api/releases/studiolink.json` — daemon update manifest
- `GET /api/releases` — plugin/daemon compatibility JSON
- `POST /api/polar/webhook` — Polar order webhook
- `GET /downloads/StudioLinkPlugin_Bundled.lua` — inline plugin bundle
- `GET /downloads/studiolink-daemon.exe` — Windows self-installing daemon from R2 or fallback URL
- `GET /downloads/StudioLink.pkg` — macOS installer from R2

## Public test downloads

By default, `PUBLIC_DOWNLOADS` is treated as enabled unless set to `false`. In public mode, daemon/pkg routes do not require entitlement tokens, but still require the artifact to be uploaded to R2 or configured with a fallback URL.

## Recommended artifact storage

Use GitHub Releases first because R2 is not enabled on the Cloudflare account yet. Upload the Windows Actions artifact `studiolink-daemon.exe`, then set:

```toml
WINDOWS_DAEMON_URL = "https://github.com/<owner>/<repo>/releases/download/v3.0.0/studiolink-daemon.exe"
WINDOWS_DAEMON_SHA256 = "<64 hex chars>"
WINDOWS_DAEMON_SIZE = "12345678"
```

Optional later: use Cloudflare R2 after enabling R2 in the Cloudflare dashboard.

```bash
cd /home/olivi/roagent/website-worker
wrangler r2 bucket create rblxagent-downloads
wrangler r2 object put rblxagent-downloads/releases/3.0.0/windows/studiolink-daemon.exe --file ../dist/studiolink-daemon.exe
wrangler r2 object put rblxagent-downloads/releases/3.0.0/macos/StudioLink.pkg --file ../dist/StudioLink.pkg
```

Add the R2 binding to `wrangler.toml` after creating the bucket:

```toml
[[r2_buckets]]
binding = "DOWNLOADS"
bucket_name = "rblxagent-downloads"
```

## Entitlement storage

Create a KV namespace for purchase/download recovery:

```bash
wrangler kv namespace create RBLXAGENT_ENTITLEMENTS
```

Then add the returned IDs to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "ENTITLEMENTS"
id = "<production id>"
preview_id = "<preview id>"
```

## Required/optional variables

Plain variables can go under `[vars]` in `wrangler.toml`:

```toml
[vars]
PUBLIC_DOWNLOADS = "true"
POLAR_PRODUCT_ID = "7f09de97-45f6-4ed0-96bd-f9bb449b7248"
POLAR_SUCCESS_URL = "https://rblxagent.com/download?checkout_id={CHECKOUT_ID}"
WINDOWS_DAEMON_SHA256 = "<64 hex chars>"
WINDOWS_DAEMON_SIZE = "12345678"
# Optional if not using R2:
# WINDOWS_DAEMON_URL = "https://github.com/.../studiolink-daemon.exe"
MACOS_INSTALLER_SHA256 = "<64 hex chars>"
MACOS_INSTALLER_SIZE = "12345678"
RESEND_FROM = "RblxAgent <support@rblxagent.com>"
```

Secrets:

```bash
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
```

## Deploy

```bash
cd /home/olivi/roagent/website-worker
wrangler deploy
```

## Smoke tests

```bash
curl -i https://rblxagent.com/api/releases/studiolink.json
curl -I https://rblxagent.com/downloads/StudioLinkPlugin_Bundled.lua
curl -i https://rblxagent.com/downloads/studiolink-daemon.exe
curl -i -X POST https://rblxagent.com/api/recover \
  -H 'content-type: application/json' \
  --data '{"email":"you@example.com"}'
```

## Switching to gated downloads

After Polar, KV, and R2 are configured and tested, set:

```toml
[vars]
PUBLIC_DOWNLOADS = "false"
```

Then customers use `/recover` to receive tokenized installer links. Plugin bundle remains public because Roblox Studio plugin installation is distributed separately.
