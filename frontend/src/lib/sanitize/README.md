# sanitize

`sanitizeHtml()` cleans untrusted HTML with DOMPurify before it is rendered with `dangerouslySetInnerHTML`.
It removes scripts, event handlers (`onerror`, `onload`, ...) and `javascript:` links, so user content cannot run
code in your page (XSS). Plain text does not need it: React escapes `{text}` on its own.

`safeUrl()` checks a user-supplied URL before it goes into `href`, `src`, `window.location` or `window.open`.
Only `http:`, `https:` and `mailto:` pass (an allowlist), so a `javascript:` link cannot run code in your page.

## Dependencies
- npm: `dompurify@^3` (ships its own types)
- lib: none

## Usage
```tsx
import { sanitizeHtml } from '@/lib/sanitize';

function Comment({ html }: { html: string }) {
  // Sanitize right where the HTML is rendered, not when it is saved: the rules can change later.
  return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

sanitizeHtml('<img src=x onerror="alert(1)"><b>hi</b>'); // → '<img src="x"><b>hi</b>'
sanitizeHtml(html, { forbidTags: ['img'] });              // comments without images
```

```tsx
import { safeUrl } from '@/lib/sanitize';

// undefined → <a> without href: shown as text, not a link.
<a href={safeUrl(user.website)}>Website</a>

safeUrl('  JaVaScript:alert(1)');                     // → undefined
safeUrl('https://example.com');                       // → 'https://example.com/' (normalized)
safeUrl('tel:+381601234567', { allowedProtocols: ['tel:'] }); // → 'tel:+381601234567'
```

## Options

`sanitizeHtml(dirty, options?)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `forbidTags` | `string[]` | `[]` | Extra tags to remove. `style`, `form`, `input`, `button`, `select`, `textarea` are always removed. |
| `forbidAttributes` | `string[]` | `[]` | Extra attributes to remove. `style`, `class` and `data-*` are always removed. |

`safeUrl(url, options?)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `allowedProtocols` | `string[]` | `['http:', 'https:', 'mailto:']` | Replaces the defaults. Lowercase with the colon. Never add `javascript:`, `data:` or `vbscript:`. |

Always on (`sanitizeHtml`): the HTML profile only (no SVG or MathML). `class` and `data-*` are removed because they can reuse the
app's own CSS (e.g. Tailwind's `fixed inset-0`) to draw a fake login box over the page. DOMPurify's defaults also drop
`target`, so links cannot open a new tab with access to `window.opener`.

## Notes
- `safeUrl` accepts absolute URLs only: `www.example.com` and `/admin` return `undefined`. App paths come from your
  router, not from user input. It returns the parsed `href`, so what was checked is exactly what the browser gets.
- React 19 already replaces a `javascript:` href with one that throws, but not other schemes, and not
  `window.location = url` / `window.open(url)`. Validate stored links on the server too.
- `data:` is blocked too: modern browsers do not open a `data:` page in the whole tab and give it no access to your
  origin, but it is still used for phishing pages (and was XSS in older browsers).
- `safeUrl` checks the scheme, not the host: `https://evil.example` passes. For redirects (`?next=...`) use a
  same-origin check or a host allowlist instead (open redirect). URLs with a user name (`https://example.com@evil.example`)
  are rejected, because they look like a different host.
- `window.open` needs `noopener`, or the opened page can send your tab elsewhere through `window.opener`:
  `window.open(target, '_blank', 'noopener,noreferrer')`.
- `safeUrl` does not use DOMPurify (it lives in `url.ts`). Import `@/lib/sanitize/url` directly if a bundle should not
  include DOMPurify.
- Browser only. Without a DOM (Node, SSR) DOMPurify would return the input unchanged, so `sanitizeHtml` throws instead.
- `<img src>` to any host is kept, so an image can work as a tracking pixel (viewer IP, page URL).
  Use `forbidTags: ['img']`, or limit `img-src` in a Content Security Policy (step 23d).
- Sanitizing is the second line of defense; a Content Security Policy is the next one (step 23d).

## How to reuse
Copy `src/lib/sanitize/` and run `npm install dompurify`. Frontend imports have no `.js` extension
(unlike `backend-express`).
