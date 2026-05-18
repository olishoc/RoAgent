# StudioLink License Server

Cloudflare Worker API that connects Polar payments to StudioLink daemon license activation.

```text
Polar Checkout
   ↓ webhook payment succeeded
StudioLink License Server (api.studiolink.dev)
   ↓ generates license key
STUDIO-XXXX-XXXX-XXXX-XXXX
   ↓ shown on download page + emailed to customer
StudioLink Installer
   ↓ activates the key against the license server
Local Daemon
   ↓ validates every 24h against the license server
```

## Prerequisites

1. Node.js 20+
2. Wrangler CLI: `npm i -g wrangler`
3. Supabase CLI or hosted Supabase project
4. Resend account/API key
5. Polar product + webhook secret

## Environment variables

Set these as Cloudflare Worker secrets:

```bash
wrangler secret put POLAR_WEBHOOK_SECRET
wrangler secret put POLAR_PRODUCT_ID
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put ADMIN_SECRET
```

See `.env.example` for descriptions.

## Database setup

Run `src/db/schema.sql` in Supabase SQL editor or via CLI:

```bash
supabase db push
# or paste schema.sql into Supabase SQL editor
```

Seed test licenses:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run seed
```

## Local development

```bash
cd license-server
npm install
cp .env.example .dev.vars
# fill .dev.vars
npm run dev
```

Point StudioLink daemon at local Worker:

```bash
PLUGIN_LICENSE_SERVER_URL=http://localhost:8787 \
cd ../server && npm start
```

## Production deploy

```bash
cd license-server
npm install
npm run typecheck
npm test
wrangler deploy
```

Configure Cloudflare custom domain:

```text
api.studiolink.dev -> studiolink-license-server Worker
```

## Admin endpoints

All admin endpoints require:

```http
Authorization: Bearer <ADMIN_SECRET>
```

Look up license:

```bash
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  "https://api.studiolink.dev/api/license/status?key=STUDIO-XXXX-XXXX-XXXX-XXXX"
```

Revoke/reset a license:

```bash
curl -X POST https://api.studiolink.dev/api/license/revoke \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"STUDIO-XXXX-XXXX-XXXX-XXXX","reason":"support transfer"}'
```

## Support workflows

### “My key doesn't work”

1. Run `GET /api/license/status?key=...`.
2. Check status, machine ID, and activation log.
3. If machine mismatch, revoke/reset and ask customer to activate again.

### “I got a new computer”

1. Revoke/reset with reason `machine transfer`.
2. Tell customer to activate the same key on the new machine.

### “I never received my email”

1. Look up the Polar order.
2. Check `webhook_log` by `polar_order_id`.
3. Use license status endpoint to retrieve the key.
4. Resend manually if needed.
