/**
 * Framework-free logger factory (pino).
 *
 * Why: logs are often shipped to third-party tools and read by many people, so a password or token in a log
 * line is a leak. Redaction here is a safety net that works no matter which code does the logging.
 */
import { pino, type Logger, type LevelWithSilent } from 'pino';

export type { Logger };

/** Keys whose values are always replaced with "[REDACTED]", wherever they appear in a log object. */
export const DEFAULT_REDACT_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'csrfToken',
  'authorization',
  'cookie',
  'set-cookie',
] as const;

export interface LoggerOptions {
  /** Minimum level to log. Default: 'info'. Use 'debug' in development. */
  level?: LevelWithSilent;
  /** Human-readable, colored output (needs the `pino-pretty` package). Default: false (one JSON object per line). */
  pretty?: boolean;
  /** Extra keys to redact, added to DEFAULT_REDACT_KEYS. */
  redactKeys?: string[];
}

/**
 * Turns key names into pino redact paths. Paths are exact, so we list the key at the top level and up to
 * three levels deep (e.g. `body.password`, `req.headers.authorization`, `body.user.password`).
 */
export function buildRedactPaths(keys: readonly string[]): string[] {
  return keys.flatMap((key) => {
    // Keys like "set-cookie" are not valid JS identifiers, so they need bracket notation.
    const segment = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `["${key}"]`;
    const topLevel = segment.startsWith('.') ? key : segment;
    return [topLevel, `*${segment}`, `*.*${segment}`, `*.*.*${segment}`];
  });
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const { level = 'info', pretty = false, redactKeys = [] } = options;

  return pino({
    level,
    redact: { paths: buildRedactPaths([...DEFAULT_REDACT_KEYS, ...redactKeys]), censor: '[REDACTED]' },
    // ISO time is readable in raw JSON and still sorts correctly in log tools.
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            // These fields are already in the message line ("GET /api/x → 200 (3 ms)  reqId=...").
            ignore: 'pid,hostname,reqId,method,path,statusCode,responseTime',
            messageFormat: '{msg}{if reqId}  reqId={reqId}{end}',
          },
        }
      : undefined,
  });
}
