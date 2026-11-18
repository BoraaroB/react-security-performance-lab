// Tells a component whether the browser is offline, so the UI can say why requests fail instead of
// showing a generic error. Built on useSyncExternalStore: no stale first render, no missed events.
import { useSyncExternalStore } from 'react';

// Outside the hook on purpose: a new function on every render would make React unsubscribe and subscribe again.
function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  // React calls this on unmount, so no listener outlives the component (no memory leak).
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// Server rendering has no navigator: assume online, so no offline banner flashes before the page hydrates.
function getServerSnapshot() {
  return true;
}

// `false` is reliable (no network at all). `true` only means "connected to some network", not that the API
// is reachable: the http client's NetworkError still covers that case.
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
