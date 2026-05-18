import type { Env } from "../types.ts";

export async function sendLicenseEmail(env: Env, email: string, licenseKey: string): Promise<void> {
  const downloadUrl = `https://rblxagent.com/download?key=${encodeURIComponent(licenseKey)}`;
  const text = `Thank you for purchasing RblxAgent.\n\nYour license key is:\n\n${licenseKey}\n\nDownload RblxAgent:\n${downloadUrl}\n\nThis key is tied to one machine. If you need to transfer it to a new machine, contact support@rblxagent.com\n\n—\nThe RblxAgent Team`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#111;line-height:1.5">
      <h1>Your RblxAgent license key</h1>
      <p>Thank you for purchasing RblxAgent.</p>
      <p>Your license key is:</p>
      <div style="font-size:24px;font-weight:700;letter-spacing:1px;padding:16px;border-radius:8px;background:#f3f4f6;display:inline-block">${escapeHtml(licenseKey)}</div>
      <p><a href="${downloadUrl}">Download RblxAgent</a></p>
      <p>This key is tied to one machine. If you need to transfer it to a new machine, contact <a href="mailto:support@rblxagent.com">support@rblxagent.com</a>.</p>
      <p>—<br/>The RblxAgent Team</p>
    </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "RblxAgent Licenses <licenses@rblxagent.com>", to: email, subject: "Your RblxAgent license key", text, html }),
  });
  if (!response.ok) throw new Error(`Resend failed: HTTP ${response.status} ${await response.text().catch(() => "")}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}
