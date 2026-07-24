import type { FileBinding } from '@/core/document/store';

export interface OpenResult {
  text: string;
  binding: FileBinding;
}

/**
 * Storage abstraction (D1): FSA on Chromium, open/download fallback elsewhere.
 * Built as an interface so a cloud provider can be added without rewrite.
 */
export interface StorageProvider {
  readonly capabilities: {
    /** True when saving writes the original file in place (FR-1.3). */
    saveInPlace: boolean;
    /** True when persisted handles can reopen recents without a picker (FR-1.5). */
    reopenHandles: boolean;
  };
  /** Show an open picker. Resolves null when the user cancels. */
  open(): Promise<OpenResult | null>;
  /**
   * Save. FSA: writes in place when the binding has a writable handle,
   * otherwise falls through to saveAs. Fallback: downloads a copy.
   * Resolves null when the user cancels a picker.
   */
  save(
    binding: FileBinding | null,
    text: string,
    suggestedName: string,
  ): Promise<FileBinding | null>;
  /** Save As (FR-1.4). Resolves null when the user cancels. */
  saveAs(text: string, suggestedName: string): Promise<FileBinding | null>;
}

/** Error surfaced to the UI as an actionable, non-blocking notice (§7 reliability). */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
