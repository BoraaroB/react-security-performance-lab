/**
 * Framework-free request validation with Zod.
 *
 * Why: every value from the client (body, URL params, query string) is untrusted. Checking its shape at the edge
 * means handlers only ever see valid, typed data. `z.object` also drops unknown keys, so a client cannot sneak in
 * fields like `role: "admin"` (mass assignment).
 */
import type { z } from 'zod';
import { AppError, type ErrorDetail } from '../errors/index.js';

export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

export type RequestPart = keyof RequestSchemas;

/**
 * Zod issues → `details` for the error response. `field` is the path inside its part ("title", "tags.0"),
 * so a frontend form can show the message next to the right input. An issue on the whole part uses the part name ("body").
 */
export function toErrorDetails(issues: readonly z.core.$ZodIssue[], part: RequestPart): ErrorDetail[] {
  // Zod's default messages describe the rule ("Too small: expected string to have >=1 characters"), never the input value.
  return issues.map((issue) => ({ field: issue.path.length ? issue.path.join('.') : part, message: issue.message }));
}

/**
 * Validates each given part and returns the parsed values (defaults applied, strings coerced, unknown keys removed).
 * Collects the errors of ALL parts first, so the client can fix everything in one round trip.
 * Throws AppError 400 VALIDATION_ERROR with `details`.
 */
export async function validateRequest(
  schemas: RequestSchemas,
  input: Record<RequestPart, unknown>,
): Promise<Partial<Record<RequestPart, unknown>>> {
  const parsed: Partial<Record<RequestPart, unknown>> = {};
  const details: ErrorDetail[] = [];

  for (const part of ['params', 'query', 'body'] as const) {
    const schema = schemas[part];
    if (!schema) continue;
    // Async parse so schemas with async checks (e.g. "is this email taken?") work too.
    const result = await schema.safeParseAsync(input[part]);
    if (result.success) parsed[part] = result.data;
    else details.push(...toErrorDetails(result.error.issues, part));
  }

  if (details.length) throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', { details });
  return parsed;
}
