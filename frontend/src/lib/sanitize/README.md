# sanitize

`sanitizeHtml()` cleans untrusted HTML with DOMPurify before it is rendered with `dangerouslySetInnerHTML`.
It removes scripts, event handlers (`onerror`, `onload`, ...) and `javascript:` links, so user content cannot run
code in your page (XSS). Plain text does not need it: React escapes `{text}` on its own.

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

## Options
| Option | Type | Default | Description |
|---|---|---|---|
| `forbidTags` | `string[]` | `[]` | Extra tags to remove. `style`, `form`, `input`, `button`, `select`, `textarea` are always removed. |
| `forbidAttributes` | `string[]` | `[]` | Extra attributes to remove. `style`, `class` and `data-*` are always removed. |

Always on: the HTML profile only (no SVG or MathML). `class` and `data-*` are removed because they can reuse the
app's own CSS (e.g. Tailwind's `fixed inset-0`) to draw a fake login box over the page. DOMPurify's defaults also drop
`target`, so links cannot open a new tab with access to `window.opener`.

## Notes
- Browser only. Without a DOM (Node, SSR) DOMPurify would return the input unchanged, so `sanitizeHtml` throws instead.
- `<img src>` to any host is kept, so an image can work as a tracking pixel (viewer IP, page URL).
  Use `forbidTags: ['img']`, or limit `img-src` in a Content Security Policy (step 23d).
- Sanitizing is the second line of defense; a Content Security Policy is the next one (step 23d).

## How to reuse
Copy `src/lib/sanitize/` and run `npm install dompurify`. Frontend imports have no `.js` extension
(unlike `backend-express`).
