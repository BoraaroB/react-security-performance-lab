// Framework-free math: which rows of a fixed-row-height list are visible, so only those get rendered.

export type VisibleRangeOptions = {
  /** Index of the row at the top edge of the viewport (scrollTop / rowHeight, rounded down). */
  firstVisibleRow: number;
  viewportHeight: number;
  rowHeight: number;
  itemCount: number;
  /** Extra rows above and below the viewport, so a fast scroll does not show empty space for a frame. */
  overscan: number;
};

/** The rows to render: `start` is included, `end` is not. */
export type VisibleRange = {
  start: number;
  end: number;
};

export function getVisibleRange(options: VisibleRangeOptions): VisibleRange {
  // +1: when the viewport stops in the middle of a row, part of a row shows at the top AND at the bottom.
  const visibleRowCount = Math.ceil(options.viewportHeight / options.rowHeight) + 1;
  // When the items shrink while scrolled far down, the stored row can be past the end: show the last rows instead.
  const lastFirstRow = Math.max(0, options.itemCount - visibleRowCount);
  const firstRow = Math.min(options.firstVisibleRow, lastFirstRow);
  const start = Math.max(0, firstRow - options.overscan);
  const end = Math.min(options.itemCount, firstRow + visibleRowCount + options.overscan);
  return { start, end };
}
