import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNoticesStore } from '@/app/store/notices';

export function Notices() {
  const notices = useNoticesStore((s) => s.notices);
  const dismiss = useNoticesStore((s) => s.dismiss);

  if (notices.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-10 z-50 flex w-80 flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.id}
          role={n.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-lg border bg-popover p-3 text-sm shadow-lg',
            n.kind === 'error' && 'border-destructive/40',
          )}
        >
          <p className="min-w-0 flex-1">{n.message}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mt-1 -mr-1 size-6"
            aria-label="Dismiss notice"
            onClick={() => dismiss(n.id)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
