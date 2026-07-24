import { useState } from 'react';
import { ClipboardCopy, FileCode2, Printer } from 'lucide-react';

import { useUiStore } from '@/app/store/ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useDocStore } from '@/core/document/store';
import { suggestFileName } from '@/features/files/filename';

export function ExportPanel() {
  const open = useUiStore((s) => s.activePanel === 'export');
  return open ? <ExportDialog /> : null;
}

function ExportDialog() {
  const close = () => useUiStore.getState().setActivePanel(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (kind: 'html' | 'pdf' | 'copy') => {
    const store = useDocStore.getState();
    const base = suggestFileName(store).replace(/\.[^.]+$/, '');
    const title =
      (typeof store.frontmatter.data?.title === 'string' && store.frontmatter.data.title) || base;
    setBusy(true);
    setStatus('Preparing…');
    try {
      // Lazy-load the export pipeline (inlined KaTeX CSS + Mermaid) so it stays
      // out of the initial bundle (§7).
      if (kind === 'html') {
        const { buildStandaloneHtml, downloadHtml } = await import('./html-standalone');
        downloadHtml(`${base}.html`, await buildStandaloneHtml(title, store.body));
        setStatus(`Downloaded ${base}.html`);
      } else if (kind === 'pdf') {
        const { printDocument } = await import('./print-pdf');
        await printDocument(title, store.body);
        setStatus('Opened the print dialog — choose “Save as PDF”.');
      } else {
        const { copyAsRichText } = await import('./copy-rich');
        await copyAsRichText(store.body);
        setStatus('Copied rich text to the clipboard.');
      }
    } catch (e) {
      setStatus(e instanceof Error ? `Export failed: ${e.message}` : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title="Export"
      description="Everything self-contained — styles, math, and diagrams are inlined."
      footer={
        <Button size="sm" variant="ghost" onClick={close}>
          Close
        </Button>
      }
    >
      <div className="space-y-2" data-testid="export-actions">
        <ExportRow
          icon={<FileCode2 className="size-4" />}
          label="HTML"
          hint="A single self-contained .html file (FR-11.1)."
          onClick={() => run('html')}
          disabled={busy}
          testid="export-html"
        />
        <ExportRow
          icon={<Printer className="size-4" />}
          label="PDF"
          hint="Opens the print dialog with a print-optimized layout (FR-11.2)."
          onClick={() => run('pdf')}
          disabled={busy}
          testid="export-pdf"
        />
        <ExportRow
          icon={<ClipboardCopy className="size-4" />}
          label="Copy as rich text"
          hint="Paste into Docs, Word, or email (FR-11.3)."
          onClick={() => run('copy')}
          disabled={busy}
          testid="export-copy"
        />
      </div>
      {status && (
        <p className="mt-3 text-xs text-muted-foreground" role="status" data-testid="export-status">
          {status}
        </p>
      )}
    </Modal>
  );
}

function ExportRow({
  icon,
  label,
  hint,
  onClick,
  disabled,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled: boolean;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:bg-accent disabled:opacity-50"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
