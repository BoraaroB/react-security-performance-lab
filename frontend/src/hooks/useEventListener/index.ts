// Adds a window event listener while the component is mounted and removes it on unmount, so no listener outlives
// the component (a memory leak: window keeps the handler and its closure alive, and the handler keeps running).
import { useEffect, useEffectEvent } from 'react';

export type EventListenerHookOptions = {
  // Must be the same in addEventListener and removeEventListener, or the remove does nothing.
  capture?: boolean;
  // `true` promises the handler never calls preventDefault(), so the browser can scroll without waiting for it.
  // Left out = the browser's default (`true` for touchstart, touchmove and wheel on window, else `false`).
  passive?: boolean;
};

export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options: EventListenerHookOptions = {},
): void {
  // No default for `passive`: an explicit `false` would turn off the browser's passive default for scroll events.
  const { capture = false, passive } = options;
  // Always calls the NEWEST handler (fresh state and props), without removing and adding the listener on every render.
  const onEvent = useEffectEvent(handler);

  useEffect(() => {
    // One function for add AND remove: removeEventListener only removes the exact same function reference.
    const listener = (event: WindowEventMap[K]) => onEvent(event);
    window.addEventListener(type, listener, { capture, passive });

    // Runs on unmount and before a new type or new options add their own listener.
    return () => {
      window.removeEventListener(type, listener, { capture });
    };
  }, [type, capture, passive]);
}
