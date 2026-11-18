import { useEffect } from 'react';

const VARIANT_CLASSES = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-green-200 bg-green-50 text-green-900',
  error: 'border-red-200 bg-red-50 text-red-900',
} as const;

export type ToastVariant = keyof typeof VARIANT_CLASSES;

type ToastItemProps = {
  id: number;
  message: string;
  variant: ToastVariant;
  // `null` = stays until the user closes it.
  durationMs: number | null;
  // Must be the same function on every render, or the timer below would restart on every render.
  onDismiss: (id: number) => void;
};

export function ToastItem({ id, message, variant, durationMs, onDismiss }: ToastItemProps) {
  useEffect(() => {
    if (durationMs === null) {
      return;
    }
    const timerId = window.setTimeout(() => onDismiss(id), durationMs);
    // Cleanup: if the toast is closed early or the app unmounts, no timer is left running (memory leak).
    return () => window.clearTimeout(timerId);
  }, [id, durationMs, onDismiss]);

  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 text-sm shadow-md ${VARIANT_CLASSES[variant]}`}>
      {/* Plain text, never HTML: a message can contain text from the server or other users (XSS). */}
      <p className="flex-1">{message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        // Keyboard users need the same visible focus ring as the other buttons (opacity would fade it).
        className="rounded px-1 leading-none opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
