// Glue: the only place that reads process.env. Everything else receives values from `config`.
import { z } from 'zod';
import { EnvValidationError, loadEnvFile, parseEnv } from '../lib/env/index.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Optional: defaults to 'debug' in development and 'info' in production (see below).
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  // Optional: "true"/"false". Defaults to on in development and off in production (see below).
  ENABLE_DEMO_ROUTES: z.stringbool().optional(),
});

function loadConfig() {
  loadEnvFile();
  try {
    const env = parseEnv(envSchema, process.env);
    return {
      env: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      port: env.PORT,
      logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
      // Demo routes are extra attack surface, so production has them only when someone turns them on explicitly.
      enableDemoRoutes: env.ENABLE_DEMO_ROUTES ?? env.NODE_ENV !== 'production',
    } as const;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();
