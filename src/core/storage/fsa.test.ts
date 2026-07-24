import { describe, expect, it, vi } from 'vitest';

import { FsaStorageProvider, ensurePermission } from '@/core/storage/fsa';
import { StorageError } from '@/core/storage/types';

interface MockHandleOptions {
  name?: string;
  content?: string;
  readPermission?: PermissionState;
  writePermission?: PermissionState;
  requestResult?: PermissionState;
}

function mockHandle(opts: MockHandleOptions = {}) {
  const writes: string[] = [];
  const handle = {
    kind: 'file' as const,
    name: opts.name ?? 'test.md',
    queryPermission: vi.fn(async ({ mode }: { mode: string }) =>
      mode === 'read' ? (opts.readPermission ?? 'granted') : (opts.writePermission ?? 'granted'),
    ),
    requestPermission: vi.fn(async () => opts.requestResult ?? 'granted'),
    getFile: vi.fn(async () => ({
      text: async () => opts.content ?? '# content',
    })),
    createWritable: vi.fn(async () => ({
      write: async (t: string) => {
        writes.push(t);
      },
      close: vi.fn(async () => {}),
    })),
    isSameEntry: vi.fn(async () => false),
  };
  return { handle: handle as unknown as FileSystemFileHandle, writes };
}

describe('ensurePermission', () => {
  it('passes without prompting when already granted', async () => {
    const { handle } = mockHandle();
    expect(await ensurePermission(handle, 'read')).toBe(true);
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('re-prompts when permission was revoked (FR-1.5)', async () => {
    const { handle } = mockHandle({ readPermission: 'prompt', requestResult: 'granted' });
    expect(await ensurePermission(handle, 'read')).toBe(true);
    expect(handle.requestPermission).toHaveBeenCalled();
  });

  it('returns false when the user denies', async () => {
    const { handle } = mockHandle({ readPermission: 'prompt', requestResult: 'denied' });
    expect(await ensurePermission(handle, 'read')).toBe(false);
  });
});

describe('FsaStorageProvider', () => {
  it('openHandle reads the file text', async () => {
    const { handle } = mockHandle({ content: 'hello', name: 'a.md' });
    const provider = new FsaStorageProvider();
    const result = await provider.openHandle(handle);
    expect(result.text).toBe('hello');
    expect(result.binding).toMatchObject({ kind: 'fsa', name: 'a.md', canSaveInPlace: true });
  });

  it('openHandle throws StorageError when read permission is denied', async () => {
    const { handle } = mockHandle({ readPermission: 'prompt', requestResult: 'denied' });
    const provider = new FsaStorageProvider();
    await expect(provider.openHandle(handle)).rejects.toBeInstanceOf(StorageError);
  });

  it('save writes in place through the handle (FR-1.3)', async () => {
    const { handle, writes } = mockHandle();
    const provider = new FsaStorageProvider();
    const binding = await provider.save(
      { kind: 'fsa', name: 'test.md', handle, canSaveInPlace: true },
      'new content',
      'test.md',
    );
    expect(writes).toEqual(['new content']);
    expect(binding?.name).toBe('test.md');
  });

  it('save surfaces write-permission denial as StorageError', async () => {
    const { handle } = mockHandle({ writePermission: 'prompt', requestResult: 'denied' });
    const provider = new FsaStorageProvider();
    await expect(
      provider.save({ kind: 'fsa', name: 'test.md', handle, canSaveInPlace: true }, 'x', 'test.md'),
    ).rejects.toBeInstanceOf(StorageError);
  });
});
