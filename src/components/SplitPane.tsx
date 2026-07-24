import { useCallback, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  ratio: number;
  onRatioChange: (ratio: number) => void;
  minRatio?: number;
  maxRatio?: number;
  className?: string;
  dividerLabel?: string;
}

/**
 * Horizontal split with a draggable, keyboard-operable divider (FR-2.4).
 * Sizes persist via the caller's `ratio`/`onRatioChange` (FR-2.3).
 */
export function SplitPane({
  left,
  right,
  ratio,
  onRatioChange,
  minRatio = 0.2,
  maxRatio = 0.8,
  className,
  dividerLabel = 'Resize panes',
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback(
    (r: number) => Math.min(maxRatio, Math.max(minRatio, r)),
    [minRatio, maxRatio],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const divider = e.currentTarget;
    divider.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      onRatioChange(clamp((ev.clientX - rect.left) / rect.width));
    };
    const onUp = () => {
      divider.removeEventListener('pointermove', onMove);
      divider.removeEventListener('pointerup', onUp);
    };
    divider.addEventListener('pointermove', onMove);
    divider.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onRatioChange(clamp(ratio - 0.05));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onRatioChange(clamp(ratio + 0.05));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onRatioChange(minRatio);
    } else if (e.key === 'End') {
      e.preventDefault();
      onRatioChange(maxRatio);
    }
  };

  return (
    <div ref={containerRef} className={cn('flex h-full min-w-0', className)}>
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 shrink-0">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={dividerLabel}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="relative z-10 w-px shrink-0 cursor-col-resize bg-border outline-none after:absolute after:inset-y-0 after:-left-1.5 after:-right-1.5 after:content-[''] hover:bg-primary/60 focus-visible:bg-primary focus-visible:ring-2 focus-visible:ring-ring/60"
        data-testid="split-divider"
      />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}
