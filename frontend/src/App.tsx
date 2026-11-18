import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';

// Temporary showcase of the UI components; the router (step 16) replaces it with real pages.
export function App() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">React Security &amp; Performance Lab</h1>

      <Card className="flex flex-wrap items-center gap-2">
        <Button>Primary</Button>
        <Button variant="danger">Delete</Button>
        <Button isLoading>Saving</Button>
        <Badge variant="info">admin</Badge>
        <Spinner className="text-blue-600" />
      </Card>

      <Alert variant="error" title="Something went wrong">
        Request ID: 9f2c1a. Please try again.
      </Alert>
    </main>
  );
}
