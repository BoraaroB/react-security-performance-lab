import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const srcDir = path.resolve(import.meta.dirname, 'src');

// sonner injects its CSS as a <style> tag. This hash allows exactly that CSS and no other inline style.
// It changes with every sonner version, so sonner is pinned exactly in package.json. After an update, recompute it
// (see docs/prs/23d-preview-csp.md); never fall back to 'unsafe-inline'.
const SONNER_STYLE_HASH = "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='";
// sonner adds the <style> tag empty and fills it a moment later. The browser checks both, so without the hash of
// '' every page load logs a violation. An empty style does nothing, and once text is added it is checked again.
const EMPTY_STYLE_HASH = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  // Only the parsed origin goes into the header: a stray ';' in the env value cannot add its own CSP directive.
  let apiOrigin = '';
  if (env.VITE_API_ORIGIN) {
    if (!URL.canParse(env.VITE_API_ORIGIN)) {
      throw new Error(`VITE_API_ORIGIN is not a valid URL: "${env.VITE_API_ORIGIN}"`);
    }
    apiOrigin = new URL(env.VITE_API_ORIGIN).origin;
  }

  // No inline scripts, no eval, no other hosts: an injected <script> or onerror="..." does not run.
  const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self' ${SONNER_STYLE_HASH} ${EMPTY_STYLE_HASH}`,
    // Images only from our origin: injected HTML cannot load a tracking pixel from another host.
    "img-src 'self'",
    // The API is on another origin; without it every fetch would be blocked.
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    // Stops an injected <base href> from redirecting the app's relative URLs.
    "base-uri 'none'",
    "form-action 'self'",
    // No other site may show this app in a frame (clickjacking).
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': srcDir,
      },
    },
    server: {
      port: 5173,
      // The API allows exactly http://localhost:5173 (CORS, CSRF Origin check, OAuth redirect).
      // Fail instead of silently moving to 5174, where every request would be rejected.
      strictPort: true,
    },
    // `vite preview` (the production build) defaults to 4173, which the API does not allow either.
    // The headers are only here: the dev server needs inline scripts and styles for hot reload.
    preview: {
      port: 5173,
      strictPort: true,
      headers: {
        'Content-Security-Policy': contentSecurityPolicy,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // For old browsers that ignore frame-ancestors.
        'X-Frame-Options': 'DENY',
        // A cross-origin page this app opens (or that opened it) gets no window.opener handle (secure contexts only).
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
  };
});
