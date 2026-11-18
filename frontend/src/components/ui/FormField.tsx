import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Spread these onto the control: they link it to the label, the hint and the error.
export type FieldControlProps = {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

export type FormFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

export function FormField({ label, hint, error, className, children }: FormFieldProps) {
  // useId gives a unique id that is the same on the server and the client, so two forms never clash.
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // A screen reader reads the label, then these texts, when the control gets focus.
  const describedByIds: string[] = [];
  if (hint) describedByIds.push(hintId);
  if (error) describedByIds.push(errorId);

  const control: FieldControlProps = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
  };

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      {children(control)}
      {hint && (
        <p id={hintId} className="text-sm text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
