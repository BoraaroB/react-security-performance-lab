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
  const Component = lazy(load);

  function preload() {
    // The browser downloads a module once: the render's import() reuses this download.
    // Errors are ignored here; the render calls load() itself and shows its own error.
    load().catch(() => {});
  }

  return Object.assign(Component, { preload });
}
