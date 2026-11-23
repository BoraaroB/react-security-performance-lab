import { useState, type ReactNode, type UIEvent } from 'react';
import { cn } from '@/lib/cn';
import { getVisibleRange } from './core';

export type VirtualListProps<Item> = {
  items: readonly Item[];
  /**
   * Every row has exactly this height in px. Rows of different heights need measuring (a library does that).
   * Must not change while mounted (the stored row would point to the wrong place): remount with `key={rowHeight}`.
   */
  rowHeight: number;
  /** Height of the scroll box in px. */
  height: number;
  /** A stable key per item (an ID), not the index: the index would mix up rows when the items change. */
  getKey: (item: Item, index: number) => string | number;
  renderRow: (item: Item, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  /** Read by screen readers as the name of the list. */
  label?: string;
};

export function VirtualList<Item>({
  items,
  rowHeight,
  height,
  getKey,
  renderRow,
  overscan = 5,
  className,
  label,
}: VirtualListProps<Item>) {
  // The first visible row, not the scroll offset in px: while the user scrolls inside one row the number stays
  // the same, and React skips the render (same state value).
  const [firstVisibleRow, setFirstVisibleRow] = useState(0);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const row = Math.floor(event.currentTarget.scrollTop / rowHeight);
    setFirstVisibleRow(row);
  }

  const range = getVisibleRange({
    firstVisibleRow,
    viewportHeight: height,
    rowHeight,
    itemCount: items.length,
    overscan,
  });

  const rows = [];
  for (let index = range.start; index < range.end; index += 1) {
    // The range never goes past the end of `items`, so the item exists (the cast satisfies noUncheckedIndexedAccess).
    const item = items[index] as Item;
    rows.push(
      <div
        key={getKey(item, index)}
        role="listitem"
        // Only ~20 rows are in the DOM: these tell a screen reader "row 4,512 of 10,000".
        aria-posinset={index + 1}
        aria-setsize={items.length}
        className="absolute inset-x-0"
        // Set from JS (CSSOM), so the CSP without 'unsafe-inline' styles still allows it.
        style={{ top: index * rowHeight, height: rowHeight }}
      >
        {renderRow(item, index)}
      </div>,
    );
  }

  return (
    // tabIndex: keyboard users can focus the box and scroll it with the arrow keys. The name is on the focused
    // element, so a screen reader announces it on Tab.
    <div
      tabIndex={0}
      role="group"
      aria-label={label}
      className={cn('overflow-y-auto', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      {/* As tall as ALL rows together, so the scrollbar looks and works as if every row were there. */}
      <div role="list" className="relative" style={{ height: items.length * rowHeight }}>
        {rows}
      </div>
    </div>
  );
}
