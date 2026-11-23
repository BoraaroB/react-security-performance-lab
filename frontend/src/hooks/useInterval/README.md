# useInterval

Runs a callback every `delayMs` milliseconds while the component is mounted. The interval is cleared when the
component unmounts, so no timer keeps running (and keeps the component's state in memory) after the component is
gone. The callback always sees the newest state and props, and a new callback does not restart the interval.

## Dependencies
- npm: `react@^19.2` (`useEffectEvent` is stable since React 19.2; see "Older React" below)
- lib: none

## Usage
```tsx
import { useState } from 'react';
import { useInterval } from '@/hooks/useInterval';

function Clock() {
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // `seconds` is fresh on every tick: no stale closure, no functional update needed.
  useInterval(() => setSeconds(seconds + 1), isPaused ? null : 1000);

  return <button onClick={() => setIsPaused(!isPaused)}>{seconds} s</button>;
}
```

## Parameters
| Parameter | Type | Description |
|---|---|---|
| `callback` | `() => void` | Called on every tick. Can be a new function on every render. |
| `delayMs` | `number \| null` | Milliseconds between ticks. `null` pauses; a new value restarts the interval. |

## Older React
Before 19.2, keep the newest callback in a ref instead of `useEffectEvent`:
```ts
const callbackRef = useRef(callback);
useLayoutEffect(() => {
  callbackRef.current = callback;
});
// ... and in the interval: setInterval(() => callbackRef.current(), delayMs)
```

## How to reuse
Copy `src/hooks/useInterval/`. No npm packages besides React. Frontend imports have no `.js` extension.
