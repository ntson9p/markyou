import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocStore } from '@/core/document/store';
import { startDraftGuard, type DraftGuardIO } from '@/features/files/drafts';
import type { DraftRecord } from '@/core/storage/db';

describe('draft guard (FR-1.7)', () => {
  let written: DraftRecord[];
  let deleted: string[];
  let io: DraftGuardIO;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    written = [];
    deleted = [];
    io = {
      writeDraft: async (d) => {
        written.push(d);
      },
      deleteDraft: async (id) => {
        deleted.push(id);
      },
    };
    useDocStore.getState().closeDocument();
    useDocStore.getState().newDocument();
    stop = startDraftGuard(io, 1000);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('writes a draft within 1 s of a change', async () => {
    useDocStore.getState().setFullText('hello', 'raw');
    expect(written).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(written).toHaveLength(1);
    expect(written[0].text).toBe('hello');
    expect(written[0].docId).toBe(useDocStore.getState().docId);
  });

  it('coalesces rapid changes into one write containing the latest text', async () => {
    useDocStore.getState().setFullText('a', 'raw');
    await vi.advanceTimersByTimeAsync(300);
    useDocStore.getState().setFullText('ab', 'raw');
    await vi.advanceTimersByTimeAsync(300);
    useDocStore.getState().setFullText('abc', 'raw');
    await vi.advanceTimersByTimeAsync(400);
    expect(written).toHaveLength(1);
    expect(written[0].text).toBe('abc');
  });

  it('keeps writing at least once per interval during continuous typing', async () => {
    for (let i = 0; i < 30; i++) {
      useDocStore.getState().setFullText('x'.repeat(i + 1), 'raw');
      await vi.advanceTimersByTimeAsync(100);
    }
    // 3 s of continuous typing → ~3 writes, never a gap > 1 s.
    expect(written.length).toBeGreaterThanOrEqual(2);
    expect(written[written.length - 1].text.length).toBeGreaterThan(20);
  });

  it('deletes the draft after a clean save', async () => {
    useDocStore.getState().setFullText('to save', 'raw');
    await vi.advanceTimersByTimeAsync(1000);
    const docId = useDocStore.getState().docId;
    useDocStore.getState().markSaved({ kind: 'memory', name: 'f.md', canSaveInPlace: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(deleted).toContain(docId);
  });

  it('cancels a pending write when the doc is saved first', async () => {
    useDocStore.getState().setFullText('quick save', 'raw');
    await vi.advanceTimersByTimeAsync(200);
    useDocStore.getState().markSaved({ kind: 'memory', name: 'f.md', canSaveInPlace: false });
    await vi.advanceTimersByTimeAsync(2000);
    expect(written).toHaveLength(0);
  });

  it('includes file metadata and saved base text', async () => {
    useDocStore.getState().openDocument({
      text: 'original',
      file: { kind: 'memory', name: 'doc.md', canSaveInPlace: false },
    });
    useDocStore.getState().setFullText('original edited', 'raw');
    await vi.advanceTimersByTimeAsync(1000);
    expect(written[0].fileName).toBe('doc.md');
    expect(written[0].baseText).toBe('original');
  });
});
