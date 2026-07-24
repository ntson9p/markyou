import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { parse as parseYaml } from 'yaml';

import { useUiStore } from '@/app/store/ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useDocStore } from '@/core/document/store';
import type { FrontmatterState } from '@/core/document/frontmatter';

import {
  allScalar,
  buildFrontmatterBlock,
  coerceScalar,
  innerYaml,
  rawToBlock,
} from './frontmatter-io';

interface Row {
  key: string;
  value: string;
}

const inputClass =
  'w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function seed(fm: FrontmatterState): { mode: 'fields' | 'raw'; rows: Row[]; raw: string } {
  const data = fm.data;
  if (fm.valid && (data === null || allScalar(data))) {
    return {
      mode: 'fields',
      rows: Object.entries(data ?? {}).map(([key, v]) => ({
        key,
        value: v === null ? '' : String(v),
      })),
      raw: '',
    };
  }
  return { mode: 'raw', rows: [], raw: fm.rawBlock ? innerYaml(fm.rawBlock) : '' };
}

/**
 * Frontmatter metadata panel (FR-10.4): key/value editing with an invalid- or
 * complex-YAML fallback to raw text. Writes through the store's frontmatter
 * block, which the raw/preview panes reflect immediately. Mounted only while
 * open so local edit state seeds cleanly from the current frontmatter.
 */
export function MetadataPanel() {
  const open = useUiStore((s) => s.activePanel === 'metadata');
  return open ? <MetadataDialog /> : null;
}

function MetadataDialog() {
  const close = () => useUiStore.getState().setActivePanel(null);
  const frontmatter = useDocStore((s) => s.frontmatter);
  const setBlock = useDocStore((s) => s.setFrontmatterBlock);

  const [initial] = useState(() => seed(frontmatter));
  const [mode, setMode] = useState(initial.mode);
  const [rows, setRows] = useState(initial.rows);
  const [raw, setRaw] = useState(initial.raw);

  const applyFields = (next: Row[]) => {
    setRows(next);
    const data: Record<string, unknown> = {};
    for (const { key, value } of next) {
      const k = key.trim();
      if (k) data[k] = coerceScalar(value);
    }
    setBlock(buildFrontmatterBlock(data) ?? '', 'meta');
  };

  const applyRaw = (text: string) => {
    setRaw(text);
    setBlock(rawToBlock(text), 'meta');
  };

  const switchToRaw = () => {
    setRaw(
      useDocStore.getState().frontmatter.rawBlock
        ? innerYaml(useDocStore.getState().frontmatter.rawBlock!)
        : '',
    );
    setMode('raw');
  };

  const switchToFields = () => {
    try {
      const parsed = parseYaml(raw) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        allScalar(parsed as Record<string, unknown>)
      ) {
        setRows(
          Object.entries(parsed as Record<string, unknown>).map(([key, v]) => ({
            key,
            value: v === null ? '' : String(v),
          })),
        );
        setMode('fields');
      }
    } catch {
      // Invalid YAML — stay in raw mode.
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title="Document metadata"
      description="YAML frontmatter stored at the top of the file (title, tags, custom keys)."
      footer={
        <>
          {mode === 'fields' ? (
            <Button variant="ghost" size="sm" onClick={switchToRaw} data-testid="metadata-mode-raw">
              Edit as YAML
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={switchToFields}
              disabled={!frontmatter.valid}
              data-testid="metadata-mode-fields"
            >
              Edit as fields
            </Button>
          )}
          <Button size="sm" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      {!frontmatter.valid && mode === 'raw' && (
        <div
          role="alert"
          className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          data-testid="metadata-yaml-error"
        >
          This YAML isn’t valid, so it’s shown as raw text. {frontmatter.error}
        </div>
      )}

      {mode === 'fields' ? (
        <div className="space-y-2" data-testid="metadata-fields">
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No metadata yet. Add a field to create a frontmatter block.
            </p>
          )}
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`Key ${i + 1}`}
                className={`${inputClass} max-w-[10rem]`}
                value={row.key}
                placeholder="key"
                onChange={(e) =>
                  applyFields(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
                }
              />
              <input
                aria-label={`Value for ${row.key || `field ${i + 1}`}`}
                className={inputClass}
                value={row.value}
                placeholder="value"
                onChange={(e) =>
                  applyFields(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                }
              />
              <button
                type="button"
                aria-label={`Remove ${row.key || `field ${i + 1}`}`}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                onClick={() => applyFields(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { key: '', value: '' }])}
            data-testid="metadata-add"
          >
            <Plus className="size-4" /> Add field
          </Button>
        </div>
      ) : (
        <textarea
          aria-label="Raw frontmatter YAML"
          data-testid="metadata-raw"
          className={`${inputClass} font-mono`}
          value={raw}
          rows={10}
          spellCheck={false}
          onChange={(e) => applyRaw(e.target.value)}
        />
      )}
    </Modal>
  );
}
