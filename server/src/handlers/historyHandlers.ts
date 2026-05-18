import { AppError } from "../errors.ts";
import type { Handler, HandlerContext } from "../types.ts";
import { ErrorCode, type ClientToServerMessage } from "../../../shared/protocol.ts";

function payload(message: ClientToServerMessage): Record<string, unknown> {
  return message.payload as Record<string, unknown>;
}

function stringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) throw new AppError(ErrorCode.INVALID_PAYLOAD, `Missing ${key}`);
  return value;
}

export const historyHandlers: Record<string, Handler> = {
  async "history:get"(message, context: HandlerContext) {
    const p = payload(message);
    const path = stringField(p, "path");
    return { path, versions: context.historyStore.get(message.placeId, path, p.includeSource !== false) };
  },

  async "history:getDeleted"(message, context: HandlerContext) {
    const p = payload(message);
    return { scripts: context.historyStore.getDeleted(message.placeId, p.includeSource !== false) };
  },
};
