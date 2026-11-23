import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { http } from '@/config/http';
import { ApiError } from '@/lib/http';

// The server allows 5 requests per minute per IP address on this route.
const RATE_LIMIT_PATH = '/api/demo/rate-limit';

export function RateLimitDemo() {
  const [results, setResults] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  async function sendRequest() {
    setIsSending(true);
    const label = `Request ${results.length + 1}`;
    let result: string;
    try {
      // retries: 0, or the client could wait out a short Retry-After and send the request again, hiding the 429.
      await http.request(RATE_LIMIT_PATH, { retries: 0 });
      result = `${label} → 200 OK`;
    } catch (error) {
      if (error instanceof ApiError && error.retryAfterMs !== undefined) {
        const seconds = Math.ceil(error.retryAfterMs / 1000);
        result = `${label} → ${error.status} ${error.code}, Retry-After: ${seconds} s`;
      } else if (error instanceof ApiError) {
        result = `${label} → ${error.status} ${error.code}`;
      } else {
        result = `${label} → ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } finally {
      setIsSending(false);
    }
    setResults((previous) => [...previous, result]);
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Rate limiting</h2>
      <p className="text-sm text-gray-600">
        The API counts requests per IP address, so one client cannot flood it or guess passwords quickly (login
        and register have their own strict limits). This demo route allows 5 requests per minute; the 6th gets
        429 RATE_LIMITED and a Retry-After header with the seconds to wait. DevTools → Network shows two
        RateLimit headers on every response (r = requests left): one for the global limit, one for this route.
      </p>
      <Button variant="secondary" size="sm" disabled={isSending} onClick={sendRequest}>
        Send a request
      </Button>
      {results.length > 0 && (
        <ol className="space-y-1 rounded bg-gray-100 p-2 font-mono text-xs">
          {/* Append-only list, so the index is a stable key. */}
          {results.map((result, index) => (
            <li key={index}>{result}</li>
          ))}
        </ol>
      )}
    </Card>
  );
}
