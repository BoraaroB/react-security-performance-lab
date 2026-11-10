/**
 * Express adapter: a JSON 404 for unknown routes and one central error handler.
 *
 * Why: without these, Express answers with an HTML page and, outside production, prints the stack trace into
 * the response. Here every error gets the same JSON shape, and the details go only to the server log.
 * Express 5 forwards errors from async handlers here too, so no try/catch is needed in routes.
 */
import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { AppError, sourceLocation, toAppError, toErrorBody } from './core.js';

type LogFn = (obj: object, message: string) => void;

// `req.id` and `req.log` are set by a request logger (lib/logger or pino-http). Without one we fall back to console.
type RequestWithContext = Request & { id?: unknown; log?: { warn: LogFn; error: LogFn } };

const consoleLog = {
  warn: (obj: object, message: string) => console.warn(message, obj),
  error: (obj: object, message: string) => console.error(message, obj),
};

/** Put it after all routes: any request that reaches it matched no route. */
export function notFoundHandler(): RequestHandler {
  // The path is not echoed back: reflecting user input in responses is a habit to avoid.
  return (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

/** Put it last, after notFoundHandler(). Express recognizes an error handler by its 4 parameters. */
export function errorHandler(): ErrorRequestHandler {
  return (error, req, res, next) => {
    // Too late to send JSON (a streamed response already started): let Express close the connection.
    if (res.headersSent) return next(error);

    const { id, log = consoleLog } = req as RequestWithContext;
    const requestId = id === undefined ? 'unknown' : String(id);
    const appError = toAppError(error);

    if (appError.status >= 500) {
      // A bug: log the ORIGINAL error with its stack and where it happened. The client only sees the generic message.
      const original = appError.cause ?? appError;
      const message = original instanceof Error ? original.message : String(original);
      log.error({ err: original, source: sourceLocation(original) }, `${appError.code}: ${message}`);
    } else {
      // A client mistake: one short line is enough, no stack.
      log.warn({}, `${appError.code}: ${appError.message}`);
    }

    res.status(appError.status).json(toErrorBody(appError, requestId));
  };
}
