// Glue: the only place that reads process.env. Everything else receives values from `config`.
import { z } from 'zod';
import { EnvValidationError, loadEnvFile, parseEnv } from '../lib/env/index.js';
import { isExactOrigin } from '../lib/security/index.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Optional: defaults to 'debug' in development and 'info' in production (see below).
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  // Optional: "true"/"false". Defaults to on in development and off in production (see below).
  ENABLE_DEMO_ROUTES: z.stringbool().optional(),
  // Optional: comma-separated browser origins allowed to call the API with cookies (see below for the default).
  CORS_ORIGINS: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.string().refine(isExactOrigin, 'must be an origin like https://app.example.com (no path, no trailing slash, no *)'))
        // An empty value would silently mean "no origins"; to get the default, remove the variable instead.
        .min(1, 'list at least one origin, or remove the variable to use the default'),
    )
    .optional(),
}).superRefine((env, ctx) => {
  // A plain-HTTP page can be changed by anyone on the network (e.g. public Wi-Fi), and its injected script could
  // read credentialed API responses. So production allows only https origins (localhost is fine for local testing).
  if (env.NODE_ENV !== 'production') return;
  for (const origin of env.CORS_ORIGINS ?? []) {
    if (origin.startsWith('http:') && new URL(origin).hostname !== 'localhost') {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'production allows only https origins' });
    }
  }
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
      // Dev: the Vite dev server. Production: no cross-origin access unless configured (the safe default).
      corsOrigins: env.CORS_ORIGINS ?? (env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']),
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
