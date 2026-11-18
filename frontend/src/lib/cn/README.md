# cn

Joins class names (strings, conditionals, arrays) and removes conflicting Tailwind classes, so a component can
take a `className` prop that really overrides its defaults. Without the merge, `p-4 p-2` keeps both classes and
the winner depends on the order in the generated CSS, not on the order you wrote.

## Dependencies
- npm: `clsx@^2`, `tailwind-merge@^3` (Tailwind CSS 4)
- lib: none

## Usage
```tsx
import { cn } from '@/lib/cn';

function Badge({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn('rounded px-2 text-sm', active && 'bg-green-100', className)} />
  );
}

<Badge active className="px-4" />; // → 'rounded text-sm bg-green-100 px-4'
```

## Options
None. `cn(...inputs)` accepts anything `clsx` accepts: strings, `false`/`null`/`undefined` (skipped),
arrays, and objects like `{ 'font-bold': isActive }`.

## How to reuse
Copy `src/lib/cn/` and run `npm install clsx tailwind-merge`. Frontend imports have no `.js` extension
(unlike `backend-express`). Use `tailwind-merge@^2` with Tailwind 3.
