import { ApiError, NetworkError, TimeoutError } from '@/lib/http';

// Text by error code, never the server's message: that is written for developers and can change.
// A Map, not an object: a code like "__proto__" from an odd error body must not find Object.prototype.
const AUTH_ERROR_MESSAGES = new Map([
  ['INVALID_CREDENTIALS', 'Wrong email or password.'],
  ['RATE_LIMITED', 'Too many attempts. Please try again later.'],
]);

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// The message for the whole form, when the error does not belong to one field.
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return AUTH_ERROR_MESSAGES.get(error.code) ?? GENERIC_MESSAGE;
  }
  if (error instanceof TimeoutError) {
    return 'The server took too long to answer. Please try again.';
  }
  if (error instanceof NetworkError) {
    return 'The server could not be reached. Check your connection.';
  }
  return GENERIC_MESSAGE;
}

// After a failed GitHub login, the API sends the browser back to /login?error=<code>. Anyone can craft that URL,
// so only these known codes get a message; the text in the URL is never shown (no fake messages on our page).
const OAUTH_ERROR_MESSAGES = new Map([
  ['OAUTH_FAILED', 'GitHub login did not work. Please try again.'],
  ['OAUTH_DENIED', 'GitHub login was cancelled.'],
  ['OAUTH_EMAIL_TAKEN', 'An account with this email already exists. Log in the way you signed up.'],
]);

// `undefined` when there is no code or an unknown one: then the page shows nothing.
export function getOAuthErrorMessage(code: string | null): string | undefined {
  if (code === null) {
    return undefined;
  }
  return OAUTH_ERROR_MESSAGES.get(code);
}
