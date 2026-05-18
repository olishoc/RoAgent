import { AppError } from "../errors.ts";
import type { Handler } from "../types.ts";
import { ErrorCode, type ClientToServerMessage } from "../../../shared/protocol.ts";

function payload(message: ClientToServerMessage): Record<string, unknown> {
  return message.payload as Record<string, unknown>;
}

export const watchHandlers: Record<string, Handler> = {
  "watch:subscribe"(message, context, ws) {
    const p = payload(message);
    const subscriptionId = context.watchService.subscribe(message.placeId, ws, p.includeSource === true);
    return { subscribed: true, subscriptionId, placeId: message.placeId };
  },

  "watch:unsubscribe"(message, context) {
    const subscriptionId = payload(message).subscriptionId;
    if (typeof subscriptionId !== "string" || !subscriptionId) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Missing subscriptionId");
    if (!context.watchService.unsubscribe(subscriptionId)) throw new AppError(ErrorCode.NOT_FOUND, "Subscription not found");
    return { subscribed: false, subscriptionId };
  },
};
