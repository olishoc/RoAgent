import { ErrorCode } from "../../shared/protocol.ts";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new AppError(ErrorCode.INTERNAL_ERROR, error.message || "Internal error", { cause: error, retryable: false });
  }
  return new AppError(ErrorCode.INTERNAL_ERROR, "Internal error", { retryable: false });
}
