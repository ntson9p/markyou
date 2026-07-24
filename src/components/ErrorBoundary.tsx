import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Render the recovery UI. `reset` clears the error and re-renders children. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree and shows a recovery UI instead
 * of a blank screen (§7 reliability). The document text lives in the store and
 * is continuously drafted, so a crashed editor never loses work — the fallback
 * lets the user reset or reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('ErrorBoundary caught an error:', error);
    this.props.onError?.(error);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
