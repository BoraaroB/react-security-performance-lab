import { cn } from '@/lib/cn';
import { CONTROL_CLASSES } from './control-classes';
import type { HtmlProps } from './types';

// <input> is a void element: children would make React throw.
export type InputProps = Omit<HtmlProps<'input'>, 'children'>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(CONTROL_CLASSES, 'h-10', className)} {...props} />;
}
