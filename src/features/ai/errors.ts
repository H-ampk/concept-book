export type AIErrorCode =
  | "disabled"
  | "connection-failed"
  | "timeout"
  | "model-not-found"
  | "invalid-response"
  | "network"
  | "api-error";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status?: number;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: { status?: number; cause?: unknown }
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = options?.status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isAIError = (error: unknown): error is AIError => error instanceof AIError;
