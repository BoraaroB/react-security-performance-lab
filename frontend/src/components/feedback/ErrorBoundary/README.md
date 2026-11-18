# ErrorBoundary

Catches errors thrown while rendering one part of a page and shows a fallback with a "Try again" button there,
so one broken widget does not take the whole page down. It never logs: log every render error in one place with
React 19's `createRoot` options (see below).

## Dependencies
- npm: `react@^19` (the component itself works with React 16.6+; the `onCaughtError` logging needs 19)
- lib: none

## Usage
```tsx
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';

<ErrorBoundary
  fallback={({ reset }) => (
    <div role="alert">
      <p>This widget could not be shown.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )}
>
  <PostsWidget />
</ErrorBoundary>
```

One place to log (in `main.tsx`):
```tsx
createRoot(rootElement, {
  onCaughtError: (error, errorInfo) => console.error(error, errorInfo.componentStack),
  onUncaughtError: (error, errorInfo) => console.error(error, errorInfo.componentStack),
});
```

## Props
| Prop | Type | Description |
|---|---|---|
| `children` | `ReactNode` | The part of the page to protect. |
| `fallback` | `({ error, reset }) => ReactNode` | Shown instead of `children` after an error. `reset()` renders `children` again (fresh: their state was lost). `error` is `unknown`: do not show its message to users. |

Reset from outside: give the boundary a `key` (e.g. `key={userId}`); when the key changes, React creates a new
boundary without the error.

## What it does NOT catch
Only errors thrown while React renders (and in lifecycle methods/effects). Not errors in event handlers
(`onClick`), `setTimeout`, or promises (`fetch`): handle those with `try/catch` and show the error in state.

## How to reuse
Copy `src/components/feedback/ErrorBoundary/`. Frontend imports have no `.js` extension.
