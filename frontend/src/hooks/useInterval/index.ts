// Runs a callback every `delayMs` while the component is mounted. The interval is cleared on unmount, so it cannot
// keep running for a component that is gone (a memory leak: the timer keeps the callback and its state alive).
import { useEffect, useEffectEvent } from 'react';

// `delayMs: null` pauses the interval.
export function useInterval(callback: () => void, delayMs: number | null): void {
  // Always calls the NEWEST callback (fresh state and props), without restarting the interval on every render.
  const onTick = useEffectEvent(callback);

  useEffect(() => {
    if (delayMs === null) {
      return;
    }
    const intervalId = setInterval(() => onTick(), delayMs);

    // Runs on unmount and before a new delay starts its own interval.
    return () => {
      clearInterval(intervalId);
    };
  }, [delayMs]);
}
