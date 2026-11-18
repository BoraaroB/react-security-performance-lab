# useOnlineStatus

Returns `false` while the browser is offline, so the UI can tell the user why requests fail (e.g. an offline banner)
instead of showing a generic error. It reads `navigator.onLine` through `useSyncExternalStore`, React's hook for
values that live outside React: the first render already has the right value, and each component's event
listeners are removed when that component unmounts.

## Dependencies
- npm: `react@^18` (`useSyncExternalStore` is new in React 18)
- lib: none

## Usage
```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function OfflineBanner() {
  const isOnline = useOnlineStatus();

  // Keep the live region mounted and change only its content, so screen readers announce the change.
  return <div role="status">{!isOnline && <p>You are offline.</p>}</div>;
}
```

## Return value
| Value | Meaning |
|---|---|
| `false` | The browser has no network connection. Reliable. |
| `true` | The browser is connected to *some* network. The API may still be unreachable (captive Wi-Fi, server down), so keep handling network errors. During server rendering it is always `true`. |

## How to reuse
Copy `src/hooks/useOnlineStatus/`. No npm packages besides React. Frontend imports have no `.js` extension.
Test it in Chrome DevTools: Network tab → throttling → "Offline".
