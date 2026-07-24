import { MainMenu } from '@/app/MainMenu';
import { ModeSwitcher } from '@/app/ModeSwitcher';
import { ThemeToggle } from '@/app/ThemeToggle';
import { useDocStore } from '@/core/document/store';

export function TopBar() {
  const status = useDocStore((s) => s.status);
  const dirty = useDocStore((s) => s.dirty);
  const fileName = useDocStore((s) => s.file?.name);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2">
      <MainMenu />
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium" data-testid="doc-title">
          {status === 'open' ? (fileName ?? 'Untitled') : 'MarkYou'}
        </span>
        {status === 'open' && dirty && (
          <span
            className="size-2 shrink-0 rounded-full bg-primary"
            role="status"
            aria-label="Unsaved changes"
            data-testid="dirty-dot"
          />
        )}
      </div>
      <div className="flex flex-1 justify-center">{status === 'open' && <ModeSwitcher />}</div>
      <ThemeToggle />
    </header>
  );
}
