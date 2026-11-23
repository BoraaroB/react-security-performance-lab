# VirtualList

Renders only the rows you can see (plus a few extra) inside a scroll box. A plain list of 10,000 rows creates
10,000 DOM elements: a slow first render, a lot of memory, and slow layout. `VirtualList` keeps about 20 rows in the
DOM and moves them as you scroll; an inner element as tall as all rows keeps the scrollbar correct.

Limits on purpose (to keep it small and readable): every row has the same height, and the scroll box has a fixed
height. `rowHeight` must not change while mounted; to change it, remount with `key={rowHeight}`. It takes only the
props below (no HTML props passed through). For rows of different heights, a window-level scroll, or grids, use a library such as
`@tanstack/react-virtual`.

## Dependencies
- npm: `react@^19`, `tailwindcss@^4`
- lib: `cn` (imported as `@/lib/cn`)

## Usage
```tsx
import { VirtualList } from '@/components/ui';

<VirtualList
  items={users}
  rowHeight={32}
  height={320}
  getKey={(user) => user.id}
  renderRow={(user) => <span className="px-3">{user.name}</span>}
  label="Users"
  className="rounded border"
/>
```

`getVisibleRange()` from `core.ts` is the same math without React (e.g. for a unit test or another framework).

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `readonly Item[]` | – | All items |
| `rowHeight` | `number` | – | Height of every row in px |
| `height` | `number` | – | Height of the scroll box in px |
| `getKey` | `(item, index) => string \| number` | – | Stable key (an ID, not the index) |
| `renderRow` | `(item, index) => ReactNode` | – | Content of one row |
| `overscan` | `number` | `5` | Extra rows above and below the viewport |
| `className` | `string` | – | Classes for the scroll box |
| `label` | `string` | – | Accessible name of the list |

## How to reuse
Copy `src/components/ui/VirtualList/` and `src/lib/cn/`. Frontend imports have no `.js` extension.
