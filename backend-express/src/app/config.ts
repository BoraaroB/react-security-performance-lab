// Glue: the only place that reads process.env. Everything else receives values from `config`.
import { isIP } from 'node:net';
import { z } from 'zod';
import { EnvValidationError, loadEnvFile, parseEnv } from '../lib/env/index.js';
import { isExactOrigin } from '../lib/security/index.js';

// Express accepts these names for whole private address ranges in its `trust proxy` list.
const PROXY_RANGE_NAMES = ['loopback', 'linklocal', 'uniquelocal'];

/**
 * `10.0.0.1`, `10.0.0.0/8`, `::1`, or one of PROXY_RANGE_NAMES. Very wide ranges are rejected: `0.0.0.0/0` (or
 * `0.0.0.0/1` + `128.0.0.0/1`) would trust every client, the same as `true`. Wider private ranges: use the names.
 */
function isProxyAddress(entry: string): boolean {
  if (PROXY_RANGE_NAMES.includes(entry)) return true;
  const [ip = '', prefix, ...rest] = entry.split('/');
  const version = isIP(ip);
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  const [min, max] = version === 4 ? [8, 32] : [32, 128];
  return /^\d+$/.test(prefix) && Number(prefix) >= min && Number(prefix) <= max;
}

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
  // Optional: which reverse proxies may tell us the client's IP via X-Forwarded-For. A hop count ("1" = one proxy in
  // front of the app) or a comma-separated list of proxy IPs/CIDRs. Default "0": no proxy, use the socket address.
  // Never "true": then every client could fake its IP with X-Forwarded-For and get a fresh rate limit on each request.
  TRUST_PROXY: z
    .string()
    .default('0')
    .transform((value, ctx) => {
      if (/^\d+$/.test(value) && Number(value) <= 10) return Number(value);
      const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
      if (entries.length > 0 && entries.every(isProxyAddress)) return entries;
      ctx.addIssue({ code: 'custom', message: 'use a hop count (0-10) or a comma-separated list of proxy IPs/CIDRs' });
      return z.NEVER;
    }),
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
      // 0 → false (Express's default), so the rate limiter can warn when X-Forwarded-For arrives without a trusted proxy.
      trustProxy: env.TRUST_PROXY === 0 ? false : env.TRUST_PROXY,
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
