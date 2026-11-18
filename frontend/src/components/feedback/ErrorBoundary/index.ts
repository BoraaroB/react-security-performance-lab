// Error boundary for one part of a page: if that part throws while rendering, only it is replaced by a fallback
// (with a "Try again" reset) instead of the whole page going blank.
export { ErrorBoundary, type ErrorBoundaryProps, type ErrorFallbackProps } from './ErrorBoundary';
