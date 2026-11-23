import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { API_ORIGIN } from '@/config/http';
import { authHttp } from '@/features/auth/auth.http';
import { ApiError, createHttpClient } from '@/lib/http';

// Any write would do: the CSRF check runs before every web router. This demo route only echoes the body back.
const DEMO_PATH = '/api/demo/validation';
const DEMO_BODY = {
  name: 'CSRF demo',
  email: 'demo@example.com',
};

// Sends cookies like authHttp, but without its interceptors: authHttp adds the real token, and after
// CSRF_INVALID it fetches a new one and retries, so the 403 would never show.
const httpWithoutCsrf = createHttpClient({ apiOrigin: API_ORIGIN, credentials: 'include' });

type Attempt = {
  label: string;
  send: () => Promise<unknown>;
};

const ATTEMPTS: Attempt[] = [
  {
    label: 'No token',
    send: () => httpWithoutCsrf.request(DEMO_PATH, { method: 'POST', body: DEMO_BODY }),
  },
  {
    label: 'Made-up token',
    send: () =>
      httpWithoutCsrf.request(DEMO_PATH, {
        method: 'POST',
        body: DEMO_BODY,
        headers: { 'X-CSRF-Token': 'made-up-token' },
      }),
  },
  {
    label: 'Real token (authHttp)',
    send: () => authHttp.request(DEMO_PATH, { method: 'POST', body: DEMO_BODY }),
  },
];

export function CsrfDemo() {
  const [result, setResult] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function send(attempt: Attempt) {
    setIsSending(true);
    try {
      const data = await attempt.send();
      setResult(`${attempt.label} → 200 OK\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setResult(`${attempt.label} → ${error.status} ${error.code}: ${error.message}`);
      } else {
        setResult(`${attempt.label} → ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">CSRF: forged write requests</h2>
      <p className="text-sm text-gray-600">
        In a CSRF attack another page makes your browser send a request to this API with your cookies. Our
        cookies are SameSite=Strict, so a request from another site carries none. The token covers what SameSite
        does not (a page on the same site, e.g. a sibling subdomain, and older browsers): the API accepts a POST
        only when the X-CSRF-Token header equals the token in the __Host-csrf cookie. Other pages cannot read
        that token (the same-origin policy hides our cookies and the GET /api/auth/csrf response), so they cannot
        send the header. The API also checks the Origin header; the browser sets it and page code cannot change
        it, so try that part with curl.
      </p>
      <div className="flex flex-wrap gap-2">
        {ATTEMPTS.map((attempt) => (
          <Button
            key={attempt.label}
            variant="secondary"
            size="sm"
            disabled={isSending}
            onClick={() => send(attempt)}
          >
            POST with: {attempt.label}
          </Button>
        ))}
      </div>
      {result !== null && (
        <pre className="rounded bg-gray-100 p-2 text-xs whitespace-pre-wrap break-all">{result}</pre>
      )}
    </Card>
  );
}
