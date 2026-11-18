import { ApiError, NetworkError, TimeoutError, type FieldError } from './errors';
import { getRetryDelayMs, parseRetryAfterMs, wait } from './retry';

export type HttpClientOptions = {
  // Exact origin of the API, e.g. 'https://api.example.com' (no path, no trailing slash).
  apiOrigin: string;
  // Default: 10 s. Without a timeout, fetch can wait for minutes on a hanging server.
  timeoutMs?: number;
  // Default: 'same-origin'. Use 'include' only when the API is on another origin and needs its cookies.
  credentials?: RequestCredentials;
  // Default: 2. Extra attempts for a GET after a network error, a timeout, or a 408/429/502/503/504.
  retries?: number;
  // Default: 10 s. The longest wait between attempts; a longer Retry-After means "give up now".
  maxRetryDelayMs?: number;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  // Sent as JSON.
  body?: unknown;
  // Lets the caller cancel (e.g. when a component unmounts).
  signal?: AbortSignal;
  // Overrides the client's timeout for this request (each attempt gets the full timeout).
  timeoutMs?: number;
  // Overrides the client's retries for this request (GET only).
  retries?: number;
};

export type HttpClient = {
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const apiOrigin = new URL(options.apiOrigin).origin;
  if (apiOrigin !== options.apiOrigin) {
    throw new Error(`apiOrigin must be an origin like https://api.example.com, got "${options.apiOrigin}"`);
  }
  const defaultTimeoutMs = options.timeoutMs ?? 10_000;
  const credentials = options.credentials ?? 'same-origin';
  const defaultRetries = options.retries ?? 2;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 10_000;
  // NaN here would make every delay NaN, and setTimeout(NaN) fires at once: a tight retry loop.
  if (!Number.isFinite(maxRetryDelayMs) || maxRetryDelayMs <= 0) {
    throw new Error(`maxRetryDelayMs must be a positive number, got ${maxRetryDelayMs}`);
  }

  async function requestOnce<T>(path: string, requestOptions: RequestOptions): Promise<T> {
    // '//evil.com/x' or 'https://evil.com' would leave our API. The body and the headers this client adds
    // (the access token and CSRF token from step 21) must never go to another host.
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin) {
      throw new Error(`Request path must stay on the API origin, got "${path}"`);
    }

    const timeoutMs = requestOptions.timeoutMs ?? defaultTimeoutMs;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signals = requestOptions.signal ? [requestOptions.signal, timeoutSignal] : [timeoutSignal];
    const signal = AbortSignal.any(signals);

    const method = requestOptions.method ?? 'GET';
    // fetch rejects a GET with a body; without this check that bug would look like a NetworkError.
    if (method === 'GET' && requestOptions.body !== undefined) {
      throw new Error('A GET request cannot have a body');
    }

    const headers = new Headers({ Accept: 'application/json' });
    let body: string | undefined;
    if (requestOptions.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(requestOptions.body);
    }

    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        credentials,
        signal,
        // A redirect to another host would carry our headers there (the origin check covers only the first hop).
        redirect: 'error',
      });
      // Reading the body is inside the try, so the timeout also covers a body that arrives slowly.
      text = await response.text();
    } catch (error) {
      // The caller cancelled on purpose: rethrow the AbortError as is, it is not a failure to show.
      if (requestOptions.signal?.aborted) {
        throw error;
      }
      if (timeoutSignal.aborted) {
        throw new TimeoutError(timeoutMs, { cause: error });
      }
      throw new NetworkError({ cause: error });
    }

    let data: unknown = undefined;
    let isJson = true;
    if (text !== '') {
      try {
        data = JSON.parse(text);
      } catch {
        isJson = false;
      }
    }

    if (!response.ok) {
      // Our API's error format: { error: { code, message, details?, requestId } }. A proxy's HTML 502 page has none
      // of it, so every field falls back to a generic value.
      const errorBody = (data as { error?: Record<string, unknown> } | null | undefined)?.error;
      const code = errorBody?.code;
      const message = errorBody?.message;
      const details = errorBody?.details;
      const requestId = errorBody?.requestId;
      throw new ApiError({
        status: response.status,
        code: typeof code === 'string' ? code : `HTTP_${response.status}`,
        message: typeof message === 'string' ? message : `Request failed with status ${response.status}`,
        // The items are trusted to be { field, message }, like the success data below.
        details: Array.isArray(details) ? (details as FieldError[]) : [],
        requestId: typeof requestId === 'string' ? requestId : (response.headers.get('X-Request-Id') ?? undefined),
        retryAfterMs: parseRetryAfterMs(response.headers.get('Retry-After')),
      });
    }

    if (!isJson) {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'The server sent a response that is not JSON.',
        requestId: response.headers.get('X-Request-Id') ?? undefined,
      });
    }

    // Not checked at runtime: the caller trusts the API's shape (a Zod parse could go here later).
    return data as T;
  }

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    // Only GET is retried: a POST whose response was lost may already have created the post,
    // and sending it again would create a second one.
    const method = requestOptions.method ?? 'GET';
    const retries = method === 'GET' ? (requestOptions.retries ?? defaultRetries) : 0;
    // `attempt >= NaN` (or Infinity) is never true: the loop would hit a failing server forever.
    if (!Number.isInteger(retries) || retries < 0) {
      throw new Error(`retries must be a whole number of 0 or more, got ${retries}`);
    }

    let attempt = 0;
    while (true) {
      try {
        return await requestOnce<T>(path, requestOptions);
      } catch (error) {
        const delayMs = getRetryDelayMs(error, attempt, maxRetryDelayMs);
        if (attempt >= retries || delayMs === undefined) {
          throw error;
        }
        await wait(delayMs, requestOptions.signal);
        attempt += 1;
      }
    }
  }

  return { request };
}
