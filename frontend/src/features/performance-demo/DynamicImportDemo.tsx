import { useState } from 'react';
import { Alert, Button, Card, FormField, Textarea } from '@/components/ui';

const SAMPLE_HTML = '<p>Hello <b>bold</b> text.</p><img src="x" onerror="alert(\'XSS\')">';

export function DynamicImportDemo() {
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [preview, setPreview] = useState<string | null>(null);
  const [importMs, setImportMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  async function showPreview() {
    setIsLoading(true);
    setHasLoadError(false);
    const start = performance.now();
    let sanitizer: typeof import('@/lib/sanitize');
    try {
      // A string literal, so Vite can see it at build time and put DOMPurify into its own chunk. The first call
      // downloads that chunk; later calls get the already loaded module, so the promise resolves at once.
      sanitizer = await import('@/lib/sanitize');
    } catch {
      // Offline, or a deploy removed the old chunk. Some browsers remember a failed import, so only a reload retries.
      setHasLoadError(true);
      return;
    } finally {
      setIsLoading(false);
    }
    setImportMs(performance.now() - start);
    const sanitized = sanitizer.sanitizeHtml(html);
    setPreview(sanitized);
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Dynamic import() on click</h2>
      <p className="text-sm text-gray-600">
        This page does not load DOMPurify (about 12 kB gzip) until you click the button. Open the Network tab: the
        first click downloads one more JavaScript file, later clicks download nothing. If you opened the Security
        page first, the file is already loaded (both pages share it).
      </p>
      <FormField label="HTML to preview">
        {(control) => <Textarea value={html} onChange={(event) => setHtml(event.target.value)} {...control} />}
      </FormField>
      <Button size="sm" isLoading={isLoading} onClick={showPreview}>
        Preview sanitized HTML
      </Button>
      {importMs !== null && (
        <p className="text-sm text-gray-700">import() took {importMs.toFixed(1)} ms on the last click.</p>
      )}
      {hasLoadError && (
        <Alert variant="error" title="Could not load the sanitizer">
          Check your connection, then reload the page.
        </Alert>
      )}
      {preview !== null && (
        <div className="rounded bg-gray-100 p-2 text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
      )}
    </Card>
  );
}
