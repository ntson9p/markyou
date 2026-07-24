import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/app/AppShell';
import { useUiStore } from '@/app/store/ui';
import { useDocStore } from '@/core/document/store';

// The mode panes mount real editor engines (CodeMirror/Milkdown) that need a
// layout engine jsdom lacks; they have their own E2E suites. Shell-level
// behavior (dirty dot, counts, frontmatter split, mode switch) is all
// store-derived, so we stub the pane region and drive the store directly.
vi.mock('@/app/EditorArea', () => ({
  EditorArea: () => <div data-testid="editor-region" />,
}));

describe('AppShell', () => {
  beforeEach(() => {
    useUiStore.setState({ mode: 'dual' });
    useDocStore.getState().closeDocument();
  });

  it('shows the welcome screen when no document is open', () => {
    render(<AppShell />);
    expect(screen.getByTestId('welcome-new')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-open')).toBeInTheDocument();
    expect(screen.getByTestId('status-save')).toHaveTextContent('No document open');
  });

  it('creates a new document and shows the editor region (FR-1.1)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    expect(screen.getByTestId('editor-region')).toBeInTheDocument();
    expect(screen.getByTestId('doc-title')).toHaveTextContent('Untitled');
    expect(screen.getByRole('radiogroup', { name: 'Editor mode' })).toBeInTheDocument();
  });

  it('shows the dirty dot after editing (FR-1.6)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    expect(screen.queryByTestId('dirty-dot')).not.toBeInTheDocument();
    act(() => useDocStore.getState().setFullText('hello', 'raw'));
    expect(screen.getByTestId('dirty-dot')).toBeInTheDocument();
    expect(screen.getByTestId('status-save')).toHaveTextContent('Unsaved changes');
  });

  it('updates word counts in the status bar (FR-10.2)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    act(() => useDocStore.getState().setFullText('one two three', 'raw'));
    expect(screen.getByTestId('status-counts')).toHaveTextContent('3 words');
  });

  it('switches mode via Ctrl+Shift+1/2/3 when a doc is open (FR-2.1)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    fireEvent.keyDown(window, { code: 'Digit1', ctrlKey: true, shiftKey: true });
    expect(useUiStore.getState().mode).toBe('raw');
    fireEvent.keyDown(window, { code: 'Digit3', ctrlKey: true, shiftKey: true });
    expect(useUiStore.getState().mode).toBe('dual');
  });

  it('splits frontmatter off the body when the full text is edited', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    act(() => useDocStore.getState().setFullText('---\ntitle: T\n---\nbody', 'raw'));
    const s = useDocStore.getState();
    expect(s.body).toBe('body');
    expect(s.frontmatter.data).toEqual({ title: 'T' });
  });
});
