import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function Boom({ crash }: { crash: boolean }) {
  if (crash) throw new Error('kaboom');
  return <div>all good</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <div>hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders the fallback and reports the error when a child throws', () => {
    const onError = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary onError={onError} fallback={(e) => <div>caught: {e.message}</div>}>
        <Boom crash />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: kaboom')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('reset() clears the error and re-renders recovered children', async () => {
    function Harness() {
      const [crash, setCrash] = useState(true);
      return (
        <ErrorBoundary
          fallback={(_e, reset) => (
            <button
              onClick={() => {
                setCrash(false);
                reset();
              }}
            >
              retry
            </button>
          )}
        >
          <Boom crash={crash} />
        </ErrorBoundary>
      );
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness />);
    await userEvent.click(screen.getByText('retry'));
    expect(screen.getByText('all good')).toBeInTheDocument();
    spy.mockRestore();
  });
});
