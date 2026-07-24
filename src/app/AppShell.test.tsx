import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AppShell } from '@/app/AppShell';
import { useUiStore } from '@/app/store/ui';

describe('AppShell', () => {
  beforeEach(() => {
    useUiStore.setState({ mode: 'wysiwyg' });
  });

  it('renders top bar, mode switcher, and status bar', () => {
    render(<AppShell />);
    expect(screen.getByTestId('doc-title')).toHaveTextContent('Untitled');
    expect(screen.getByRole('radiogroup', { name: 'Editor mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Raw/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /WYSIWYG/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Dual/ })).toBeInTheDocument();
    expect(screen.getByTestId('status-counts')).toBeInTheDocument();
  });

  it('defaults to WYSIWYG mode (D3)', () => {
    render(<AppShell />);
    expect(screen.getByTestId('active-mode')).toHaveTextContent('wysiwyg');
  });

  it('switches mode via the segmented control', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('radio', { name: /Raw/ }));
    expect(useUiStore.getState().mode).toBe('raw');
  });

  it('switches mode via Ctrl+Shift+1/2/3 (FR-2.1)', () => {
    render(<AppShell />);
    fireEvent.keyDown(window, { code: 'Digit1', ctrlKey: true, shiftKey: true });
    expect(useUiStore.getState().mode).toBe('raw');
    fireEvent.keyDown(window, { code: 'Digit3', ctrlKey: true, shiftKey: true });
    expect(useUiStore.getState().mode).toBe('dual');
    fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, shiftKey: true });
    expect(useUiStore.getState().mode).toBe('wysiwyg');
  });
});
