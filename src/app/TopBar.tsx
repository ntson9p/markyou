import { MainMenu } from '@/app/MainMenu';
import { ModeSwitcher } from '@/app/ModeSwitcher';
import { ThemeToggle } from '@/app/ThemeToggle';

export function TopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2">
      <MainMenu />
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium" data-testid="doc-title">
          Untitled
        </span>
      </div>
      <div className="flex flex-1 justify-center">
        <ModeSwitcher />
      </div>
      <ThemeToggle />
    </header>
  );
}
