# components/ui

Small, styled building blocks (Button, Spinner, Badge, Card, Alert, and the form fields FormField, Input, Textarea,
Select) with Tailwind defaults. Every component except FormField accepts the normal HTML props of its element, plus a
`className` that really overrides the defaults (merged by `cn`). FormField takes only the props in the table below.
`VirtualList` (a list that renders only the visible rows) is its own folder with its own props: see
[VirtualList/README.md](VirtualList/README.md).

## Dependencies
- npm: `react@^19`, `tailwindcss@^4`
- lib: `cn` (imported as `@/lib/cn`: the project needs the `@/` → `src/` alias, or change the import)

## Usage
```tsx
import { Alert, Badge, Button, Card, FormField, Input, Spinner } from '@/components/ui';

<Card className="space-y-4">
  <Button variant="danger" isLoading={isDeleting} onClick={onDelete}>Delete</Button>
  <Badge variant="info">admin</Badge>
  <Alert variant="error" title="Login failed">{message}</Alert>
  <Spinner label="Loading posts" />
</Card>

// FormField links the label, hint and error to the control (id, aria-invalid, aria-describedby).
<FormField label="Email" hint="We never share it." error={errors.email?.message}>
  {(control) => <Input type="email" {...control} {...register('email')} />}
</FormField>
```

`children` of FormField is a function (a "render prop"): FormField makes the ids, the control receives them.
Works with react-hook-form's `register(...)` (it returns `ref`, `name`, `onChange`, `onBlur`; `ref` is a normal prop).

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
| FormField | `label` | `ReactNode` | – | `<label>` linked to the control by `htmlFor` (clicking it focuses the control) |
| FormField | `hint` | `ReactNode` | – | gray help text, read by screen readers after the label |
| FormField | `error` | `string` | – | red message; sets `aria-invalid` on the control (red border) and adds it to `aria-describedby` |
| FormField | `children` | `(control) => ReactNode` | – | spread `control` onto Input, Textarea or Select |
| FormField | `className` | `string` | – | classes for the wrapper `<div>` |
| Select | – | – | – | fixed height `h-10` fits a single select; add `className="h-auto"` for `multiple` or `size` |
| Textarea | `rows` | `number` | `4` | visible lines |
| Spinner | `label` | `string` | `Loading` | text for screen readers (no `children`); color it with `text-*`, not `border-*` |

`ref` is a normal prop (React 19, no `forwardRef`): `<Button ref={buttonRef} />` gives the `<button>` element.

## Security note
Everything is rendered as React text, so `<Alert>{serverMessage}</Alert>` is escaped and cannot run a script.
The props types (`HtmlProps` in `types.ts`) leave out `dangerouslySetInnerHTML`, so passing raw HTML to these
components does not compile. Disabling a loading Button only stops accidental double clicks; the server must
still handle duplicate requests. Form error messages are text too, so a server message cannot inject HTML.
Form fields only improve the UX: the server validates every input again (Zod).

## Accessibility note
Field errors have no `role="alert"`: announcing every error at once on submit is noisy. Instead, focus the first
invalid field (react-hook-form does this by default); the screen reader then reads its label and its error.

## How to reuse
Copy `src/components/ui/` and `src/lib/cn/`, install `clsx tailwind-merge`, and set up the `@/` alias
(or replace `@/lib/cn` with a relative import). Frontend imports have no `.js` extension.
