import { ApiError, NetworkError, TimeoutError } from './errors';

// First backoff step; every retry doubles it (up to 500 ms, 1 s, 2 s, ...).
const BASE_DELAY_MS = 500;
// The server or a proxy is busy, overloaded, or restarting: the same request may work a moment later.
// A 500 is not here: it is a bug in the server code, and the same request would fail again.
const RETRYABLE_STATUSES = [408, 429, 502, 503, 504];
const DELAY_IN_SECONDS = /^\d+$/;
// The only date format HTTP allows today. Date.parse alone is too lenient: it reads "1.5" as a date in 2001.
const HTTP_DATE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

// Retry-After is either a number of seconds ("30") or an HTTP date ("Wed, 18 Nov 2026 12:00:00 GMT").
export function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null) {
    return undefined;
  }
  if (DELAY_IN_SECONDS.test(header)) {
    return Number(header) * 1000;
  }
  // Anything else falls back to our own backoff.
  if (!HTTP_DATE.test(header)) {
    return undefined;
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return undefined;
  }
  return Math.max(0, date - Date.now());
}

// How long to wait before the next attempt, or `undefined` when this error is not worth retrying.
export function getRetryDelayMs(error: unknown, attempt: number, maxDelayMs: number): number | undefined {
  if (error instanceof ApiError) {
    if (!RETRYABLE_STATUSES.includes(error.status)) {
      return undefined;
    }
    // The server said how long to wait: sooner only earns another 429. Longer than the cap would leave
    // the user staring at a spinner, so give up and let the UI show the error.
    if (error.retryAfterMs !== undefined) {
      return error.retryAfterMs <= maxDelayMs ? error.retryAfterMs : undefined;
    }
  } else if (!(error instanceof NetworkError) && !(error instanceof TimeoutError)) {
    // The caller's AbortError or a bug in the calling code: retrying cannot help.
    return undefined;
  }
  // "Full jitter": a random delay up to the step, so clients that failed at the same moment
  // (e.g. a server restart) do not all come back at the same moment and knock it over again.
  const stepMs = Math.min(maxDelayMs, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(Math.random() * stepMs);
}

// A delay that the caller's signal can cancel, so an unmounted component does not keep retrying.
export function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      // A long-lived signal would otherwise keep one listener per retry (a small leak).
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
