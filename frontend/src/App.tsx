import { cn } from '@/lib/cn';

export function App() {
  const isDevelopment = import.meta.env.DEV;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900">React Security &amp; Performance Lab</h1>
      <p className="mt-2 text-gray-600">Frontend setup works. Pages come in the next steps.</p>
      <span
        className={cn(
          'mt-4 inline-block rounded px-2 py-1 text-xs font-medium',
          isDevelopment ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900',
        )}
      >
        {import.meta.env.MODE}
      </span>
    </main>
  );
}
