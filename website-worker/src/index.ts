import { PLUGIN_BUNDLE, PLUGIN_BUNDLE_VERSION } from "./pluginBundle";

interface R2ObjectBody {
  body: ReadableStream;
  size?: number;
  httpEtag?: string;
  writeHttpMetadata?(headers: Headers): void;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  POLAR_CHECKOUT_URL?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_SUCCESS_URL?: string;
  POLAR_PRODUCT_ID?: string;
  POLAR_WEBHOOK_SECRET?: string;
  PUBLIC_DOWNLOADS?: string;
  DOWNLOADS?: R2BucketLike;
  ENTITLEMENTS?: KvLike;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  WINDOWS_DAEMON_SHA256?: string;
  WINDOWS_DAEMON_SIZE?: string;
  WINDOWS_INSTALLER_SHA256?: string;
  WINDOWS_INSTALLER_SIZE?: string;
  WINDOWS_DAEMON_URL?: string;
  MACOS_PKG_URL?: string;
  MACOS_INSTALLER_SHA256?: string;
  MACOS_INSTALLER_SIZE?: string;
}

interface Entitlement {
  email: string;
  emailHash: string;
  polarOrderId: string;
  polarCustomerId?: string;
  productId?: string;
  status: "active";
  createdAt: string;
}

const LATEST_PLUGIN_VERSION = PLUGIN_BUNDLE_VERSION;
const LATEST_DAEMON_VERSION = "3.0.0";
const MIN_PLUGIN_VERSION = "1.0.0";
const MIN_DAEMON_VERSION = "3.0.0";
const DOWNLOAD_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const ARTIFACTS = {
  windows: {
    key: `releases/${LATEST_DAEMON_VERSION}/windows/studiolink-daemon.exe`,
    fileName: "studiolink-daemon.exe",
    contentType: "application/vnd.microsoft.portable-executable",
    platform: "win32-x64",
  },
  macos: {
    key: `releases/${LATEST_DAEMON_VERSION}/macos/StudioLink.pkg`,
    fileName: "StudioLink.pkg",
    contentType: "application/octet-stream",
    platform: "darwin-universal",
  },
} as const;

type DownloadKind = keyof typeof ARTIFACTS;

const styles = `:root{color-scheme:dark;--bg:#0c111c;--panel:#121a2a;--text:#edf3ff;--muted:#a8b4ca;--line:#263650;--accent:#65d38b;--accent2:#74a7ff;--warn:#ffd166;--bad:#ff6b6b}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 20% 10%,rgba(116,167,255,.22),transparent 30rem),radial-gradient(circle at 80% 0%,rgba(101,211,139,.16),transparent 26rem),var(--bg);color:var(--text)}main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:72px 0 40px}.hero{padding:52px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(135deg,rgba(18,26,42,.94),rgba(23,34,53,.72));box-shadow:0 24px 80px rgba(0,0,0,.32)}.eyebrow{margin:0 0 14px;color:var(--accent);font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{max-width:860px;margin:0;font-size:clamp(40px,7vw,78px);line-height:.95;letter-spacing:-.06em}.lede{max-width:760px;margin:26px 0 0;color:var(--muted);font-size:clamp(18px,2.3vw,23px);line-height:1.55}.actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border:1px solid var(--line);border-radius:999px;color:var(--text);text-decoration:none;font-weight:700;background:rgba(255,255,255,.04);cursor:pointer}.primary{border-color:transparent;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#07101c}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px}.card,.notice,form{border:1px solid var(--line);border-radius:22px;background:rgba(18,26,42,.78);padding:24px}.card h2,.notice h2{margin:0 0 10px;font-size:19px}.card p,.notice p,li{color:var(--muted);line-height:1.6}.notice{margin-top:18px}.code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:rgba(255,255,255,.06);padding:.15rem .35rem;border-radius:6px}label{display:block;color:var(--muted);font-weight:700;margin-bottom:8px}input{width:100%;min-height:48px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.05);color:var(--text);padding:0 14px;font:inherit}.field{margin:18px 0}footer{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:0 0 36px;display:flex;justify-content:space-between;gap:18px;color:var(--muted)}footer nav{display:flex;gap:16px}a{color:inherit}@media(max-width:820px){main{padding-top:28px}.hero{padding:30px}.cards{grid-template-columns:1fr}footer{flex-direction:column}}`;

