import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { HtmlProps } from './types';

const VARIANT_CLASSES = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
} as const;

// `title` here is a visible heading, not the HTML tooltip attribute.
export type AlertProps = Omit<HtmlProps<'div'>, 'title'> & {
  variant?: keyof typeof VARIANT_CLASSES;
  title?: ReactNode;
};

export function Alert({ variant = 'info', title, className, children, ...props }: AlertProps) {
  // Errors are read at once. A status is read when its text changes while it is on the page,
  // so keep a status Alert mounted and change its children.
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={cn('rounded-md border p-4 text-sm', VARIANT_CLASSES[variant], className)}
      {...props}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}
