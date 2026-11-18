import { cn } from '@/lib/cn';
import type { HtmlProps } from './types';

export type CardProps = HtmlProps<'div'>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-lg border border-gray-200 bg-white p-6 shadow-sm', className)}
      {...props}
    />
  );
}
