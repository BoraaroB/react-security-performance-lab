# useEventListener

Listens to a `window` event (`resize`, `keydown`, `scroll`, `pointermove`, ...) while the component is mounted. The
listener is removed when the component unmounts, so window does not keep the handler (and the component's state in
its closure) in memory, and the handler stops running for a component that is gone. The handler always sees the
newest state and props, and a new handler does not remove and add the listener again.

## Dependencies
- npm: `react@^19.2` (`useEffectEvent` is stable since React 19.2; see "Older React" below)
- lib: none

## Usage
```tsx
import { useState } from 'react';
import { useEventListener } from '@/hooks/useEventListener';

function LastKey() {
  const [lastKey, setLastKey] = useState('');

  // `event` is typed as KeyboardEvent from the event name.
  useEventListener('keydown', (event) => setLastKey(event.key));

  return <p>Last key: {lastKey}</p>;
}
```

## Parameters
| Parameter | Type | Default | Description |
|---|---|---|---|
| `type` | `keyof WindowEventMap` | – | The event name. |
| `handler` | `(event) => void` | – | Called on every event. Can be a new function on every render. |
| `options.capture` | `boolean` | `false` | Listen in the capture phase. |
| `options.passive` | `boolean` | browser default (`true` for `touchstart`/`touchmove`/`wheel` on window, else `false`) | Promise not to call `preventDefault()` (smoother scroll and touch). |

A new `type`, `capture` or `passive` removes the old listener and adds a new one.

## Elements
For an element that React renders, use the JSX prop (`onClick`, `onKeyDown`, ...): React adds and removes those
itself. This hook is for `window`, which no component renders.

## Older React
Before 19.2, keep the newest handler in a ref instead of `useEffectEvent`:
```ts
const handlerRef = useRef(handler);
useLayoutEffect(() => {
  handlerRef.current = handler;
});
// ... and in the effect: const listener = (event) => handlerRef.current(event);
```

## How to reuse
Copy `src/hooks/useEventListener/`. No npm packages besides React. Frontend imports have no `.js` extension.
