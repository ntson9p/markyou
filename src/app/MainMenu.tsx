import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notify } from '@/app/store/notices';
import { useUiStore } from '@/app/store/ui';
import { useDocStore } from '@/core/document/store';
import type { RecentRecord } from '@/core/storage/db';
import {
  newDocument,
  openDocument,
  openRecent,
  saveDocument,
  saveDocumentAs,
} from '@/features/files/actions';
import { listRecents } from '@/features/files/recents';
import { assetsSupported, requestAssetsFolder, useAssetsStore } from '@/features/images/assets';

async function chooseImagesFolder() {
  const ok = await requestAssetsFolder();
  if (ok) notify('info', 'Pasted images will be saved to the chosen folder as relative links.');
}

/** App menu per requirements §8.1. */
export function MainMenu() {
  const docOpen = useDocStore((s) => s.status === 'open');
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const imagesFolderSet = useAssetsStore((s) => s.dir != null);
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<RecentRecord[]>([]);

  useEffect(() => {
    if (open) void listRecents().then(setRecents);
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open menu">
          <Menu className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem onSelect={() => newDocument()}>
          New <DropdownMenuShortcut>Ctrl+Alt+N</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void openDocument()}>
          Open… <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={recents.length === 0}>
            Open recent
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-w-72">
              {recents.map((r) => (
                <DropdownMenuItem key={r.id} onSelect={() => void openRecent(r.handle)}>
                  <span className="truncate">{r.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!docOpen} onSelect={() => void saveDocument()}>
          Save <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!docOpen} onSelect={() => void saveDocumentAs()}>
          Save As… <DropdownMenuShortcut>Ctrl+Shift+S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!docOpen} onSelect={() => setActivePanel('diff')}>
          Review changes… <DropdownMenuShortcut>Ctrl+Shift+D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!docOpen} onSelect={() => setActivePanel('export')}>
          Export…
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!docOpen} onSelect={() => setActivePanel('history')}>
          History…
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!docOpen} onSelect={() => setActivePanel('metadata')}>
          Metadata…
        </DropdownMenuItem>
        {assetsSupported() && (
          <DropdownMenuItem onSelect={() => void chooseImagesFolder()}>
            {imagesFolderSet ? 'Change images folder…' : 'Images folder…'}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setActivePanel('shortcuts')}>
          Keyboard shortcuts <DropdownMenuShortcut>Ctrl+/</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setActivePanel('settings')}>
          Settings… <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