function page(title: string, body: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><meta name="description" content="RblxAgent connects Roblox Studio to an AI coding agent."/><style>${styles}</style></head><body>${body}<footer><span>© 2026 RblxAgent</span><nav><a href="/download">Download</a><a href="/recover">Recover</a><a href="/update">Update</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:support@rblxagent.com">Support</a></nav></footer></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60", "access-control-allow-origin": "*" },
  });
}

function checkoutUrl(env: Env): string {
  if (env.POLAR_CHECKOUT_URL) return env.POLAR_CHECKOUT_URL;
  if (env.POLAR_ACCESS_TOKEN && env.POLAR_PRODUCT_ID) return "/checkout";
  return "mailto:support@rblxagent.com?subject=RblxAgent%20access";
}

function publicDownloads(env: Env): boolean {
  return env.PUBLIC_DOWNLOADS !== "false";
}

function releasePayload(url: URL, env: Env): Record<string, unknown> {
  const pluginVersion = url.searchParams.get("pluginVersion") || "0.0.0";
  const daemonVersion = url.searchParams.get("daemonVersion") || "0.0.0";
  const updateUrl = new URL("/update", url.origin);
  updateUrl.searchParams.set("pluginVersion", pluginVersion);
  updateUrl.searchParams.set("daemonVersion", daemonVersion);
  return {
    latestPluginVersion: LATEST_PLUGIN_VERSION,
    latestDaemonVersion: LATEST_DAEMON_VERSION,
    minPluginVersion: MIN_PLUGIN_VERSION,
    minDaemonVersion: MIN_DAEMON_VERSION,
    pluginVersion,
    daemonVersion,
    pluginUpdateAvailable: compareVersions(pluginVersion, LATEST_PLUGIN_VERSION) < 0,
    daemonUpdateAvailable: compareVersions(daemonVersion, LATEST_DAEMON_VERSION) < 0,
    pluginIncompatible: compareVersions(pluginVersion, MIN_PLUGIN_VERSION) < 0,
    daemonIncompatible: compareVersions(daemonVersion, MIN_DAEMON_VERSION) < 0,
    updateUrl: updateUrl.toString(),
    downloadUrl: `${url.origin}/downloads/StudioLinkPlugin_Bundled.lua`,
    checkoutUrl: checkoutUrl(env),
  };
}

function daemonManifest(url: URL, env: Env): Record<string, unknown> {
  const artifacts: Record<string, unknown> = {};
  const windowsSha256 = env.WINDOWS_DAEMON_SHA256 || env.WINDOWS_INSTALLER_SHA256;
  if (windowsSha256) {
    artifacts[ARTIFACTS.windows.platform] = {
      platform: ARTIFACTS.windows.platform,
      version: LATEST_DAEMON_VERSION,
      url: env.WINDOWS_DAEMON_URL || `${url.origin}/downloads/${ARTIFACTS.windows.fileName}`,
      sha256: windowsSha256,
      size: numberEnv(env.WINDOWS_DAEMON_SIZE || env.WINDOWS_INSTALLER_SIZE),
    };
  }
  if (env.MACOS_INSTALLER_SHA256) {
    artifacts["darwin-x64"] = {
      platform: "darwin-x64",
      version: LATEST_DAEMON_VERSION,
      url: env.MACOS_PKG_URL || `${url.origin}/downloads/${ARTIFACTS.macos.fileName}`,
      sha256: env.MACOS_INSTALLER_SHA256,
      size: numberEnv(env.MACOS_INSTALLER_SIZE),
    };
    artifacts["darwin-arm64"] = { ...(artifacts["darwin-x64"] as object), platform: "darwin-arm64" };
  }
  return {
    version: LATEST_DAEMON_VERSION,
    daemonVersion: LATEST_DAEMON_VERSION,
    pluginVersion: LATEST_PLUGIN_VERSION,
    minPluginVersion: MIN_PLUGIN_VERSION,
    minDaemonVersion: MIN_DAEMON_VERSION,
    updateUrl: `${url.origin}/download`,
    releaseNotesUrl: `${url.origin}/update`,
    publicDownloads: publicDownloads(env),
    artifacts,
  };
}

