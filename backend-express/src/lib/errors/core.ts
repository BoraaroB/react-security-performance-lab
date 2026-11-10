/**
 * Framework-free error model: one error class and one JSON error shape for the whole API.
 *
 * Why: clients need a stable `code` to react to (not a message that may change), and a 500 must never leak
 * internals (stack traces, SQL, file paths) that help an attacker. Unknown errors become a generic INTERNAL_ERROR.
 */
import { STATUS_CODES } from 'node:http';

export interface ErrorDetail {
  field: string;
  message: string;
}

/** The JSON body of every error response. */
export interface ErrorBody {
  error: { code: string; message: string; details?: ErrorDetail[]; requestId: string };
}

/**
 * An error that is safe to show to the client: `message` and `details` go into the response as they are.
 * Throw it for expected failures (not found, forbidden, invalid input). Use `cause` to keep the original error for the logs.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, options: { details?: ErrorDetail[]; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (options.details) this.details = options.details;
  }
}

/** "Payload Too Large" → "PAYLOAD_TOO_LARGE" */
function codeForStatus(status: number): string {
  return (STATUS_CODES[status] ?? 'Error').toUpperCase().replace(/\W+/g, '_');
}

/**
 * Turns anything that was thrown into an AppError:
 * - AppError: kept as is.
 * - A client error from a library that follows the `http-errors` convention (`status` 4xx + `expose: true`,
 *   e.g. invalid JSON or a too large body from express.json()): keeps the status, with a generic message.
 * - Everything else is a bug: 500 INTERNAL_ERROR with a generic message. The original error stays in `cause`.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const { status, expose } = (error ?? {}) as { status?: unknown; expose?: unknown };
  if (typeof status === 'number' && status >= 400 && status < 500 && expose === true) {
    // Generic text on purpose: parser messages can echo parts of the request body back.
    return new AppError(status, codeForStatus(status), STATUS_CODES[status] ?? 'Bad Request', { cause: error });
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error', { cause: error });
}

export function toErrorBody(error: AppError, requestId: string): ErrorBody {
  const { code, message, details } = error;
  return { error: { code, message, ...(details ? { details } : {}), requestId } };
}

/**
 * The first stack frame from your own code, e.g. "src/app/routes/posts.ts:42:11", so a log line shows where it broke.
 * Skips node_modules and Node internals. Points to .ts files when source maps are on (tsx, or node --enable-source-maps).
 */
export function sourceLocation(error: unknown, rootDir = process.cwd()): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  for (const line of error.stack.split('\n').slice(1)) {
    const location = /\(?(\S+:\d+:\d+)\)?$/.exec(line.trim())?.[1];
    if (!location || location.startsWith('node:') || location.includes('node_modules')) continue;
    return location.replace('file://', '').replace(`${rootDir}/`, '');
  }
  return undefined;
}
