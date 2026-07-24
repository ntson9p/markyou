import { useMemo, useState } from 'react';

import { useUiStore } from '@/app/store/ui';
import { Modal } from '@/components/ui/modal';

interface Shortcut {
  action: string;
  keys: string;
}

/** The v1 shortcut set (requirements §8.3). */
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'File',
    items: [
      { action: 'New', keys: 'Ctrl+Alt+N' },
      { action: 'Open', keys: 'Ctrl+O' },
      { action: 'Save', keys: 'Ctrl+S' },
      { action: 'Save As', keys: 'Ctrl+Shift+S' },
    ],
  },
  {
    title: 'View',
    items: [
      { action: 'Mode: Raw / WYSIWYG / Dual', keys: 'Ctrl+Shift+1 / 2 / 3' },
      { action: 'Toggle preview (raw mode)', keys: 'Ctrl+Shift+P' },
      { action: 'Toggle outline', keys: 'Ctrl+Shift+O' },
      { action: 'Keyboard shortcuts', keys: 'Ctrl+/' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { action: 'Find / Replace', keys: 'Ctrl+F / Ctrl+H' },
      { action: 'Undo / Redo', keys: 'Ctrl+Z / Ctrl+Y' },
      { action: 'Slash menu (WYSIWYG)', keys: '/ at block start' },
    ],
  },
  {
    title: 'Format',
    items: [
      { action: 'Bold / Italic / Strikethrough', keys: 'Ctrl+B / Ctrl+I / Ctrl+Shift+X' },
      { action: 'Inline code', keys: 'Ctrl+E' },
      { action: 'Link', keys: 'Ctrl+K' },
      { action: 'Heading 1 / 2 / 3', keys: 'Ctrl+Alt+1 / 2 / 3' },
      { action: 'Bullet / Ordered / Task list', keys: 'Ctrl+Shift+8 / 7 / 9' },
      { action: 'Quote', keys: 'Ctrl+Shift+B' },
    ],
  },
];

/** A key combo rendered as <kbd> chips. */
function Keys({ keys }: { keys: string }) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {keys.split(/\s*\/\s*/).map((combo, i, all) => (
        <span key={combo} className="flex items-center gap-1">
          {combo.split('+').map((k) => (
            <kbd
              key={k}
              className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              {k}
            </kbd>
          ))}
          {i < all.length - 1 && <span className="text-muted-foreground">/</span>}
        </span>
      ))}
    </span>
  );
}

/** Searchable keyboard-shortcut sheet (§8.3), opened from the menu or Ctrl+/. */
export function ShortcutsPanel() {
  const open = useUiStore((s) => s.activePanel === 'shortcuts');
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => it.action.toLowerCase().includes(q) || it.keys.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  if (!open) return null;

  return (
    <Modal
      open
      onClose={() => setActivePanel(null)}
      title="Keyboard shortcuts"
      description="On macOS, use Cmd in place of Ctrl."
      size="lg"
    >
      <input
        type="search"
        role="searchbox"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter shortcuts…"
        aria-label="Filter shortcuts"
        className="mb-4 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        data-testid="shortcuts-filter"
      />
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No matching shortcuts.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li key={it.action} className="flex items-center justify-between gap-3 text-sm">
                    <span>{it.action}</span>
                    <Keys keys={it.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