function numberEnv(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function home(env: Env): Response {
  return page("RblxAgent — AI tools for Roblox Studio", `<main><section class="hero"><p class="eyebrow">RblxAgent</p><h1>AI coding assistance for Roblox Studio.</h1><p class="lede">RblxAgent links Roblox Studio with a local AI coding daemon, giving creators a faster way to review scripts, apply edits, track history, and keep work organized.</p><div class="actions"><a class="button primary" href="${checkoutUrl(env)}">Get access</a><a class="button" href="/download">Download</a><a class="button" href="/update">Update plugin</a></div></section><section class="cards"><article class="card"><h2>Studio bridge</h2><p>Connect Roblox Studio to a local daemon over localhost HTTP RPC.</p></article><article class="card"><h2>Script history</h2><p>Git-backed script tracking helps you understand changes and restore versions.</p></article><article class="card"><h2>Agent terminal</h2><p>Open a RoAgent terminal with your synced place scripts ready to edit.</p></article></section><section class="notice"><h2>Release channel</h2><p>Latest plugin <span class="code">${LATEST_PLUGIN_VERSION}</span>, daemon <span class="code">${LATEST_DAEMON_VERSION}</span>.</p></section></main>`);
}

function download(env: Env): Response {
  const mode = publicDownloads(env) ? "Public test downloads are enabled." : "Purchase recovery links are required for daemon downloads.";
  return page("Download RblxAgent", `<main><section class="hero"><p class="eyebrow">Download</p><h1>Install RblxAgent for Roblox Studio.</h1><p class="lede">Purchase access, download the Studio plugin bundle, and install the local daemon for your OS.</p><div class="actions"><a class="button primary" href="${checkoutUrl(env)}">Purchase / manage access</a><a class="button" href="/downloads/studiolink-daemon.exe">Windows self-installing daemon</a><a class="button" href="/downloads/StudioLink.pkg">macOS pkg</a><a class="button" href="/downloads/StudioLinkPlugin_Bundled.lua">Plugin bundle</a><a class="button" href="/recover">Recover downloads</a></div></section><section class="cards"><article class="card"><h2>Windows</h2><p>Double-click <span class="code">studiolink-daemon.exe</span>. It self-installs per-user, extracts bundled RoAgent, starts the daemon, and enables autostart.</p></article><article class="card"><h2>macOS</h2><p>Run <span class="code">StudioLink.pkg</span>. It installs the daemon and LaunchAgent.</p></article><article class="card"><h2>Roblox plugin</h2><p>Install <span class="code">StudioLinkPlugin_Bundled.lua</span> as a local Roblox Studio plugin.</p></article></section><section class="notice"><h2>Download mode</h2><p>${mode}</p></section></main>`);
}

function update(url: URL, env: Env): Response {
  const release = releasePayload(url, env);
  return page("Update RblxAgent", `<main><section class="hero"><p class="eyebrow">Updater</p><h1>Update your RblxAgent plugin and daemon.</h1><p class="lede">Download the latest plugin bundle or daemon, then restart/reload Roblox Studio. The local daemon also reads the JSON release manifest.</p><div class="actions"><a class="button primary" href="/downloads/StudioLinkPlugin_Bundled.lua">Download latest plugin</a><a class="button" href="/downloads/studiolink-daemon.exe">Windows daemon</a><a class="button" href="/downloads/StudioLink.pkg">macOS pkg</a><a class="button" href="/api/releases/studiolink.json">Release manifest</a></div></section><section class="cards"><article class="card"><h2>Current plugin</h2><p><span class="code">${escapeHtml(String(release.pluginVersion))}</span></p></article><article class="card"><h2>Latest plugin</h2><p><span class="code">${LATEST_PLUGIN_VERSION}</span></p></article><article class="card"><h2>Daemon</h2><p>Current <span class="code">${escapeHtml(String(release.daemonVersion))}</span><br/>Latest <span class="code">${LATEST_DAEMON_VERSION}</span></p></article></section><section class="notice"><h2>After downloading</h2><p>Roblox Studio cannot silently hot-swap a running plugin. Save/replace the local plugin and reload Studio to use the new version.</p></section></main>`);
}

function recoverPage(message = ""): Response {
  return page("Recover downloads — RblxAgent", `<main><section class="hero"><p class="eyebrow">Recover</p><h1>Recover your installer downloads.</h1><p class="lede">Enter the email used at checkout. During public test mode, this returns direct test download links.</p></section><form method="post" action="/api/recover"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required placeholder="you@example.com"/></div><button class="primary" type="submit">Recover downloads</button>${message ? `<p>${message}</p>` : ""}</form></main>`);
}

const privacy = `<main><section class="hero"><p class="eyebrow">Privacy</p><h1>Privacy Policy</h1><p class="lede">RblxAgent collects only the information needed to provide licensing, support, and product functionality. We may process license keys, order identifiers, email addresses, and machine activation identifiers to validate access.</p></section></main>`;
const terms = `<main><section class="hero"><p class="eyebrow">Terms</p><h1>Terms of Service</h1><p class="lede">RblxAgent helps Roblox creators work with scripts and development workflows. Use it responsibly and keep backups of important projects. Access may require a valid purchase/license.</p></section></main>`;

async function handleDownload(url: URL, env: Env, kind: DownloadKind): Promise<Response> {
  const artifact = ARTIFACTS[kind];
  if (!publicDownloads(env)) {
    const token = url.searchParams.get("token") || "";
    if (!await validDownloadToken(env, token)) return page("Purchase required — RblxAgent", `<main><section class="hero"><p class="eyebrow">Purchase required</p><h1>Recover or purchase access.</h1><p class="lede">This installer download requires a valid purchase recovery link.</p><div class="actions"><a class="button primary" href="${checkoutUrl(env)}">Purchase access</a><a class="button" href="/recover">Recover downloads</a></div></section></main>`, 403);
  }
  const object = await env.DOWNLOADS?.get(artifact.key);
  if (!object) {
    const fallbackUrl = kind === "windows" ? env.WINDOWS_DAEMON_URL : kind === "macos" ? env.MACOS_PKG_URL : undefined;
    if (fallbackUrl) return Response.redirect(fallbackUrl, 302);
    return page("Installer not uploaded — RblxAgent", `<main><section class="hero"><p class="eyebrow">Not uploaded yet</p><h1>${artifact.fileName} is not uploaded.</h1><p class="lede">The download route is working, but the installer artifact has not been uploaded to R2 key <span class="code">${artifact.key}</span>.</p><div class="actions"><a class="button" href="/download">Back to downloads</a></div></section></main>`, 404);
  }
  const headers = new Headers({
    "content-type": artifact.contentType,
    "content-disposition": `attachment; filename=${artifact.fileName}`,
    "cache-control": "private, max-age=60",
  });
  object.writeHttpMetadata?.(headers);
  return new Response(object.body, { headers });
}

async function handleRecover(request: Request, env: Env): Promise<Response> {
  const email = normalizeEmail(await readEmail(request));
  if (!email) return recoverPage("Please enter a valid email.");
  if (publicDownloads(env)) return json({ ok: true, publicDownloads: true, email, downloads: publicDownloadLinks(new URL(request.url).origin) });
  if (!env.ENTITLEMENTS) return json({ ok: false, error: "Entitlement storage is not configured yet." }, 503);
  const emailHash = await sha256Hex(email);
  const entitlement = await env.ENTITLEMENTS.get(`email:${emailHash}`);
  if (!entitlement) return json({ ok: false, error: "No purchase found for that email." }, 404);
  const token = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.ENTITLEMENTS.put(`download-token:${token}`, JSON.stringify({ emailHash, createdAt }), { expirationTtl: DOWNLOAD_TOKEN_TTL_SECONDS });
  const links = gatedDownloadLinks(new URL(request.url).origin, token);
  await sendRecoveryEmail(env, email, links).catch((error) => console.error("Recovery email failed", error));
  return json({ ok: true, emailed: Boolean(env.RESEND_API_KEY), downloads: links });
}

async function handleCheckout(request: Request, env: Env): Promise<Response> {
  if (env.POLAR_CHECKOUT_URL) return Response.redirect(env.POLAR_CHECKOUT_URL, 302);
  if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_PRODUCT_ID) return page("Checkout not configured — RblxAgent", `<main><section class="hero"><p class="eyebrow">Checkout</p><h1>Checkout is not configured yet.</h1><p class="lede">Set POLAR_ACCESS_TOKEN and POLAR_PRODUCT_ID as Worker secrets/vars, or set POLAR_CHECKOUT_URL.</p></section></main>`, 503);
  const origin = new URL(request.url).origin;
  const successUrl = env.POLAR_SUCCESS_URL || `${origin}/download?checkout_id={CHECKOUT_ID}`;
  const response = await fetch("https://api.polar.sh/v1/checkouts/", {
    method: "POST",
    headers: { authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ products: [env.POLAR_PRODUCT_ID], success_url: successUrl }),
  }).catch((error) => new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 502 }));
  const data = await response.json().catch(() => ({})) as { url?: string; checkout_url?: string; error?: unknown; detail?: unknown };
  const url = data.url || data.checkout_url;
  if (response.ok && url) return Response.redirect(url, 302);
  return page("Checkout unavailable — RblxAgent", `<main><section class="hero"><p class="eyebrow">Checkout</p><h1>Polar checkout is unavailable.</h1><p class="lede">${escapeHtml(JSON.stringify(data.error || data.detail || response.status))}</p><div class="actions"><a class="button" href="/download">Back to downloads</a></div></section></main>`, 502);
}

