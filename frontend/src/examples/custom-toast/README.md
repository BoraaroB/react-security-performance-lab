# custom-toast (reference only)

> **Not used by the app and not imported anywhere.** The app shows toasts with the `sonner` library
> (`<Toaster />` in `main.tsx`). This is the hand-written version from step 17c (PR #39), kept to read and learn
> from: a polite live region, timer cleanup in `useEffect`, and a stable context value. It stays in `src/` so that
> typecheck and lint keep it correct; it is not in the bundle because nothing imports it. See
> `docs/prs/17c-toasts.md` for the explanation and `docs/prs/chore-sonner-toasts.md` for why the app switched.

Short notifications after an action ("Post deleted", "Could not save the post"). Screen readers announce them
through a polite live region, messages are always rendered as text (no HTML, so no XSS), and every auto-dismiss
timer is cleared when its toast goes away (no timers left running after unmount).

## Dependencies
- npm: `react@^19` (`<Context value>` without `.Provider` is React 19)
- lib: none (Tailwind classes for the look)

## Usage
```tsx
import { ToastProvider, useToast } from '@/examples/custom-toast';

// Once, around the whole app (main.tsx):
<ToastProvider>
  <App />
</ToastProvider>

// In any component:
const showToast = useToast();
showToast({ message: 'Post deleted', variant: 'success' });
showToast({ message: 'Could not delete the post', variant: 'error' });
```

## Options
| Prop | Type | Default | Description |
|---|---|---|---|
| `durationMs` | `number` | `5000` | How long `info` and `success` toasts stay. `error` toasts stay until closed. Must be finite and below ~24 days: `setTimeout` treats larger values (and `Infinity`) as 0. |
| `maxToasts` | `number` | `3` | Only the newest toasts stay on screen; older ones are removed. Values below 1 count as 1. |

`showToast({ message, variant? })`: `message` is a `string` (shown as text); `variant` is `info` (default),
`success` or `error`. Do not pass raw server error text: map the error `code` to a message.

## How to reuse
Copy `src/examples/custom-toast/`. Frontend imports have no `.js` extension. Needs Tailwind for the classes
(or replace them with your own CSS).
