# forms

Shows the server's validation errors (`400 VALIDATION_ERROR` → `details: [{ field, message }]`) under the matching
form fields in react-hook-form. The browser check is only for quick feedback; the server is the source of truth,
so a rule only the server knows (e.g. a login password longer than 72 characters) still appears next to the right input.

## Dependencies
- npm: `react-hook-form@^7`
- lib: `http` (`ApiError`)

## Usage
```tsx
const { register, handleSubmit, setError, formState: { errors } } = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
});

async function onSubmit(values: LoginInput) {
  try {
    await login(values);
  } catch (error) {
    if (applyServerErrors(error, setError, ['email', 'password'])) return;
    setError('root.server', { message: 'Something went wrong.' }); // a message mapped from error.code
  }
}
```

## API
`applyServerErrors(error, setError, fieldNames)` → `boolean`

| Argument | Meaning |
|---|---|
| `error` | Anything caught; only an `ApiError` with `details` is used |
| `setError` | From `useForm()` |
| `fieldNames` | The form's fields; a `field` from the server that is not listed is ignored |

Returns `true` when at least one field got an error (the first one is focused). Items that are not
`{ field: string, message: string }` are skipped, so an unexpected error body cannot crash the form.
The `message` is shown as text (React escapes it); it comes from the server's own Zod schema, not from user input.

## How to reuse
Copy `src/lib/forms/` and `src/lib/http/`, install `react-hook-form`. Zod and `@hookform/resolvers` are only needed
for the browser-side schema, not by this module.
