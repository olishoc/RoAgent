import type { PolarOrderEvent } from "../types.ts";
import { sendLicenseEmail } from "../services/emailService.ts";
import { createLicense, findLicenseByPolarOrder, logWebhook } from "../services/licenseService.ts";
import { verifyPolarSignature } from "../services/polarService.ts";
import { getDb, type HandlerContext } from "./helpers.ts";

export async function handlePolarWebhook(request: Request, context: HandlerContext): Promise<Response> {
  const rawBody = await request.text();
  const db = getDb(context);
  const signature = request.headers.get("x-polar-signature");
  if (!await verifyPolarSignature(rawBody, signature, context.env.POLAR_WEBHOOK_SECRET)) {
    console.warn("Invalid Polar webhook signature");
    return new Response("invalid signature", { status: 401 });
  }

  let event: PolarOrderEvent;
  try {
    event = JSON.parse(rawBody) as PolarOrderEvent;
  } catch (error) {
    console.error("Invalid Polar webhook JSON", error);
    return new Response("ok", { status: 200 });
  }

  try {
    const eventType = event.type;
    const polarId = String(event.id ?? event.data?.id ?? "");
    if (eventType !== "order.paid" && eventType !== "checkout.order_created") {
      await logWebhook(db, { eventType, polarId, payload: event, processed: false });
      return new Response("ok", { status: 200 });
    }

    const order = extractOrder(event);
    await logWebhook(db, { eventType, polarId: order.polarOrderId, payload: event, processed: false });
    if (order.productId !== context.env.POLAR_PRODUCT_ID) {
      console.warn("Ignoring Polar webhook for different product", order.productId);
      return new Response("ok", { status: 200 });
    }

    const existing = await findLicenseByPolarOrder(db, order.polarOrderId);
    if (existing) return new Response("ok", { status: 200 });

    const license = await createLicense(db, {
      email: order.email,
      polarCustomerId: order.polarCustomerId,
      polarOrderId: order.polarOrderId,
    });
    try {
      await sendLicenseEmail(context.env, license.email, license.license_key);
    } catch (error) {
      console.error("License email failed", error);
    }
    await logWebhook(db, { eventType, polarId: order.polarOrderId, payload: event, processed: true });
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Polar webhook processing failed", error);
    await logWebhook(db, { eventType: event.type, polarId: String(event.id ?? event.data?.id ?? ""), payload: event, processed: false, error: error instanceof Error ? error.message : String(error) });
    return new Response("ok", { status: 200 });
  }
}

function extractOrder(event: PolarOrderEvent): { email: string; polarCustomerId: string; polarOrderId: string; productId: string } {
  const data = event.data ?? {};
  const attrs = data.attributes ?? {};
  const metadata = data.metadata ?? (attrs.metadata as Record<string, unknown> | undefined) ?? {};
  const email = stringValue(attrs.customer_email) ?? stringValue(data.customer_email) ?? stringValue(attrs.email) ?? stringValue(metadata.email);
  const customer = attrs.customer as unknown;
  const product = attrs.product as unknown;
  const polarCustomerId = stringValue(data.customer_id) ?? stringValue(attrs.customer_id) ?? objectId(customer) ?? stringValue(metadata.customer_id);
  const polarOrderId = stringValue(data.id) ?? stringValue(attrs.order_id) ?? stringValue(event.id);
  const productId = stringValue(data.product_id) ?? stringValue(attrs.product_id) ?? objectId(product) ?? stringValue(metadata.product_id);
  if (!email || !polarCustomerId || !polarOrderId || !productId) throw new Error("Polar order is missing required fields");
  return { email, polarCustomerId, polarOrderId, productId };
}

function objectId(value: unknown): string | undefined {
  return value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return undefined;
}
