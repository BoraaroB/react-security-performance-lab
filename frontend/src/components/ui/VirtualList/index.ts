// Renders only the rows that are visible in a scroll box, so a list of 10,000 items keeps ~20 rows in the DOM:
// fast first render, low memory, smooth scrolling.
export { getVisibleRange, type VisibleRange, type VisibleRangeOptions } from './core';
export { VirtualList, type VirtualListProps } from './VirtualList';
