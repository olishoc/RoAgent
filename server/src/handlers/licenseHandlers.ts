import { AppError } from "../errors.ts";
import type { Handler } from "../types.ts";
import { ErrorCode, type ClientToServerMessage } from "../../../shared/protocol.ts";

function payload(message: ClientToServerMessage): Record<string, unknown> {
  return message.payload as Record<string, unknown>;
}

export const licenseHandlers: Record<string, Handler> = {
  async "license:activate"(message, context) {
    const licenseKey = payload(message).licenseKey;
    if (typeof licenseKey !== "string") throw new AppError(ErrorCode.LICENSE_INVALID, "License key is invalid", { details: { reason: "INVALID_KEY" } });
    return context.licenseService.activate(licenseKey);
  },

  "license:status"(_message, context) {
    return context.licenseService.status();
  },
};
