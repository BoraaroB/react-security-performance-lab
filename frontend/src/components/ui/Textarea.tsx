import { cn } from '@/lib/cn';
import { CONTROL_CLASSES } from './control-classes';
import type { HtmlProps } from './types';

// React sets a textarea's text with `value` / `defaultValue`, not children.
export type TextareaProps = Omit<HtmlProps<'textarea'>, 'children'>;

export function Textarea({ rows = 4, className, ...props }: TextareaProps) {
  return <textarea rows={rows} className={cn(CONTROL_CLASSES, className)} {...props} />;
}
