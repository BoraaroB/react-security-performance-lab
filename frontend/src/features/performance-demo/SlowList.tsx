import { memo } from 'react';

// 250 rows × ~1 ms each (Apple M-series Mac; slower CPUs take longer) ≈ 250 ms per render.
// Many small rows, not one big loop: React can pause a background render only between components (about every 5 ms).
const ROW_COUNT = 250;
const WORK_PER_ROW = 2_000_000;

type SlowRowProps = {
  text: string;
};

function SlowRow({ text }: SlowRowProps) {
  // Stands in for an expensive component (a chart, a big table cell). Never block the main thread like this in real code.
  // Pure math, not a clock-based wait: a render must not read the clock (react-hooks/purity).
  let checksum = 0;
  for (let index = 0; index < WORK_PER_ROW; index += 1) {
    checksum += Math.sqrt(index);
  }
  // The result must be used: the production build removes side-effect-free work whose result is ignored.
  return (
    <li data-checksum={checksum} className="text-xs text-gray-700">
      {text}
    </li>
  );
}

export type SlowListProps = {
  query: string;
};

// memo is required: the parent re-renders on every keystroke, and without memo the list would re-render with it,
// even when its deferred `query` has not changed yet. Then useDeferredValue would save nothing.
export const SlowList = memo(function SlowList({ query }: SlowListProps) {
  const rows = [];
  for (let index = 1; index <= ROW_COUNT; index += 1) {
    rows.push(<SlowRow key={index} text={`Result ${index} for "${query}"`} />);
  }
  return <ul className="max-h-48 space-y-0.5 overflow-y-auto">{rows}</ul>;
});
