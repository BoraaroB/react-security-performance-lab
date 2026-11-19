// App glue: the HTTP client for calls that need the user's session (cookies, access token, CSRF token).
import { API_ORIGIN } from '@/config/http';
import { ApiError, createHttpClient, type ErrorContext, type RequestContext } from '@/lib/http';

const CSRF_PATH = '/api/auth/csrf';
const REFRESH_PATH = '/api/auth/refresh';

type CsrfResponse = {
  csrfToken: string;
};

type RefreshResponse = {
  accessToken: string;
};

// Only in memory, never localStorage: any script that runs on the page (an XSS) can read localStorage.
// A reload loses it; the refresh cookie (httpOnly, so scripts cannot read it) gets a new one.
let accessToken: string | undefined;
// Promises, not values: requests that start at the same time wait for ONE fetch instead of each sending their own.
let csrfTokenPromise: Promise<string> | undefined;
let refreshPromise: Promise<void> | undefined;

export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

// `authHttp` is declared at the bottom. That is fine: these functions only run on a request, after the module has loaded.
async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await authHttp.request<CsrfResponse>(CSRF_PATH);
    return response.csrfToken;
  } catch (error) {
    // Do not keep a failed fetch: the next request tries again.
    csrfTokenPromise = undefined;
    throw error;
  }
}

async function refreshAccessToken(): Promise<void> {
  const tokenBeforeRefresh = accessToken;
  try {
    const response = await authHttp.request<RefreshResponse>(REFRESH_PATH, { method: 'POST' });
    accessToken = response.accessToken;
  } catch (error) {
    // Only a 401 means the session is over. After a network error or a 429 the next call can try again.
    // And a login that finished during the refresh set a NEW token, which must stay.
    const sessionEnded = error instanceof ApiError && error.status === 401;
    if (sessionEnded && accessToken === tokenBeforeRefresh) {
      accessToken = undefined;
    }
    throw error;
  } finally {
    refreshPromise = undefined;
  }
}

async function addAuthHeaders({ method, headers }: RequestContext) {
  if (accessToken !== undefined) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  // The server checks CSRF only on writes. A GET never fetches a token, so the GET /csrf call cannot loop here.
  if (method !== 'GET') {
    if (csrfTokenPromise === undefined) {
      csrfTokenPromise = fetchCsrfToken();
    }
    const csrfToken = await csrfTokenPromise;
    headers.set('X-CSRF-Token', csrfToken);
  }
}

// Both errors come from middleware, before any handler runs, so sending the request again (even a POST) is safe.
async function handleAuthErrors(error: unknown, { path, retry }: ErrorContext) {
  if (!(error instanceof ApiError)) {
    throw error;
  }
  // The CSRF cookie expired or was deleted: forget the token, so the retry fetches a new cookie + token pair.
  if (error.code === 'CSRF_INVALID') {
    csrfTokenPromise = undefined;
    return retry();
  }
  // Never for the refresh itself, nor for the CSRF fetch that the refresh waits for: either would wait for itself forever.
  const isRefreshStep = path === REFRESH_PATH || path === CSRF_PATH;
  if (error.code === 'TOKEN_EXPIRED' && !isRefreshStep) {
    // Single flight: 5 requests that expire together send ONE refresh. Five would use the same refresh token
    // five times, and the server treats reuse as theft and ends the whole session.
    if (refreshPromise === undefined) {
      refreshPromise = refreshAccessToken();
    }
    await refreshPromise;
    return retry();
  }
  throw error;
}

// Cookies ('include') because the API is on another origin: the refresh cookie and the CSRF cookie must be sent.
export const authHttp = createHttpClient({
  apiOrigin: API_ORIGIN,
  credentials: 'include',
  interceptors: {
    onRequest: addAuthHeaders,
    onResponseError: handleAuthErrors,
  },
});
