import { Card } from '@/components/ui';

export function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">React Security &amp; Performance Lab</h1>
      <Card className="space-y-2 text-gray-700">
        <p>A learning project: a React 19 frontend for an API that shows web security and performance practices.</p>
        <p>Topics: XSS and CSRF, authentication and roles, API security, rendering, bundle size, memory leaks.</p>
      </Card>
    </div>
  );
}
