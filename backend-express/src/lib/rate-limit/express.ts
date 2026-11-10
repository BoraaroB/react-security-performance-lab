/**
 * Express adapter around express-rate-limit: counts requests per client IP in a time window and answers
 * 429 RATE_LIMITED once a client goes over the limit.
 *
 * Why: it slows down password guessing (brute force, credential stuffing), scraping, and small floods that would
 * otherwise burn CPU (e.g. bcrypt on every login). It is not full DoS protection: big attacks must be stopped
 * before they reach Node (CDN, reverse proxy).
 *
 * The client is identified by `req.ip`. Behind a reverse proxy, set Express `trust proxy` to the number of proxies
 * (or their IPs), never `true`: with `true`, any client can send a fake `X-Forwarded-For` and get a fresh limit.
 */
import type { RequestHandler } from 'express';
import { rateLimit as expressRateLimit, type Store } from 'express-rate-limit';
import { AppError } from '../errors/index.js';

type LogFn = (obj: object, message: string) => void;
type Logger = { warn: LogFn; error: LogFn };

export type RateLimitOptions = {
  /** Length of the time window in milliseconds. */
  windowMs: number;
  /** How many requests one client may send per window. */
  limit: number;
  /** Message in the 429 response. Default: "Too many requests, please try again later." */
  message?: string;
  /** Where hit counts live. Default: memory of this process (see README for multiple instances). */
  store?: Store;
  /** pino-style logger for the library's one-time setup checks (e.g. a bad `trust proxy`). Default: console. */
  logger?: Logger;
};

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { logger, message = 'Too many requests, please try again later.' } = options;

  return expressRateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    ...(options.store ? { store: options.store } : {}),
    ...(logger ? { logger: toLibLogger(logger) } : {}),
    // `RateLimit` and `RateLimit-Policy` headers (IETF draft 8) tell well-behaved clients how much is left.
    // On a 429 the library also sets `Retry-After` (seconds) before it calls the handler below.
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // No `keyGenerator`: the default key is `req.ip`, and for IPv6 the whole /56 block, because one user often owns
    // a whole block and could otherwise switch to a new address for every request.

    // Hand the 429 to the app's error handler, so it has the same JSON shape (code, requestId) and a log line.
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
  });
}

// The library calls `(error, message?)`; pino-style loggers take `(object, message)`. Called as methods
// (`logger.warn(...)`), because pino's methods need `this` and fail when passed around as plain functions.
function toLibLogger(logger: Logger) {
  const fallback = 'express-rate-limit check failed';
  return {
    warn: (error: unknown, message?: string) => logger.warn({ err: error }, message ?? fallback),
    error: (error: unknown, message?: string) => logger.error({ err: error }, message ?? fallback),
  };
}
