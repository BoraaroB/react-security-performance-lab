import { cn } from '@/lib/cn';
import { CONTROL_CLASSES } from './control-classes';
import type { HtmlProps } from './types';

// A native <select>: keyboard and screen-reader support come from the browser for free.
export type SelectProps = HtmlProps<'select'>;

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn(CONTROL_CLASSES, 'h-10', className)} {...props} />;
}
