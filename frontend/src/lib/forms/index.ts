// Puts the server's validation errors (an ApiError's `details`) under the matching form fields, so a rule that only
// the server checks still shows up next to the input. Only the listed fields are touched, and every item is checked
// first: `details` comes from the network, so an odd error body must not crash the form.
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/http';

// Returns true when at least one field got an error; otherwise the caller shows a message for the whole form.
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  let applied = false;
  // `details` is typed by lib/http, but not checked at runtime: treat each item as unknown.
  for (const item of error.details as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, message } = item as Record<string, unknown>;
    const fieldName = fieldNames.find((name) => name === field);
    if (fieldName === undefined || typeof message !== 'string') {
      continue;
    }
    // Focus only the first field with an error, so keyboard and screen-reader users land on it.
    setError(fieldName, { type: 'server', message }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}
