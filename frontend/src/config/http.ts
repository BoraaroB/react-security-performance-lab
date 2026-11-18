// App glue: the one HTTP client the app uses, configured from the environment.
import { createHttpClient } from '@/lib/http';

const DEV_API_ORIGIN = 'http://localhost:4000';

// VITE_* values are baked into the public JS bundle: only non-secret settings belong there.
let apiOrigin = import.meta.env.VITE_API_ORIGIN;
if (!apiOrigin && import.meta.env.DEV) {
  apiOrigin = DEV_API_ORIGIN;
}
// A production build must not silently call localhost.
if (!apiOrigin) {
  throw new Error('VITE_API_ORIGIN is not set (required for production builds)');
}

// Same rule as the API's config: plain http only for localhost, or tokens would cross the network unencrypted.
const apiUrl = new URL(apiOrigin);
if (import.meta.env.PROD && apiUrl.protocol === 'http:' && apiUrl.hostname !== 'localhost') {
  throw new Error('VITE_API_ORIGIN must use https:// in production (except localhost)');
}

export const http = createHttpClient({ apiOrigin });
