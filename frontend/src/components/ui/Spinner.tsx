import { cn } from '@/lib/cn';
import type { HtmlProps } from './types';

// No children: the only text is the screen-reader `label`.
export type SpinnerProps = Omit<HtmlProps<'span'>, 'children'> & {
  label?: string;
};

export function Spinner({ label = 'Loading', className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      {...props}
    >
      {/* The spinner is only a picture; screen readers read this text instead. */}
      <span className="sr-only">{label}</span>
    </span>
  );
}
