// REFERENCE ONLY (the app uses sonner; see README.md). Toast notifications: short messages after an action ("Post deleted", "Could not save"), announced to screen
// readers through a polite live region; every auto-dismiss timer is cleared when its toast goes away (no leaks).
export { ToastProvider, useToast, type ShowToast, type ToastInput, type ToastProviderProps } from './ToastProvider';
export type { ToastVariant } from './ToastItem';
