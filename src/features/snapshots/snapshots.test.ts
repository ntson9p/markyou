import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/core/storage/db';

import { listSnapshots, takeSnapshot } from './snapshots';

describe('snapshots (FR-12)', () => {
  beforeEach(async () => {
    await db.snapshots.clear();
  });

  it('records versions newest-first and skips no-op duplicates (FR-12.1)', async () => {
    await takeSnapshot('doc1', 'v1', 'save');
    await takeSnapshot('doc1', 'v1', 'auto'); // identical → skipped
    await takeSnapshot('doc1', 'v2', 'auto');

    const list = await listSnapshots('doc1');
    expect(list.map((s) => s.text)).toEqual(['v2', 'v1']);
    expect(list.map((s) => s.trigger)).toEqual(['auto', 'save']);
  });

  it('scopes snapshots per document', async () => {
    await takeSnapshot('a', 'x', 'save');
    await takeSnapshot('b', 'y', 'save');
    expect((await listSnapshots('a')).map((s) => s.text)).toEqual(['x']);
    expect((await listSnapshots('b')).map((s) => s.text)).toEqual(['y']);
  });

  it('retains the newest 50 verbatim and thins older ones (FR-12.1)', async () => {
    for (let i = 0; i < 60; i++) await takeSnapshot('doc', `v${i}`, 'auto');

    const list = await listSnapshots('doc');
    expect(list.length).toBeLessThanOrEqual(200);
    expect(list.length).toBeLessThan(60); // older ones were thinned
    expect(list[0].text).toBe('v59'); // newest first

    const texts = new Set(list.map((s) => s.text));
    for (let i = 10; i < 60; i++) expect(texts.has(`v${i}`)).toBe(true); // newest 50 kept
  });
});
