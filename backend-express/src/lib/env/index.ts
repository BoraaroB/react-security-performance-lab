/**
 * Typed, validated environment variables.
 *
 * Why: a missing or malformed setting (e.g. an empty JWT secret) should stop the server at startup,
 * not cause a security hole or a crash hours later. Validation also gives us real types instead of `string | undefined`.
 */
import { existsSync } from 'node:fs';
import type { z } from 'zod';

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment variables:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Validates `source` (usually `process.env`) against a Zod schema and returns the typed result.
 * Throws `EnvValidationError` listing every problem at once, so you can fix them all in one go.
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.output<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Show the variable name and the rule, never the value: it may be a secret.
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}

/**
 * Loads a `.env` file into `process.env` with Node's built-in loader (Node 20.12+ / 21.7+, no `dotenv` needed).
 * Returns false when the file does not exist. That is normal in production, where the platform sets real env vars.
 * Variables that are already set are NOT overwritten, so the real environment always wins over the file.
 */
export function loadEnvFile(path = '.env'): boolean {
  if (!existsSync(path)) return false;
  process.loadEnvFile(path);
  return true;
}
