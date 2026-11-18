import { cn } from '@/lib/cn';
import type { HtmlProps } from './types';

const VARIANT_CLASSES = {
  neutral: 'bg-gray-100 text-gray-800',
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-900',
  error: 'bg-red-100 text-red-800',
} as const;

export type BadgeProps = HtmlProps<'span'> & {
  variant?: keyof typeof VARIANT_CLASSES;
};

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
