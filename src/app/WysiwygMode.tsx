import { useDocStore } from '@/core/document/store';
import { WysiwygToolbar } from '@/editors/wysiwyg/Toolbar';
import { WysiwygEditor } from '@/editors/wysiwyg/WysiwygEditor';
import { useWysiwygRegistration } from '@/editors/wysiwyg/useWysiwygRegistration';

import '@/styles/wysiwyg.css';

/**
 * WYSIWYG single mode (§8.1): fixed toolbar + centered Docs-like page
 * (max measure ~72ch, generous whitespace).
 */
export function WysiwygMode() {
  const docId = useDocStore((s) => s.docId);
  const { editor, selectionState, onEditorReady, onStateChange, registerScrollEl } =
    useWysiwygRegistration();

  return (
    <div className="flex h-full flex-col">
      <WysiwygToolbar editor={editor} state={selectionState} />
      <div
        ref={registerScrollEl}
        className="min-h-0 flex-1 overflow-y-auto bg-muted/30 motion-safe:scroll-smooth"
      >
        <div className="mx-auto my-8 min-h-[70%] w-full max-w-[min(72ch,calc(100%-2rem))] rounded-lg border border-border/60 bg-background px-10 py-12 shadow-sm">
          <WysiwygEditor key={docId} onEditorReady={onEditorReady} onStateChange={onStateChange} />
        </div>
      </div>
    </div>
  );
}
