/**
 * Express adapter: `validate({ body, params, query })` middleware. It replaces each part with its parsed value,
 * so the handler gets typed, cleaned data. Invalid input goes to the error handler as 400 VALIDATION_ERROR.
 */
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { validateRequest, type RequestSchemas } from './core.js';

// No schema for a part → `unknown`, so the handler cannot use unvalidated input by accident.
type Output<T> = T extends z.ZodType ? z.output<T> : unknown;

export function validate<S extends RequestSchemas>(
  schemas: S,
): RequestHandler<Output<S['params']>, unknown, Output<S['body']>, Output<S['query']>> {
  return async (req, _res, next) => {
    // Express 5 catches the rejected promise (VALIDATION_ERROR) and passes it to the error handler.
    const parsed = await validateRequest(schemas, { params: req.params, query: req.query, body: req.body });

    if ('params' in parsed) req.params = parsed.params as typeof req.params;
    if ('body' in parsed) req.body = parsed.body as typeof req.body;
    // In Express 5 `req.query` is a getter without a setter, so plain assignment throws. Define it on this request instead.
    if ('query' in parsed) Object.defineProperty(req, 'query', { value: parsed.query, enumerable: true, configurable: true });

    next();
  };
}
