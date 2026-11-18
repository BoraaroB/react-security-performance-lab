// One error class per failure kind, so the UI can tell them apart with `instanceof`
// and show the right message (server said no / server unreachable / server too slow).

export type FieldError = {
  field: string;
  message: string;
};

export type ApiErrorOptions = {
  status: number;
  code: string;
  message: string;
  details?: FieldError[];
  requestId?: string;
  retryAfterMs?: number;
};

// The server answered with a 4xx/5xx, or a 2xx body that is not JSON (`INVALID_RESPONSE`).
// Map the UI text by `code`, never by `message`.
export class ApiError extends Error {
  name = 'ApiError';
  readonly status: number;
  readonly code: string;
  readonly details: FieldError[];
  // The server logs every error under this ID; show it so a support ticket can be matched to the log line.
  readonly requestId: string | undefined;
  // From the `Retry-After` header (e.g. on a 429): how long the server asks us to wait.
  readonly retryAfterMs: number | undefined;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? [];
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
  }
}

// No response at all: offline, DNS failure, server down, or blocked by CORS (the browser hides which one).
export class NetworkError extends Error {
  name = 'NetworkError';

  constructor(options?: ErrorOptions) {
    super('The server could not be reached.', options);
  }
}

// No full response within `timeoutMs`; the request was aborted so it does not hang forever.
export class TimeoutError extends Error {
  name = 'TimeoutError';
  readonly timeoutMs: number;

  constructor(timeoutMs: number, options?: ErrorOptions) {
    super(`The server did not respond within ${timeoutMs} ms.`, options);
    this.timeoutMs = timeoutMs;
  }
}
