# ErrorState

Shows why data failed to load and a "Try again" button. The text is chosen by the error type (offline, timeout,
too many requests, server problem), never taken from `error.message`, which can reveal internals. For an
`ApiError` it also shows the error code and the server's request ID, so a support ticket can be matched to the log.

## Dependencies
- npm: `react@^19`
- lib: `http` (error classes)
- components: `ui` (`Alert`, `Button`), which needs `lib/cn`

## Usage
```tsx
import { ErrorState } from '@/components/feedback/ErrorState';

const { data, error, reload } = useFetch<Post[]>(http, '/api/posts');
if (error) {
  return <ErrorState error={error} onRetry={reload} title="Could not load the posts" />;
}
```

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `error` | `unknown` | – | The error from the failed request |
| `onRetry` | `() => void` | – | Called by the "Try again" button |
| `title` | `string` | `'Could not load the data'` | The heading |

## How to reuse
Copy `src/components/feedback/ErrorState/`, `src/components/ui/`, `src/lib/cn/` and `src/lib/http/`.
Frontend imports have no `.js` extension.
