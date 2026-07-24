import { useMemo } from 'react';

import { SplitPane } from '@/components/SplitPane';
import { useDocStore } from '@/core/document/store';
import { Preview } from '@/editors/preview/Preview';
import { RawEditor } from '@/editors/raw/RawEditor';
import { useRawPreviewScrollSync } from '@/features/scrollsync/useRawPreviewScrollSync';
import { useIsSmallScreen } from '@/app/useMediaQuery';
import { useUiStore } from '@/app/store/ui';

/** Raw mode (FR-3): CodeMirror source editor + toggleable live preview column. */
export function RawMode() {
  const previewVisible = useUiStore((s) => s.rawPreviewVisible);
  const rawSplit = useUiStore((s) => s.rawSplit);
  const setRawSplit = useUiStore((s) => s.setRawSplit);
  const frontmatterBlock = useDocStore((s) => s.frontmatter.rawBlock);
  const isSmall = useIsSmallScreen();

  const lineOffset = useMemo(
    () => (frontmatterBlock ? frontmatterBlock.split('\n').length - 1 : 0),
    [frontmatterBlock],
  );

  // Side-by-side sync only runs when both panes are visible (desktop split).
  const { setView, setPreview, invalidateAnchors } = useRawPreviewScrollSync({
    enabled: previewVisible && !isSmall,
    lineOffset,
  });

  // Mobile: the preview toggle replaces the source pane rather than splitting
  // the narrow viewport into two columns (§8.2).
  if (isSmall && previewVisible) {
    return (
      <div className="h-full" data-testid="raw-preview-full">
        <Preview onContainerReady={setPreview} onRendered={invalidateAnchors} />
      </div>
    );
  }

  if (!previewVisible) {
    return <RawEditor onViewReady={setView} />;
  }

  return (
    <SplitPane
      ratio={rawSplit}
      onRatioChange={setRawSplit}
      dividerLabel="Resize editor and preview"
      left={<RawEditor onViewReady={setView} />}
      right={
        <div className="h-full border-l-0">
          <Preview onContainerReady={setPreview} onRendered={invalidateAnchors} />
        </div>
      }
    />
  );
}
