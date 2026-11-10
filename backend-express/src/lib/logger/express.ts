/**
 * Express adapter: one log line per request, plus a request ID that ties together every log line
 * of that request and is sent back to the client in the `X-Request-Id` header.
 *
 * Why: when a user reports "it failed", the request ID from the response lets you find the exact server logs.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import type { Logger } from './core.js';

export interface RequestLoggerOptions {
  logger: Logger;
  /** Log query and body. Useful in development; keep it off in production (privacy, log volume). Default: false. */
  logPayloads?: boolean;
  /**
   * Reuse an incoming `X-Request-Id` (e.g. set by your gateway or load balancer) for end-to-end tracing.
   * Default: false, because clients could otherwise choose IDs to confuse your logs. Enable only behind a trusted proxy.
   */
  trustIncomingRequestId?: boolean;
  /** Default: 'X-Request-Id'. */
  requestIdHeader?: string;
}

// Express adds these fields to Node's request. Typed loosely so the adapter has no hard dependency on Express types.
type ExpressLikeRequest = IncomingMessage & { originalUrl?: string; query?: unknown; body?: unknown };

// Only short, safe characters: an incoming ID ends up in logs, so it must not allow log injection (newlines) or huge values.
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;

/** Path without the query string: query values can hold secrets (reset tokens, OAuth codes). */
function pathOf(req: ExpressLikeRequest): string {
  return (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
}

function hasContent(value: unknown): boolean {
  return value !== undefined && value !== null && (typeof value !== 'object' || Object.keys(value).length > 0);
}

export function createRequestLogger(options: RequestLoggerOptions) {
  const {
    logger,
    logPayloads = false,
    trustIncomingRequestId = false,
    requestIdHeader = 'X-Request-Id',
  } = options;

  function logObject(req: ExpressLikeRequest, res: ServerResponse, responseTime: number) {
    return {
      method: req.method,
      path: pathOf(req),
      statusCode: res.statusCode,
      responseTime,
      // Values here still go through the logger's redaction (e.g. body.password → "[REDACTED]").
      ...(logPayloads && hasContent(req.query) ? { query: req.query } : {}),
      ...(logPayloads && hasContent(req.body) ? { body: req.body } : {}),
    };
  }

  function message(req: ExpressLikeRequest, res: ServerResponse, responseTime: number) {
    return `${req.method} ${pathOf(req)} → ${res.statusCode} (${responseTime} ms)`;
  }

  return pinoHttp<ExpressLikeRequest, ServerResponse>({
    logger,
    genReqId(req, res) {
      const incoming = req.headers[requestIdHeader.toLowerCase()];
      const id =
        trustIncomingRequestId && typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader(requestIdHeader, id);
      return id;
    },
    // `req.log` only carries `reqId`, not the whole request, so app logs stay short but are still traceable.
    quietReqLogger: true,
    quietResLogger: true,
    // 4xx = the client's mistake (warn), 5xx = our bug (error).
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res, responseTime) => message(req, res, responseTime),
    // pino-http passes responseTime as a 4th argument here, but its types leave it out.
    customErrorMessage: (req, res, _error, responseTime?: number) => message(req, res, responseTime ?? 0),
    customSuccessObject: (req, res, val: { responseTime: number }) => logObject(req, res, val.responseTime),
    // No `err` here: for a 5xx, pino-http only has a made-up "failed with status code 500" error with a useless stack.
    // The real error (stack, file:line) is logged by the error handler (lib/errors), with the same reqId.
    customErrorObject: (req, res, _error, val: { responseTime: number }) => logObject(req, res, val.responseTime),
  });
}
