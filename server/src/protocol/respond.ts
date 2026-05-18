import type WebSocket from "ws";
import { ErrorCode, PROTOCOL_VERSION, type Envelope, type ProtocolErrorPayload } from "../../../shared/protocol.ts";
import { AppError, toAppError } from "../errors.ts";

export function sendEnvelope<TType extends string, TPayload extends object>(ws: WebSocket, type: TType, requestId: string, placeId: string, payload: TPayload): void {
  const message: Envelope<TType, TPayload> = {
    version: PROTOCOL_VERSION,
    type,
    requestId,
    placeId,
    payload,
  };
  ws.send(JSON.stringify(message));
}

export function sendError(ws: WebSocket, requestId: string, placeId: string, error: unknown, license = false): void {
  const appError = toAppError(error);
  const payload: ProtocolErrorPayload = {
    code: appError.code,
    message: appError.message,
    retryable: appError.retryable,
    details: appError.details,
  };
  sendEnvelope(ws, license ? "license:error" : "error", requestId || "unknown", placeId || "__global__", payload);
}

export function invalidPayload(message: string): AppError {
  return new AppError(ErrorCode.INVALID_PAYLOAD, message);
}
