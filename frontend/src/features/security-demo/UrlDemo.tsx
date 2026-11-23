import { useState } from 'react';
import { Button, Card, FormField, Input } from '@/components/ui';
import { safeUrl } from '@/lib/sanitize';

type SampleUrl = {
  label: string;
  url: string;
};

const SAFE_SAMPLE = 'https://example.com/profile';

// The tricks with case, spaces and a tab show why a simple `url.startsWith('javascript:')` check is not enough.
const SAMPLE_URLS: SampleUrl[] = [
  { label: 'https', url: SAFE_SAMPLE },
  { label: 'mailto', url: 'mailto:someone@example.com' },
  { label: 'javascript:', url: `javascript:alert('XSS: link')` },
  { label: 'Mixed case + spaces', url: `  JaVaScRiPt:alert('XSS: link')` },
  { label: 'Tab inside', url: `java\tscript:alert('XSS: link')` },
  { label: 'data: HTML', url: `data:text/html,<script>alert('data: page')</script>` },
  { label: 'Fake host', url: 'https://example.com@evil.example/' },
  { label: 'No scheme', url: 'www.example.com' },
];

export function UrlDemo() {
  const [url, setUrl] = useState(SAFE_SAMPLE);
  const checkedUrl = safeUrl(url);

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Dangerous URLs in user links</h2>
      <p className="text-sm text-gray-600">
        React escapes text, but a URL in {'href'} is followed as is: a {'javascript:'} link runs code in this
        page. React 19 turns such an href into one that only throws an error, but it cannot protect
        {' window.location = url'} or {'window.open(url)'}, and it lets other schemes through ({'data:'} pages
        are used for phishing). safeUrl() allows only http, https and mailto.
      </p>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_URLS.map((sample) => (
          <Button key={sample.label} variant="secondary" size="sm" onClick={() => setUrl(sample.url)}>
            {sample.label}
          </Button>
        ))}
      </div>
      <FormField label="User's website (e.g. from a profile)">
        {(control) => <Input value={url} onChange={(event) => setUrl(event.target.value)} {...control} />}
      </FormField>

      <section className="space-y-1">
        <h3 className="text-sm font-medium text-gray-900">safeUrl() result</h3>
        <pre className="rounded bg-gray-100 p-2 text-xs whitespace-pre-wrap break-all">
          {checkedUrl ?? 'undefined (blocked)'}
        </pre>
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium text-gray-900">Rendered link</h3>
        {checkedUrl === undefined ? (
          <p className="text-sm text-gray-600">Website (link removed: not an allowed URL)</p>
        ) : (
          <a href={checkedUrl} className="text-sm text-blue-700 underline">
            Website
          </a>
        )}
      </section>
    </Card>
  );
}