async function handlePolarWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.POLAR_WEBHOOK_SECRET) return new Response("webhook secret not configured", { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-polar-signature");
  if (!await verifyPolarSignature(raw, signature, env.POLAR_WEBHOOK_SECRET)) return new Response("invalid signature", { status: 401 });
  if (!env.ENTITLEMENTS) return new Response("entitlement storage not configured", { status: 503 });
  let event: Record<string, unknown>;
  try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return new Response("ok", { status: 200 }); }
  const type = String(event.type || "");
  if (type !== "order.paid" && type !== "checkout.order_created") return new Response("ok", { status: 200 });
  const order = extractOrder(event);
  if (env.POLAR_PRODUCT_ID && order.productId !== env.POLAR_PRODUCT_ID) return new Response("ok", { status: 200 });
  const emailHash = await sha256Hex(order.email);
  const entitlement: Entitlement = { email: order.email, emailHash, polarOrderId: order.polarOrderId, polarCustomerId: order.polarCustomerId, productId: order.productId, status: "active", createdAt: new Date().toISOString() };
  await env.ENTITLEMENTS.put(`email:${emailHash}`, JSON.stringify(entitlement));
  await env.ENTITLEMENTS.put(`order:${order.polarOrderId}`, JSON.stringify(entitlement));
  return new Response("ok", { status: 200 });
}

