// Glue: the only place that reads process.env. Everything else receives values from `config`.
import { z } from 'zod';
import { EnvValidationError, loadEnvFile, parseEnv } from '../lib/env/index.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

function loadConfig() {
  loadEnvFile();
  try {
    const env = parseEnv(envSchema, process.env);
    return {
      env: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      port: env.PORT,
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
