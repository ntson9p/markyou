import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AppShell } from '@/app/AppShell';
import { useUiStore } from '@/app/store/ui';
import { useDocStore } from '@/core/document/store';

describe('AppShell', () => {
  beforeEach(() => {
    useUiStore.setState({ mode: 'wysiwyg' });
    useDocStore.getState().closeDocument();
  });

  it('shows the welcome screen when no document is open', () => {
    render(<AppShell />);
    expect(screen.getByTestId('welcome-new')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-open')).toBeInTheDocument();
    expect(screen.getByTestId('status-save')).toHaveTextContent('No document open');
  });

  it('creates a new document and shows the editor (FR-1.1)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('doc-title')).toHaveTextContent('Untitled');
    expect(screen.getByRole('radiogroup', { name: 'Editor mode' })).toBeInTheDocument();
  });

  it('shows the dirty dot after editing (FR-1.6)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    expect(screen.queryByTestId('dirty-dot')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('editor-textarea'), { target: { value: 'hello' } });
    expect(screen.getByTestId('dirty-dot')).toBeInTheDocument();
    expect(screen.getByTestId('status-save')).toHaveTextContent('Unsaved changes');
  });

  it('updates word counts in the status bar (FR-10.2)', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    fireEvent.change(screen.getByTestId('editor-textarea'), {
      target: { value: 'one two three' },
    });
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

  it('keeps frontmatter out of nothing — textarea edits full text including frontmatter', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId('welcome-new'));
    fireEvent.change(screen.getByTestId('editor-textarea'), {
      target: { value: '---\ntitle: T\n---\nbody' },
    });
    const s = useDocStore.getState();
    expect(s.body).toBe('body');
    expect(s.frontmatter.data).toEqual({ title: 'T' });
  });
});
