// fetch with a timeout, cancellation, and typed errors (ApiError / NetworkError / TimeoutError) that carry the
// server's error code and request ID. Requests can only go to the configured API origin (no redirects), so the
// body and the headers the client adds never reach another host.
export { createHttpClient, type HttpClient, type HttpClientOptions, type RequestOptions } from './client';
export { ApiError, NetworkError, TimeoutError, type ApiErrorOptions, type FieldError } from './errors';
