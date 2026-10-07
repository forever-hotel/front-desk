export type ApiErrorPayload = {
  code?: string;
  error?: string;
  message?: string | string[];
  details?: unknown;
  requestId?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    options?: {
      code?: string;
      details?: unknown;
      requestId?: string;
    },
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    this.requestId = options?.requestId;
  }
}
