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
