// Builds a className from conditional parts and resolves Tailwind conflicts (the last class wins),
// so a component's default classes can be overridden by the caller: cn('p-4', 'p-2') → 'p-2'.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

export function cn(...inputs: ClassValue[]): string {
  const joined = clsx(inputs);
  return twMerge(joined);
}
