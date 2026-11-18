import { useState } from 'react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Alert, Badge, Button, Card, FormField, Input, Select, Spinner, Textarea } from '@/components/ui';

// Demo for the error boundary: the click only sets state; the error is thrown during the next RENDER.
// Throwing inside onClick itself would NOT be caught: boundaries only catch render errors.
function BrokenWidget() {
  const [isBroken, setIsBroken] = useState(false);
  if (isBroken) {
    throw new Error('BrokenWidget failed to render');
  }
  return (
    <Button variant="danger" onClick={() => setIsBroken(true)}>
      Break this widget
    </Button>
  );
}

// Showcase of the UI components (a living style guide), so changes to them can be checked by eye.
export default function ComponentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">UI components</h1>

      <Card className="flex flex-wrap items-center gap-2">
        <Button>Primary</Button>
        <Button variant="danger">Delete</Button>
        <Button isLoading>Saving</Button>
        <Badge variant="info">admin</Badge>
        <Spinner className="text-blue-600" />
      </Card>

      <Card className="space-y-4">
        <FormField label="Email" hint="We never share it.">
          {(control) => <Input type="email" placeholder="you@example.com" {...control} />}
        </FormField>
        <FormField label="Password" error="Password must be at least 8 characters">
          {(control) => <Input type="password" {...control} />}
        </FormField>
        <FormField label="Role">
          {(control) => (
            <Select {...control}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </Select>
          )}
        </FormField>
        <FormField label="Content">{(control) => <Textarea {...control} />}</FormField>
      </Card>

      <Alert variant="error" title="Something went wrong">
        Request ID: 9f2c1a. Please try again.
      </Alert>

      {/* Only this card is replaced on an error; the rest of the page keeps working. */}
      <Card className="space-y-2">
        <h2 className="font-medium text-gray-900">Error boundary</h2>
        <ErrorBoundary
          fallback={({ reset }) => (
            // The error's message is not shown: it can reveal internals. It is logged in main.tsx.
            <Alert variant="error" title="This widget could not be shown">
              <Button className="mt-2" onClick={reset}>
                Try again
              </Button>
            </Alert>
          )}
        >
          <BrokenWidget />
        </ErrorBoundary>
      </Card>
    </div>
  );
}
