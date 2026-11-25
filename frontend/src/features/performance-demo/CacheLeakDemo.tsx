import { useState } from 'react';
import { Button, Card } from '@/components/ui';

const REPORTS_PER_CLICK = 10;
const BOUNDED_CACHE_LIMIT = 5;
// 131,072 numbers × 8 bytes = 1 MiB (about 1 MB) per report, so the growth is easy to see in a heap snapshot.
const NUMBERS_PER_REPORT = 131_072;

// A class (not a plain object), so a heap snapshot lists these objects under the name "Report".
class Report {
  readonly id: number;
  readonly numbers: Float64Array;

  constructor(id: number) {
    this.id = id;
    this.numbers = new Float64Array(NUMBERS_PER_REPORT);
    // Writing every number makes the browser really allocate the memory.
    this.numbers.fill(id);
  }
}

// Module scope, like a cache in an API helper: it lives as long as the page, not as long as this component.
let nextReportId = 1;
// BUG on purpose: every new key adds an entry and nothing is ever removed, so memory only grows.
const unboundedCache = new Map<number, Report>();
// The fix: at most BOUNDED_CACHE_LIMIT entries, the oldest one is removed first.
const boundedCache = new Map<number, Report>();

function readCacheSizes() {
  return {
    unbounded: unboundedCache.size,
    bounded: boundedCache.size,
  };
}

export function CacheLeakDemo() {
  // Starts from the module caches, so coming back to this page shows what they still hold.
  const [sizes, setSizes] = useState(readCacheSizes);

  function handleAddUnbounded() {
    for (let i = 0; i < REPORTS_PER_CLICK; i += 1) {
      const report = new Report(nextReportId);
      nextReportId += 1;
      unboundedCache.set(report.id, report);
    }
    setSizes(readCacheSizes());
  }

  function handleAddBounded() {
    for (let i = 0; i < REPORTS_PER_CLICK; i += 1) {
      const report = new Report(nextReportId);
      nextReportId += 1;
      boundedCache.set(report.id, report);
      if (boundedCache.size > BOUNDED_CACHE_LIMIT) {
        // A Map keeps insertion order, so the first key is the oldest entry. Once deleted, nothing references that
        // report any more and the garbage collector can free it.
        // `value` is undefined only for an empty Map, which cannot happen here; the check is for TypeScript.
        const oldestId = boundedCache.keys().next().value;
        if (oldestId !== undefined) {
          boundedCache.delete(oldestId);
        }
      }
    }
    setSizes(readCacheSizes());
  }

  function handleClear() {
    unboundedCache.clear();
    boundedCache.clear();
    setSizes(readCacheSizes());
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Memory leak: a cache that grows forever</h2>
      <p className="text-sm text-gray-600">
        Apps often keep a cache in a module-level Map (for example API responses by URL). When the keys keep
        changing (a new search, a new page), an unbounded cache only grows: it lives as long as the page, so its
        entries are never garbage collected. Each report holds about 1 MB. The bounded cache keeps only the newest{' '}
        {BOUNDED_CACHE_LIMIT}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleAddUnbounded}>
          Add {REPORTS_PER_CLICK} reports to the unbounded cache
        </Button>
        <Button variant="secondary" onClick={handleAddBounded}>
          Add {REPORTS_PER_CLICK} reports to the bounded cache
        </Button>
        <Button variant="secondary" onClick={handleClear}>
          Clear both caches
        </Button>
      </div>
      <ul className="space-y-1 text-sm text-gray-700">
        <li>Unbounded cache: {sizes.unbounded} reports (~{sizes.unbounded} MB)</li>
        <li>
          Bounded cache: {sizes.bounded} reports (~{sizes.bounded} MB, limit {BOUNDED_CACHE_LIMIT})
        </li>
      </ul>
      <div className="space-y-1 text-sm text-gray-600">
        <p>Find the leak with a heap snapshot (on the dev server; the production build shortens names like Report):</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>DevTools → Memory → Heap snapshot → Take snapshot.</li>
          <li>Add reports to the unbounded cache 3 times, then take a second snapshot.</li>
          <li>
            Switch the view to Comparison and type Report in the class filter: 30 new objects. Click one: the
            Retainers panel shows what keeps it alive, the unboundedCache Map.
          </li>
          <li>Clear both caches and take a third snapshot: the reports are gone (nothing holds them any more).</li>
        </ol>
      </div>
    </Card>
  );
}
