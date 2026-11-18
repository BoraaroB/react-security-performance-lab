import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ToastItem, type ToastVariant } from './ToastItem';

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
};

export type ShowToast = (toast: ToastInput) => void;

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

// The context holds only `showToast`, not the list: components that show toasts do not re-render
// every time a toast appears or disappears.
const ToastContext = createContext<ShowToast | null>(null);

export type ToastProviderProps = {
  children: ReactNode;
  durationMs?: number;
  maxToasts?: number;
};

export function ToastProvider({ children, durationMs = 5000, maxToasts = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback(
    (input: ToastInput) => {
      nextId.current += 1;
      const toast: Toast = {
        id: nextId.current,
        message: input.message,
        variant: input.variant ?? 'info',
      };
      // Only the newest few stay: an error repeated in a loop must not pile up hundreds of toasts.
      // At least 1: `slice(-0)` is `slice(0)`, which would keep every toast.
      setToasts((current) => [...current, toast].slice(-Math.max(1, maxToasts)));
    },
    [maxToasts],
  );

  // No dependencies (functional update), so it is the same function on every render and toast timers do not restart.
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext value={showToast}>
      {children}
      {/* Always rendered, even empty: screen readers only announce changes inside a live region that already exists.
          Not role="status": it implies aria-atomic, which would read ALL visible toasts again when one is added. */}
      <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            id={toast.id}
            message={toast.message}
            variant={toast.variant}
            // Errors stay until closed: the user needs time to read what went wrong.
            durationMs={toast.variant === 'error' ? null : durationMs}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ShowToast {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return showToast;
}
