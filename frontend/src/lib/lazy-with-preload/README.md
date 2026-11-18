# lazy-with-preload

`React.lazy` with a `preload()` method. Lazy pages keep the first download small (each page is its own file,
downloaded only when needed); `preload()` starts that download early, e.g. when the user hovers or focuses a link,
so by the time they click, the code is usually there and no loading spinner is shown.

## Dependencies
- npm: `react@^19` (works with React 18 too)
- lib: none

## Usage
```tsx
import { Suspense } from 'react';
import { lazyWithPreload } from '@/lib/lazy-with-preload';

// The page file must have a default export (same rule as React.lazy).
const SettingsPage = lazyWithPreload(() => import('./pages/SettingsPage'));

<a href="/settings" onMouseEnter={SettingsPage.preload} onFocus={SettingsPage.preload}>Settings</a>

<Suspense fallback={<p>Loading…</p>}>
  <SettingsPage />
</Suspense>
```

## Options
| Argument | Type | Description |
|---|---|---|
| `load` | `() => Promise<{ default: Component }>` | The same function you would pass to `React.lazy`, usually `() => import('./Page')`. |

Returns the lazy component with `preload(): void`. Calling `preload()` many times downloads the file once; the
first render reuses the same download. A preload that failed BEFORE the page is rendered is ignored and
forgotten, so the render calls `import()` again (whether the browser really downloads the file again depends on
the browser). A download that fails WHILE the page renders (also a preload still in flight at the click) is cached
by `React.lazy` for good: catch it with an error boundary and offer a reload.

## How to reuse
Copy `src/lib/lazy-with-preload/`. The import must be a literal `import('./path')` so the bundler (Vite, webpack)
can see it and split the page into its own file. Frontend imports have no `.js` extension.
