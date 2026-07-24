import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUiStore, type EditorMode } from '@/app/store/ui';

const MODES: { value: EditorMode; label: string; shortcut: string }[] = [
  { value: 'raw', label: 'Raw', shortcut: 'Ctrl+Shift+1' },
  { value: 'wysiwyg', label: 'WYSIWYG', shortcut: 'Ctrl+Shift+2' },
  { value: 'dual', label: 'Dual', shortcut: 'Ctrl+Shift+3' },
];

export function ModeSwitcher() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(value) => {
        if (value) setMode(value as EditorMode);
      }}
      aria-label="Editor mode"
    >
      {MODES.map((m) => (
        <ToggleGroupItem key={m.value} value={m.value} title={`${m.label} (${m.shortcut})`}>
          {m.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
