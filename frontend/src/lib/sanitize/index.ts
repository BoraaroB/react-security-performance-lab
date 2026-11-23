// Cleans untrusted HTML before it goes into `dangerouslySetInnerHTML` (XSS protection).
// Plain text never needs this: React escapes `{text}` on its own.
// `safeUrl` (in url.ts) checks user URLs; it does not need DOMPurify.
import DOMPurify from 'dompurify';

export type SanitizeHtmlOptions = {
  // Removed on top of the defaults, e.g. ['img'] for comments without images. The defaults cannot be turned off.
  forbidTags?: string[];
  forbidAttributes?: string[];
};

// <style> and style="" allow CSS injection: a fake login box drawn over the whole page.
// class="" and data-* do the same with the app's own CSS (Tailwind's `fixed inset-0`, sonner's [data-sonner-toaster]).
// Form controls let user content collect passwords or add hidden fields to the app's own forms (phishing).
const DEFAULT_FORBID_TAGS = ['style', 'form', 'input', 'button', 'select', 'textarea'];
const DEFAULT_FORBID_ATTRIBUTES = ['style', 'class'];

export function sanitizeHtml(dirty: string, options: SanitizeHtmlOptions = {}): string {
  // Without a DOM (Node, SSR, some test setups) DOMPurify returns the input UNCHANGED.
  // Throwing is safer than silently rendering unsanitized HTML.
  if (!DOMPurify.isSupported) {
    throw new Error('sanitizeHtml needs a browser DOM');
  }
  return DOMPurify.sanitize(dirty, {
    // HTML only: no SVG or MathML, which have their own script and parsing tricks.
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [...DEFAULT_FORBID_TAGS, ...(options.forbidTags ?? [])],
    FORBID_ATTR: [...DEFAULT_FORBID_ATTRIBUTES, ...(options.forbidAttributes ?? [])],
  });
}

export { safeUrl, type SafeUrlOptions } from './url';
