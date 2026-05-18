export async function verifyPolarSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  const candidates = parseSignatureHeader(signature);
  return candidates.some((candidate) => timingSafeEqualHex(candidate, expected));
}

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseSignatureHeader(header: string): string[] {
  return header.split(",").map((part) => part.trim()).flatMap((part) => {
    const value = part.includes("=") ? part.split("=").at(-1) : part;
    return value ? [value.trim()] : [];
  });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const aBytes = hexToBytes(a.toLowerCase());
  const bBytes = hexToBytes(b.toLowerCase());
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
