import { FallbackStorageProvider } from '@/core/storage/fallback';
import { FsaStorageProvider, supportsFsa } from '@/core/storage/fsa';
import type { StorageProvider } from '@/core/storage/types';

let provider: StorageProvider | null = null;

/** The active storage provider for this browser (capability-detected, D1). */
export function getStorageProvider(): StorageProvider {
  provider ??= supportsFsa() ? new FsaStorageProvider() : new FallbackStorageProvider();
  return provider;
}

/** Test hook. */
export function setStorageProvider(p: StorageProvider | null) {
  provider = p;
}
