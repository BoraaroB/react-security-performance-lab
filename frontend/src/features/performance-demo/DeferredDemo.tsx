import { useDeferredValue, useState } from 'react';
import { Card, FormField, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { SlowList } from './SlowList';

export function DeferredDemo() {
  const [query, setQuery] = useState('');
  const [isDeferred, setIsDeferred] = useState(true);
  // First render: the same value as `query`. After a change, React first renders with the OLD value (so the input
  // updates at once), then renders again with the new value in the background. A new keystroke cancels that render.
  const deferredQuery = useDeferredValue(query);

  let listQuery = query;
  if (isDeferred) {
    listQuery = deferredQuery;
  }
  // The list still shows the old results while the new ones render: dim it so the user knows.
  const isStale = listQuery !== query;

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">useDeferredValue</h2>
      <p className="text-sm text-gray-600">
        The list below is slow on purpose (about 250 ms per render). Without useDeferredValue, every keystroke waits
        for the list, so the input lags. With it, the input updates at once and the list catches up when typing
        pauses. It does not make the list faster: it lets React put the urgent update (the input) first.
      </p>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isDeferred} onChange={(event) => setIsDeferred(event.target.checked)} />
        Use useDeferredValue
      </label>
      <FormField label="Type quickly here">
        {(control) => <Input value={query} onChange={(event) => setQuery(event.target.value)} {...control} />}
      </FormField>
      <div className={cn('transition-opacity', isStale && 'opacity-50')}>
        <SlowList query={listQuery} />
      </div>
    </Card>
  );
}
