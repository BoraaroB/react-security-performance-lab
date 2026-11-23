import { useState } from 'react';
import { Card, VirtualList } from '@/components/ui';

// Built once when the module loads, not on every render.
const ROWS = Array.from({ length: 10_000 }, (_, index) => `Row ${index + 1}`);
// Must match the Tailwind classes below: h-8 = 32 px per row, h-80 = 320 px for the box.
const ROW_HEIGHT = 32;
const LIST_HEIGHT = 320;
const ROW_CLASSES = 'flex h-8 items-center border-b border-gray-100 px-3 text-sm text-gray-700';

export function VirtualListDemo() {
  const [isVirtual, setIsVirtual] = useState(true);

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Virtual list</h2>
      <p className="text-sm text-gray-600">
        10,000 rows. A plain list puts all 10,000 in the DOM, so switching to it takes several times longer (on a
        phone, or with real rows full of buttons and images, you feel it). The virtual list renders only the ~20 rows
        you can see and swaps them while you scroll. Check it in DevTools → Elements.
      </p>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isVirtual} onChange={(event) => setIsVirtual(event.target.checked)} />
        Render only the visible rows
      </label>
      {isVirtual ? (
        <VirtualList
          items={ROWS}
          rowHeight={ROW_HEIGHT}
          height={LIST_HEIGHT}
          getKey={(row) => row}
          renderRow={(row) => <span className={ROW_CLASSES}>{row}</span>}
          label="10,000 rows"
          className="rounded border border-gray-200"
        />
      ) : (
        <ul aria-label="10,000 rows" className="h-80 overflow-y-auto rounded border border-gray-200">
          {ROWS.map((row) => (
            <li key={row} className={ROW_CLASSES}>
              {row}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
