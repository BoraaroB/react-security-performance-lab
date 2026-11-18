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
| `load` | `() => Promise<{ default: Component }>` | A plain `() => import('./Page')`. It is called by `preload()` and by the render, so any extra work in a custom loader (a fetch, a retry wrapper) would run more than once; only the module download is shared by the browser. |

Returns the lazy component with `preload(): void`, which only calls `load()` early. The module keeps no cache of
its own: the browser downloads a module once per page, and every later `import()` of the same file (more hovers,
the render) reuses that download, even one still in flight. A failed `preload()` is ignored; the render calls
`load()` itself (whether the browser downloads a failed file again depends on the browser). A failed render is
cached by `React.lazy` for good: catch it with an error boundary and offer a reload.

## How to reuse
Copy `src/lib/lazy-with-preload/`. The import must be a literal `import('./path')` so the bundler (Vite, webpack)
can see it and split the page into its own file. Frontend imports have no `.js` extension.
