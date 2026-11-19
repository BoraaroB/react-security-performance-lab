// fetch with a timeout, cancellation, and typed errors (ApiError / NetworkError / TimeoutError) that carry the
// server's error code and request ID. A GET that fails for a passing reason (network, timeout, 429, 503) is
// retried with exponential backoff and jitter, so a short outage does not show an error. Requests can only go to
// the configured API origin (no redirects), so the body and the headers the client adds never reach another host.
// Interceptors let the app add tokens to every request and react to errors (e.g. refresh and retry).
export {
  createHttpClient,
  type ErrorContext,
  type HttpClient,
  type HttpClientOptions,
  type HttpInterceptors,
  type HttpMethod,
  type RequestContext,
  type RequestOptions,
} from './client';
export { ApiError, NetworkError, TimeoutError, type ApiErrorOptions, type FieldError } from './errors';