function publicDownloadLinks(origin: string): Record<string, string> {
  return {
    windows: `${origin}/downloads/${ARTIFACTS.windows.fileName}`,
    macos: `${origin}/downloads/${ARTIFACTS.macos.fileName}`,
    plugin: `${origin}/downloads/StudioLinkPlugin_Bundled.lua`,
  };
}

function gatedDownloadLinks(origin: string, token: string): Record<string, string> {
  return {
    windows: `${origin}/downloads/${ARTIFACTS.windows.fileName}?token=${encodeURIComponent(token)}`,
    macos: `${origin}/downloads/${ARTIFACTS.macos.fileName}?token=${encodeURIComponent(token)}`,
    plugin: `${origin}/downloads/StudioLinkPlugin_Bundled.lua`,
  };
}

async function validDownloadToken(env: Env, token: string): Promise<boolean> {
  if (!token || !env.ENTITLEMENTS) return false;
  return Boolean(await env.ENTITLEMENTS.get(`download-token:${token}`));
}

async function readEmail(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({})) as { email?: unknown };
    return typeof body.email === "string" ? body.email : "";
  }
  const form = await request.formData();
  const email = form.get("email");
  return typeof email === "string" ? email : "";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sendRecoveryEmail(env: Env, email: string, links: Record<string, string>): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const from = env.RESEND_FROM || "RblxAgent <support@rblxagent.com>";
  const html = `<p>Your RblxAgent downloads:</p><ul><li><a href="${links.windows}">Windows setup</a></li><li><a href="${links.macos}">macOS pkg</a></li><li><a href="${links.plugin}">Roblox plugin</a></li></ul>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: email, subject: "Your RblxAgent downloads", html }),
  });
}

async function verifyPolarSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  const candidates = signature.split(",").map((part) => part.trim()).flatMap((part) => {
    const value = part.includes("=") ? part.split("=").at(-1) : part;
    return value ? [value.trim()] : [];
  });
  return candidates.some((candidate) => timingSafeEqualHex(candidate, expected));
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const aBytes = hexToBytes(a.toLowerCase());
  const bBytes = hexToBytes(b.toLowerCase());
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i += 1) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function extractOrder(event: Record<string, unknown>): { email: string; polarCustomerId: string; polarOrderId: string; productId: string } {
  const data = objectValue(event.data);
  const attrs = objectValue(data.attributes);
  const metadata = objectValue(data.metadata) ?? objectValue(attrs.metadata) ?? {};
  const email = stringValue(attrs.customer_email) ?? stringValue(data.customer_email) ?? stringValue(attrs.email) ?? stringValue(metadata.email);
  const customer = attrs.customer;
  const product = attrs.product;
  const polarCustomerId = stringValue(data.customer_id) ?? stringValue(attrs.customer_id) ?? objectId(customer) ?? stringValue(metadata.customer_id) ?? "unknown-customer";
  const polarOrderId = stringValue(data.id) ?? stringValue(attrs.order_id) ?? stringValue(event.id);
  const productId = stringValue(data.product_id) ?? stringValue(attrs.product_id) ?? objectId(product) ?? stringValue(metadata.product_id);
  if (!email || !polarOrderId || !productId) throw new Error("Polar order is missing required fields");
  return { email: normalizeEmail(email), polarCustomerId, polarOrderId, productId };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function objectId(value: unknown): string | undefined {
  return value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname === "www.rblxagent.com") {
    url.hostname = "rblxagent.com";
    return Response.redirect(url.toString(), 301);
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,x-polar-signature" } });
  if (request.method === "GET" && url.pathname === "/api/releases/studiolink.json") return json(daemonManifest(url, env));
  if (request.method === "GET" && url.pathname === "/api/releases") return json(releasePayload(url, env));
  if (request.method === "GET" && url.pathname === "/checkout") return handleCheckout(request, env);
  if (request.method === "POST" && url.pathname === "/api/polar/webhook") return handlePolarWebhook(request, env);
  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/downloads/StudioLinkPlugin_Bundled.lua") {
    return new Response(request.method === "HEAD" ? null : PLUGIN_BUNDLE, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": "attachment; filename=StudioLinkPlugin_Bundled.lua", "cache-control": "public, max-age=300" } });
  }
  if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/downloads/studiolink-daemon.exe" || url.pathname === "/downloads/StudioLinkSetup.exe")) return handleDownload(url, env, "windows");
  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/downloads/StudioLink.pkg") return handleDownload(url, env, "macos");
  if (request.method === "GET" && url.pathname === "/download") return download(env);
  if (request.method === "GET" && url.pathname === "/update") return update(url, env);
  if (request.method === "GET" && url.pathname === "/recover") return recoverPage();
  if (request.method === "POST" && url.pathname === "/api/recover") return handleRecover(request, env);
  if (request.method === "GET" && url.pathname === "/privacy") return page("Privacy Policy — RblxAgent", privacy);
  if (request.method === "GET" && url.pathname === "/terms") return page("Terms — RblxAgent", terms);
  if (request.method === "GET" && url.pathname === "/") return home(env);
  return page("Not found — RblxAgent", `<main><section class="hero"><p class="eyebrow">404</p><h1>Not found.</h1><p class="lede">That page does not exist.</p></section></main>`, 404);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env);
  },
};

export { route as handleWebsiteRequest, hmacSha256Hex };
