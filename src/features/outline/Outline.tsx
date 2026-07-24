import { useEffect, useMemo, useState } from 'react';
import { PanelLeftClose } from 'lucide-react';

import { useEditorsStore } from '@/app/store/editors';
import { useUiStore } from '@/app/store/ui';
import { useDocStore } from '@/core/document/store';
import { topLevelBlockLines } from '@/core/markdown/blocks';
import { extractOutline, type OutlineItem } from '@/core/markdown/outline';
import { cn } from '@/lib/utils';

import { frontmatterLineOffset, jumpToBodyLine } from './jump';

/** The body line currently at the top of the active editor's viewport. */
function currentTopBodyLine(): number | null {
  const { cmView, wysiwygScrollEl } = useEditorsStore.getState();
  if (cmView) {
    const block = cmView.lineBlockAtHeight(cmView.scrollDOM.scrollTop);
    const rawLine = cmView.state.doc.lineAt(block.from).number;
    return rawLine - frontmatterLineOffset();
  }
  if (wysiwygScrollEl) {
    const pm = wysiwygScrollEl.querySelector<HTMLElement>('.ProseMirror');
    if (!pm) return null;
    const lines = topLevelBlockLines(useDocStore.getState().body);
    const cTop = wysiwygScrollEl.getBoundingClientRect().top;
    let idx = 0;
    for (let i = 0; i < pm.children.length; i++) {
      if ((pm.children[i] as HTMLElement).getBoundingClientRect().top - cTop <= 4) idx = i;
      else break;
    }
    return lines[Math.min(idx, lines.length - 1)] ?? 1;
  }
  return null;
}

/** Highlight the heading enclosing the top of the viewport (FR-10.1). */
function useActiveHeading(items: OutlineItem[]): number {
  const cmView = useEditorsStore((s) => s.cmView);
  const wysiwygScrollEl = useEditorsStore((s) => s.wysiwygScrollEl);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const scrollEl = cmView?.scrollDOM ?? wysiwygScrollEl;
    if (!scrollEl) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = currentTopBodyLine();
      if (line == null) return;
      let idx = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].line <= line + 1) idx = i;
        else break;
      }
      setActive(idx);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [cmView, wysiwygScrollEl, items]);

  return active;
}

/** Collapsible outline sidebar (FR-10.1): heading tree, jump, active section. */
export function Outline() {
  const body = useDocStore((s) => s.body);
  const toggleOutline = useUiStore((s) => s.toggleOutline);
  const items = useMemo(() => extractOutline(body), [body]);
  const active = useActiveHeading(items);

  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col border-r bg-muted/20"
      aria-label="Document outline"
      data-testid="outline"
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Outline
        <button
          type="button"
          onClick={toggleOutline}
          aria-label="Hide outline"
          className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {items.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No headings yet.</p>
        ) : (
          items.map((item, i) => (
            <button
              key={`${item.line}-${i}`}
              type="button"
              onClick={() => jumpToBodyLine(item.line)}
              title={item.text}
              data-active={i === active}
              className={cn(
                'block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                i === active && 'bg-accent font-medium text-accent-foreground',
              )}
              style={{ paddingLeft: `${0.5 + (item.depth - 1) * 0.75}rem` }}
            >
              {item.text || '(untitled heading)'}
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
