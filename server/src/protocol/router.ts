import type WebSocket from "ws";
import { AppError, toAppError } from "../errors.ts";
import type { Handler, HandlerContext } from "../types.ts";
import { ErrorCode, type ClientToServerMessage } from "../../../shared/protocol.ts";
import { sendEnvelope, sendError } from "./respond.ts";
import { scriptHandlers } from "../handlers/scriptHandlers.ts";
import { historyHandlers } from "../handlers/historyHandlers.ts";
import { watchHandlers } from "../handlers/watchHandlers.ts";
import { gitHandlers } from "../handlers/gitHandlers.ts";
import { agentHandlers } from "../handlers/agentHandlers.ts";
import { licenseHandlers } from "../handlers/licenseHandlers.ts";
import { daemonHandlers } from "../handlers/daemonHandlers.ts";

const handlers: Record<string, Handler> = {
  ...scriptHandlers,
  ...historyHandlers,
  ...watchHandlers,
  ...gitHandlers,
  ...agentHandlers,
  ...licenseHandlers,
  ...daemonHandlers,
};

export async function dispatchMessage(message: ClientToServerMessage, context: HandlerContext, ws?: WebSocket): Promise<object> {
  const handler = handlers[message.type];
  if (!handler) throw new AppError(ErrorCode.INVALID_PAYLOAD, `Unsupported message type: ${message.type}`);
  if (!ws && message.type === "watch:subscribe") {
    return { subscribed: true, subscriptionId: "http-fallback", placeId: message.placeId };
  }
  return await handler(message, context, ws as WebSocket);
}

export async function routeMessage(message: ClientToServerMessage, context: HandlerContext, ws: WebSocket): Promise<void> {
  const started = performance.now();
  try {
    const payload = await dispatchMessage(message, context, ws);
    sendEnvelope(ws, `${message.type}:response`, message.requestId, message.placeId, payload);
    context.logger.info({ requestId: message.requestId, placeId: message.placeId, type: message.type, success: true, durationMs: Math.round(performance.now() - started) }, "Handler completed");
  } catch (error) {
    const appError = toAppError(error);
    const licenseError = message.type.startsWith("license:") && [ErrorCode.LICENSE_INVALID, ErrorCode.LICENSE_EXPIRED, ErrorCode.LICENSE_ALREADY_ACTIVATED].includes(appError.code);
    sendError(ws, message.requestId, message.placeId, appError, licenseError);
    context.logger.warn({ requestId: message.requestId, placeId: message.placeId, type: message.type, success: false, durationMs: Math.round(performance.now() - started), code: appError.code, retryable: appError.retryable }, "Handler failed");
    context.logger.error(context.logger.sanitizeError(error), "Handler error stack");
  }
}
