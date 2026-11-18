# PR 15b: Accessible form fields (FormField, Input, Textarea, Select)

## What and why
The form building blocks for the login, register and post forms (steps 20 and 22). `FormField` renders a `<label>`,
a hint and an error message, and links them to the control: `htmlFor` + `id` (clicking the label focuses the field),
`aria-describedby` (a screen reader reads the hint and the error with the field), and `aria-invalid` (the field is
announced as invalid and gets a red border from the same attribute). Input, Textarea and Select share one look.
Error messages render as React text, so a server message cannot inject HTML. Second half of step 15 (user's split).

## Changes
- `frontend/src/components/ui/FormField.tsx`: label + hint + error; `children` is a function that receives
  `{ id, aria-invalid, aria-describedby }` (a "render prop"); ids come from `useId()`.
- `Input.tsx`, `Textarea.tsx` (`rows` default 4), `Select.tsx` (native `<select>`): styled controls; no `children`
  on Input (a void element, React throws) or Textarea (React wants `value`/`defaultValue`),
  no `dangerouslySetInnerHTML` (via `HtmlProps`).
- `control-classes.ts`: `CONTROL_CLASSES` shared by the three controls; red border on `aria-[invalid=true]`.
- `index.ts`, `README.md`: exports, usage with react-hook-form, props table, accessibility note.
- `frontend/src/App.tsx`: the showcase gets a card with four fields (one with a hint, one with an error).

## How to test
```bash
cd frontend && npm run dev
```
Open http://localhost:5173: click the "Email" label → the email field gets focus. The "Password" field has a red
border and a red message. In DevTools, the password `<input>` has `aria-invalid="true"` and `aria-describedby`
pointing to the message's `id`. A screen reader (VoiceOver: Cmd+F5) reads "Password, invalid data, Password must be…".

## How to reuse in another project
Copy `src/components/ui/` and `src/lib/cn/`, `npm install clsx tailwind-merge`, add the `@/` alias:
```tsx
import { FormField, Input } from '@/components/ui';

<FormField label="Email" error={errors.email?.message}>
  {(control) => <Input type="email" {...control} {...register('email')} />}
</FormField>
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: no errors (CSS 13.9 kB, JS 255 kB). The built CSS contains
  the `[aria-invalid=true]` rules.
- Temporary file (deleted): refs of the right element type compile on Input/Textarea/Select; a `HTMLTextAreaElement`
  ref on Input, `dangerouslySetInnerHTML` on Textarea/Select, children on Input, and a non-function child of
  FormField do not compile (`@ts-expect-error`).
- Temporary SSR render (deleted): `for` = `id`, `aria-describedby="…-hint …-error"`, an error of
  `<img src=x onerror=alert(1)>` comes out as `&lt;img …&gt;`; a field without hint/error has no `aria-*` attributes.
- `npm run dev` → `/` and `FormField.tsx` 200. Portability grep: no hits. Size: ~118 changed lines of code.

## Review
- **security:** no findings (props render as escaped text, `HtmlProps` blocks raw HTML, docs do not overstate the protection).
- **code (should-fix), fixed:** the README said every component accepts its element's HTML props; FormField does
  not. Reworded, and added FormField's `className` to the props table.
- **code (nit), fixed:** the PR description said React does not allow children on Textarea; it only warns (children
  become the initial value). Reworded: Input throws, Textarea wants `value`/`defaultValue`.
- **code (nit), fixed:** `placeholder:text-gray-400` on white is about 2.6:1 contrast (WCAG asks 4.5:1) → `gray-500`.
- **code (nit), fixed:** the fixed `h-10` crops `<Select multiple>` / `size`; README row: use `className="h-auto"`.

## Interview questions
1. **How do you make a form error accessible?** Link it to the field with `aria-describedby`, mark the field
   `aria-invalid="true"`, and move focus to the first invalid field on submit. Color alone is not enough.
2. **Why `useId()` instead of `Math.random()` or a counter?** It is unique per component instance and the same on the
   server and the client, so server rendering does not cause hydration mismatches.
3. **Is frontend validation a security measure?** No. It only gives fast feedback. Anyone can call the API with curl,
   so the server validates everything again (Zod, unknown fields stripped).
