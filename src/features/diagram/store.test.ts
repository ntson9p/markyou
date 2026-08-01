import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isDiagramEditorOpen,
  openDiagramEditor,
  useDiagramEditorStore,
} from '@/features/diagram/store';

describe('diagram editor session bridge (FR-5.9)', () => {
  beforeEach(() => {
    useDiagramEditorStore.setState({ session: null });
  });

  it('opens a session carrying the source and the commit callback', () => {
    const onApply = vi.fn();
    openDiagramEditor({ value: 'graph TD;\n A-->B;', onApply });

    const { session } = useDiagramEditorStore.getState();
    expect(session?.value).toBe('graph TD;\n A-->B;');
    expect(isDiagramEditorOpen()).toBe(true);

    session?.onApply('graph LR;');
    expect(onApply).toHaveBeenCalledWith('graph LR;');
  });

  it('gives every open a fresh id so the modal resets its draft', () => {
    openDiagramEditor({ value: 'a', onApply: vi.fn() });
    const first = useDiagramEditorStore.getState().session!.id;
    useDiagramEditorStore.getState().close();
    openDiagramEditor({ value: 'a', onApply: vi.fn() });
    const second = useDiagramEditorStore.getState().session!.id;

    // Same source, different session — the key must still change.
    expect(second).not.toBe(first);
  });

  it('closing clears the session and hands focus back exactly once', () => {
    const onClose = vi.fn();
    openDiagramEditor({ value: 'a', onApply: vi.fn(), onClose });

    useDiagramEditorStore.getState().close();
    expect(isDiagramEditorOpen()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    // A second close is a no-op — the editor must not be re-focused.
    useDiagramEditorStore.getState().close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
