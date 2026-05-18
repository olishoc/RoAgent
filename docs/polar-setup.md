# Polar + Downloads Setup for RblxAgent

Phase 5 uses the `website-worker` Cloudflare Worker on `rblxagent.com` for:

- public test downloads;
- the daemon update manifest;
- Polar checkout redirect/wiring;
- Polar webhook entitlement storage;
- email/download recovery.

## 1. Polar product

Current product ID:

```text
7f09de97-45f6-4ed0-96bd-f9bb449b7248
```

Set it as a Worker variable in `website-worker/wrangler.toml`:

```toml
[vars]
POLAR_PRODUCT_ID = "7f09de97-45f6-4ed0-96bd-f9bb449b7248"
POLAR_SUCCESS_URL = "https://rblxagent.com/download?checkout_id={CHECKOUT_ID}"
```

Set the Polar access token as a secret, never in git:

```bash
cd /home/olivi/roagent/website-worker
wrangler secret put POLAR_ACCESS_TOKEN
```

Alternatively, if Polar gives a static checkout URL, set:

```toml
POLAR_CHECKOUT_URL = "https://..."
```

## 2. Webhook

Webhook URL:

```text
https://rblxagent.com/api/polar/webhook
```

Events:

```text
order.paid
checkout.order_created
```

Set the webhook signing secret:

```bash
cd /home/olivi/roagent/website-worker
wrangler secret put POLAR_WEBHOOK_SECRET
```

The webhook stores entitlements in Cloudflare KV by hashed email and Polar order ID.

## 3. Windows/macOS artifacts

Current Windows direction: GitHub Actions builds a self-installing `studiolink-daemon.exe` that embeds `roagent.exe`. Upload that artifact to GitHub Releases first, then set fallback URL/checksum vars:

```toml
WINDOWS_DAEMON_URL = "https://github.com/<owner>/<repo>/releases/download/v3.0.0/studiolink-daemon.exe"
WINDOWS_DAEMON_SHA256 = "<64 hex chars>"
WINDOWS_DAEMON_SIZE = "12345678"
```

Optional later storage: Cloudflare R2. R2 must be enabled in the Cloudflare dashboard first.

```bash
cd /home/olivi/roagent/website-worker
wrangler r2 bucket create rblxagent-downloads
wrangler r2 object put rblxagent-downloads/releases/3.0.0/windows/studiolink-daemon.exe --file /path/to/studiolink-daemon.exe
wrangler r2 object put rblxagent-downloads/releases/3.0.0/macos/StudioLink.pkg --file /path/to/StudioLink.pkg
```

Add binding to `website-worker/wrangler.toml` only if using R2:

```toml
[[r2_buckets]]
binding = "DOWNLOADS"
bucket_name = "rblxagent-downloads"
```

## 4. Cloudflare KV entitlements

```bash
wrangler kv namespace create RBLXAGENT_ENTITLEMENTS
```

Add the returned IDs:

```toml
[[kv_namespaces]]
binding = "ENTITLEMENTS"
id = "<production id>"
preview_id = "<preview id>"
```

## 5. Recovery email

If you want recovery emails, set Resend:

```bash
wrangler secret put RESEND_API_KEY
```

And in `wrangler.toml`:

```toml
RESEND_FROM = "RblxAgent <support@rblxagent.com>"
```

Without Resend, `/api/recover` still returns links on-screen in public test mode.

## 6. Public test vs gated downloads

For now:

```toml
PUBLIC_DOWNLOADS = "true"
```

This lets anyone test routes. When ready to require purchases:

```toml
PUBLIC_DOWNLOADS = "false"
```

Then installer downloads require tokenized recovery links. The Roblox plugin bundle stays public.

## 7. Deploy

```bash
cd /home/olivi/roagent/website-worker
wrangler deploy
```

## 8. Smoke tests

```bash
curl -i https://rblxagent.com/api/releases/studiolink.json
curl -i https://rblxagent.com/download
curl -i https://rblxagent.com/downloads/StudioLinkPlugin_Bundled.lua
curl -i https://rblxagent.com/downloads/StudioLinkSetup.exe
curl -i -X POST https://rblxagent.com/api/recover \
  -H 'content-type: application/json' \
  --data '{"email":"you@example.com"}'
```

Expected before installers are uploaded: installer routes return a controlled `404 Installer not uploaded`, not a worker crash.
