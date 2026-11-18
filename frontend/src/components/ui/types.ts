import type { ComponentProps, JSX } from 'react';

// The element's normal props without dangerouslySetInnerHTML, so raw HTML cannot be passed through a UI component.
export type HtmlProps<Tag extends keyof JSX.IntrinsicElements> = Omit<
  ComponentProps<Tag>,
  'dangerouslySetInnerHTML'
>;
