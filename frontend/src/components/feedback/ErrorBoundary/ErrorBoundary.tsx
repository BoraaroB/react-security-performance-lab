import { Component, type ReactNode } from 'react';

export type ErrorFallbackProps = {
  error: unknown;
  // Renders the children again; use it for a "Try again" button.
  reset: () => void;
};

export type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (props: ErrorFallbackProps) => ReactNode;
};

// `hasError` is separate from `error` because JavaScript can throw anything, even `null` or `undefined`.
type ErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
};

// A class on purpose: React 19 still has no hook that catches render errors.
// It does not log the error: React passes every caught error to `createRoot`'s `onCaughtError` (one place to log).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  // An arrow function so `this` still points to the boundary when the fallback calls `reset` from a click.
  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
      });
    }
    return this.props.children;
  }
}
