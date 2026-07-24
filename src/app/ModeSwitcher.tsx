import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsSmallScreen } from '@/app/useMediaQuery';
import { useUiStore, type EditorMode } from '@/app/store/ui';

const MODES: { value: EditorMode; label: string; shortcut: string }[] = [
  { value: 'raw', label: 'Raw', shortcut: 'Ctrl+Shift+1' },
  { value: 'wysiwyg', label: 'WYSIWYG', shortcut: 'Ctrl+Shift+2' },
  { value: 'dual', label: 'Dual', shortcut: 'Ctrl+Shift+3' },
];

export function ModeSwitcher() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const isSmall = useIsSmallScreen();

  // Dual mode is desktop-only (D4); on small screens it falls back to WYSIWYG.
  const modes = isSmall ? MODES.filter((m) => m.value !== 'dual') : MODES;
  const value = isSmall && mode === 'dual' ? 'wysiwyg' : mode;

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) setMode(next as EditorMode);
      }}
      aria-label="Editor mode"
    >
      {modes.map((m) => (
        <ToggleGroupItem key={m.value} value={m.value} title={`${m.label} (${m.shortcut})`}>
          {m.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
