#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const API_BASE = "https://apis.roblox.com";
const root = process.cwd();
const apiKey = process.env.ROBLOX_API_KEY;
const assetId = process.env.ROBLOX_PLUGIN_ASSET_ID;
const assetType = process.env.ROBLOX_ASSET_TYPE || "Plugin";
const displayName = process.env.ROBLOX_PLUGIN_DISPLAY_NAME || "StudioLink";
const description = process.env.ROBLOX_PLUGIN_DESCRIPTION || "StudioLink Roblox Studio plugin.";
const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";
const sourcePath = path.resolve(root, process.env.ROBLOX_PLUGIN_SOURCE || "plugin/StudioLinkPlugin_Bundled.lua");
const outDir = path.resolve(root, "artifacts/roblox-plugin");
const rbxmxPath = path.join(outDir, "StudioLinkPlugin.rbxmx");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cdata(value) {
  return String(value).replaceAll("]]>", "]]]]><![CDATA[>");
}

function buildPluginRbxmx(luaSource) {
  return `<?xml version="1.0" encoding="utf-8"?>
<roblox version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="Script" referent="StudioLinkPluginScript">
    <Properties>
      <string name="Name">StudioLink</string>
      <bool name="Disabled">false</bool>
      <ProtectedString name="Source"><![CDATA[${cdata(luaSource)}]]></ProtectedString>
    </Properties>
  </Item>
</roblox>
`;
}

function makeMultipart(fields) {
  const boundary = `----StudioLinkRobloxBoundary${Date.now().toString(16)}`;
  const chunks = [];
  for (const field of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (field.filename) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${field.contentType || "application/octet-stream"}\r\n\r\n`));
      chunks.push(Buffer.isBuffer(field.value) ? field.value : Buffer.from(String(field.value)));
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${field.contentType || "application/json"}\r\n\r\n`));
      chunks.push(Buffer.from(String(field.value)));
      chunks.push(Buffer.from("\r\n"));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(chunks) };
}

async function robloxFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": apiKey,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const detail = json ? JSON.stringify(json, null, 2) : text;
    fail(`Roblox API request failed (${response.status} ${response.statusText}):\n${detail}`);
  }
  return json ?? text;
}

async function pollOperation(operation) {
  if (!operation || typeof operation !== "object") {
    return operation;
  }
  let operationPath = operation.path;
  if (!operationPath && operation.operationId) {
    operationPath = `operations/${operation.operationId}`;
  }
  if (!operationPath) {
    return operation;
  }
  const operationId = operationPath.split("/").pop();
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = await robloxFetch(`${API_BASE}/assets/v1/operations/${encodeURIComponent(operationId)}`);
    if (result.done) {
      if (result.error) {
        fail(`Roblox asset update operation failed:\n${JSON.stringify(result.error, null, 2)}`);
      }
      return result;
    }
    console.log(`Roblox asset update still processing (${attempt}/30)...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail(`Roblox asset update operation did not finish in time: ${operationPath}`);
}

if (!assetId) {
  fail("Missing ROBLOX_PLUGIN_ASSET_ID.");
}
const assetIdNumber = Number(assetId);
if (!Number.isSafeInteger(assetIdNumber) || assetIdNumber <= 0) {
  fail(`ROBLOX_PLUGIN_ASSET_ID must be a positive safe integer. Received: ${assetId}`);
}
if (!dryRun && !apiKey) {
  fail("Missing ROBLOX_API_KEY.");
}

const luaSource = readFileSync(sourcePath, "utf8");
if (!luaSource.includes("StudioLink")) {
  fail(`Source file does not look like the StudioLink plugin: ${sourcePath}`);
}
if (!luaSource.includes('PLUGIN_VERSION = "1.0.9"')) {
  fail('Expected plugin source to contain PLUGIN_VERSION = "1.0.9".');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(rbxmxPath, buildPluginRbxmx(luaSource), "utf8");
const fileContent = readFileSync(rbxmxPath);
const fileSize = statSync(rbxmxPath).size;

console.log(`Prepared Roblox plugin package: ${path.relative(root, rbxmxPath)} (${fileSize} bytes)`);
console.log(`Target Roblox asset: ${assetId}`);
console.log(`Asset type: ${assetType}`);

if (dryRun) {
  console.log("Dry run only; not publishing to Roblox.");
  process.exit(0);
}

const request = {
  assetId: assetIdNumber,
  assetType,
  displayName,
  description,
};
const { boundary, body } = makeMultipart([
  {
    name: "request",
    value: JSON.stringify(request),
    contentType: "application/json",
  },
  {
    name: "fileContent",
    filename: "StudioLinkPlugin.rbxmx",
    value: fileContent,
    contentType: "application/xml",
  },
]);

const updateUrl = `${API_BASE}/assets/v1/assets/${encodeURIComponent(assetId)}`;
console.log(`Publishing plugin asset with PATCH ${updateUrl}`);
const operation = await robloxFetch(updateUrl, {
  method: "PATCH",
  headers: {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": String(body.length),
  },
  body,
});
console.log(`Roblox update response: ${JSON.stringify(operation, null, 2)}`);
const finalResult = await pollOperation(operation);
console.log(`Roblox plugin publish completed: ${JSON.stringify(finalResult, null, 2)}`);
