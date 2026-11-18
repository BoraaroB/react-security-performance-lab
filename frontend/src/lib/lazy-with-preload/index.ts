// React.lazy plus a preload() method: a page's code is split into its own file (smaller first download),
// and preload() starts that download early (e.g. on link hover), so the page usually opens without a spinner.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// `any` because a component's props can be anything here; the real props type is kept in T.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

export type PreloadableComponent<T extends AnyComponent> = LazyExoticComponent<T> & {
  preload: () => void;
};

export function lazyWithPreload<T extends AnyComponent>(
  load: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
  let pending: Promise<{ default: T }> | undefined;

  // One download, shared by preload() and the first render.
  function loadOnce() {
    if (!pending) {
      pending = load();
      // A failed download is forgotten: a render that starts after a failed preload calls import() again.
      pending.catch(() => {
        pending = undefined;
      });
    }
    return pending;
  }

  function preload() {
    // Errors are ignored here: the render loads again and shows the error there.
    loadOnce().catch(() => {});
  }

  const Component = lazy(loadOnce);
  return Object.assign(Component, { preload });
}
