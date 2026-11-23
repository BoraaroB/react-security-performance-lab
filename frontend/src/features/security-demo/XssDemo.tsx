import { useState } from 'react';
import { Button, Card, FormField, Textarea } from '@/components/ui';
import { sanitizeHtml } from '@/lib/sanitize';

type Payload = {
  label: string;
  html: string;
};

// The broken image fires `onerror`: the classic payload, since innerHTML never runs <script> tags.
const IMG_ONERROR = `<img src="x" onerror="alert('XSS: img onerror')">`;

// Each alert names the trick, so it is clear which one ran.
const PAYLOADS: Payload[] = [
  {
    label: 'img onerror',
    html: IMG_ONERROR,
  },
  {
    label: 'javascript: link',
    html: `<a href="javascript:alert('XSS: link')">Click me</a>`,
  },
  {
    label: 'svg onload',
    html: `<svg onload="alert('XSS: svg onload')"></svg>`,
  },
  {
    label: 'CSS overlay',
    html: `<p style="position:fixed;inset:0;margin:0;padding:1rem;background:#b91c1c;color:white">Your session expired. Log in again.</p>`,
  },
  {
    label: 'Safe formatting',
    html: '<p>Hello <b>bold</b> and <i>italic</i> text.</p>',
  },
];

export function XssDemo() {
  const [html, setHtml] = useState(IMG_ONERROR);
  // Raw HTML is rendered only after a click, so typing does not fire an alert on every key.
  const [unsafeHtml, setUnsafeHtml] = useState<string | null>(null);
  // A new key on every click reloads the iframe, so the same payload can be run again.
  const [runCount, setRunCount] = useState(0);
  const sanitized = sanitizeHtml(html);

  // New input hides the old raw output, so box 3 never shows a different payload than the textarea.
  function changeHtml(value: string) {
    setHtml(value);
    setUnsafeHtml(null);
  }

  function renderUnsafe() {
    setUnsafeHtml(html);
    setRunCount(runCount + 1);
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">XSS: rendering user HTML</h2>
      <div className="flex flex-wrap gap-2">
        {PAYLOADS.map((payload) => (
          <Button key={payload.label} variant="secondary" size="sm" onClick={() => changeHtml(payload.html)}>
            {payload.label}
          </Button>
        ))}
      </div>
      <FormField label="User input">
        {(control) => <Textarea value={html} onChange={(event) => changeHtml(event.target.value)} {...control} />}
      </FormField>

      <section className="space-y-1">
        <h3 className="text-sm font-medium text-gray-900">1. As text: {'{html}'} (safe, the default)</h3>
        {/* React escapes text, so the tags are shown as characters and never parsed. */}
        <p className="rounded bg-gray-100 p-2 text-sm break-all">{html}</p>
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium text-gray-900">2. As HTML, sanitized with DOMPurify (safe)</h3>
        <div className="rounded bg-gray-100 p-2 text-sm" dangerouslySetInnerHTML={{ __html: sanitized }} />
        <pre className="text-xs whitespace-pre-wrap break-all text-gray-600">{sanitized}</pre>
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium text-gray-900">3. As raw HTML (unsafe)</h3>
        <p className="text-sm text-gray-600">
          In a real page this code would run with full access to the app. Here it runs in a sandboxed iframe:
          a separate origin that cannot read this page, its cookies or the access token in memory. Unlike innerHTML,
          the iframe parses a full document, so a {'<script>'} tag runs here too.
        </p>
        <Button variant="danger" size="sm" onClick={renderUnsafe}>
          Render without sanitizing
        </Button>
        {unsafeHtml !== null && (
          <iframe
            key={runCount}
            title="Unsanitized HTML"
            // allow-scripts without allow-same-origin: scripts run, but in an opaque origin.
            // allow-modals: only so alert() can show that the code ran.
            sandbox="allow-scripts allow-modals"
            srcDoc={unsafeHtml}
            className="h-32 w-full rounded border border-red-300 bg-white"
          />
        )}
      </section>
    </Card>
  );
}
