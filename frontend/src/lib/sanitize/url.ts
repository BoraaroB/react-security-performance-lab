// Checks a user-supplied URL before it goes into `href`, `src`, `window.location` or `window.open` (XSS protection).
// No DOMPurify here: the browser's own URL parser decides the scheme.

// An allowlist, not a blocklist: a blocklist of `javascript:` still lets through `data:`, `vbscript:`, `file:`
// and app schemes that start installed programs.
const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export type SafeUrlOptions = {
  // Replaces the defaults. Lowercase with the colon, e.g. ['https:'] or ['http:', 'https:', 'mailto:', 'tel:'].
  allowedProtocols?: string[];
};

// Returns the normalized URL, or `undefined` when it is not allowed (`<a href={undefined}>` renders no link).
export function safeUrl(url: string, options: SafeUrlOptions = {}): string | undefined {
  const allowedProtocols = options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  let parsed: URL;
  try {
    // No base URL on purpose: only absolute URLs parse, so "www.example.com" or "/admin" is rejected.
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  // The parser already lowercased the scheme and removed spaces and tabs ("  JaVa\tScript:" → "javascript:").
  if (!allowedProtocols.includes(parsed.protocol)) {
    return undefined;
  }
  // "https://example.com@evil.example" looks like example.com but goes to evil.example (phishing).
  if (parsed.username !== '' || parsed.password !== '') {
    return undefined;
  }
  // Return what was checked, not the raw input, so the browser cannot read it differently.
  return parsed.href;
}
