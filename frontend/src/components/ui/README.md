# components/ui

Small, styled building blocks (Button, Spinner, Badge, Card, Alert) with Tailwind defaults. Every component
accepts the normal HTML props of its element, plus a `className` that really overrides the defaults (merged by `cn`).
Form fields (Input, Textarea, Select, FormField) come in step 15b.

## Dependencies
- npm: `react@^19`, `tailwindcss@^4`
- lib: `cn` (imported as `@/lib/cn`: the project needs the `@/` → `src/` alias, or change the import)

## Usage
```tsx
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';

<Card className="space-y-4">
  <Button variant="danger" isLoading={isDeleting} onClick={onDelete}>Delete</Button>
  <Badge variant="info">admin</Badge>
  <Alert variant="error" title="Login failed">{message}</Alert>
  <Spinner label="Loading posts" />
</Card>
```

## Props
| Component | Prop | Type | Default | Description |
|---|---|---|---|---|
| Button | `variant` | `primary \| secondary \| danger \| ghost` | `primary` | colors |
| Button | `size` | `sm \| md` | `md` | height and padding |
| Button | `isLoading` | `boolean` | `false` | shows a Spinner, disables the button, sets `aria-busy`; set it before the first `await` |
| Button | `type` | `button \| submit \| reset` | `button` | not `submit`, so a button in a form does not submit by accident |
| Badge | `variant` | `neutral \| info \| success \| warning \| error` | `neutral` | colors |
| Alert | `variant` | `info \| success \| warning \| error` | `info` | colors; `error` uses `role="alert"` (read at once), the rest `role="status"` (read when the text changes while mounted, so keep it mounted) |
| Alert | `title` | `ReactNode` | – | bold first line |
| Spinner | `label` | `string` | `Loading` | text for screen readers (no `children`); color it with `text-*`, not `border-*` |

`ref` is a normal prop (React 19, no `forwardRef`): `<Button ref={buttonRef} />` gives the `<button>` element.

## Security note
Everything is rendered as React text, so `<Alert>{serverMessage}</Alert>` is escaped and cannot run a script.
The props types (`HtmlProps` in `types.ts`) leave out `dangerouslySetInnerHTML`, so passing raw HTML to these
components does not compile. Disabling a loading Button only stops accidental double clicks; the server must
still handle duplicate requests.

## How to reuse
Copy `src/components/ui/` and `src/lib/cn/`, install `clsx tailwind-merge`, and set up the `@/` alias
(or replace `@/lib/cn` with a relative import). Frontend imports have no `.js` extension.
