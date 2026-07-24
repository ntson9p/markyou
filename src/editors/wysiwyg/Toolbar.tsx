import type { Editor } from '@milkdown/kit/core';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import type { CmdKey } from '@milkdown/kit/core';
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import {
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import {
  Bold,
  ChevronDown,
  Code,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  MoreHorizontal,
  Redo2,
  Sigma,
  Strikethrough,
  Table,
  Undo2,
} from 'lucide-react';

import { useRef } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRovingToolbar } from '@/lib/useRovingToolbar';
import { cn } from '@/lib/utils';

import {
  insertDiagramCommand,
  insertMathBlockCommand,
  insertMathInlineCommand,
  toggleTaskListCommand,
  wrapInCalloutCommand,
} from './commands';
import { openSourcePopover } from './views/source-popover';
import type { BlockType, WysiwygSelectionState } from './selection-state';
import { triggerLinkEdit } from './shortcuts';

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  paragraph: 'Paragraph',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  quote: 'Quote',
  code: 'Code block',
  callout: 'Callout',
  other: 'Paragraph',
};

interface ToolbarProps {
  editor: Editor | null;
  state: WysiwygSelectionState;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus in the editor; commands act on the current selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

/** Fixed WYSIWYG toolbar (FR-5.2) with selection-state reflection. */
export function WysiwygToolbar({ editor, state }: ToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  useRovingToolbar(toolbarRef);

  function run<T>(key: CmdKey<T>, payload?: T) {
    editor?.action((ctx) => {
      ctx.get(commandsCtx).call(key, payload);
      ctx.get(editorViewCtx).focus();
    });
  }

  const setBlockType = (type: BlockType) => {
    if (type.startsWith('h')) {
      run(wrapInHeadingCommand.key, Number(type.slice(1)));
    } else if (type === 'quote') {
      run(wrapInBlockquoteCommand.key);
    } else if (type === 'code') {
      run(createCodeBlockCommand.key);
    } else if (type === 'callout') {
      run(wrapInCalloutCommand.key);
    } else {
      run(turnIntoTextCommand.key);
    }
  };

  const openLinkEditor = () => {
    editor?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      triggerLinkEdit(ctx, view.state);
    });
  };

  const insertImage = (anchor: HTMLElement) => {
    openSourcePopover({
      anchor,
      value: '',
      label: 'Image URL',
      multiline: false,
      placeholder: 'https://… or relative path',
      onApply: (src) => {
        if (src.trim()) run(insertImageCommand.key, { src: src.trim() });
      },
    });
  };

  const disabled = editor === null;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        'flex items-center gap-0.5 border-b border-border bg-background px-2 py-1',
        // Mobile: one scrollable row of priority actions; desktop wraps.
        'flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible',
        '[&>*]:shrink-0',
      )}
      data-testid="wysiwyg-toolbar"
    >
      <ToolbarButton label="Undo (Ctrl+Z)" disabled={disabled} onClick={() => run(undoCommand.key)}>
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo (Ctrl+Y)" disabled={disabled} onClick={() => run(redoCommand.key)}>
        <Redo2 className="size-4" />
      </ToolbarButton>

      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="Block type"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            data-testid="block-type-trigger"
          >
            {BLOCK_TYPE_LABELS[state.blockType]}
            <ChevronDown className="size-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['paragraph', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'quote', 'code'] as BlockType[]).map(
            (type) => (
              <DropdownMenuItem key={type} onSelect={() => setBlockType(type)}>
                {BLOCK_TYPE_LABELS[type]}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <ToolbarButton
        label="Bold (Ctrl+B)"
        active={state.strong}
        disabled={disabled}
        onClick={() => run(toggleStrongCommand.key)}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        active={state.emphasis}
        disabled={disabled}
        onClick={() => run(toggleEmphasisCommand.key)}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough (Ctrl+Shift+X)"
        active={state.strikethrough}
        disabled={disabled}
        onClick={() => run(toggleStrikethroughCommand.key)}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code (Ctrl+E)"
        active={state.inlineCode}
        disabled={disabled}
        onClick={() => run(toggleInlineCodeCommand.key)}
      >
        <Code className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Link (Ctrl+K)"
        active={state.link}
        disabled={disabled}
        onClick={openLinkEditor}
      >
        <Link className="size-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list (Ctrl+Shift+8)"
        active={state.bulletList && !state.taskList}
        disabled={disabled}
        onClick={() => run(wrapInBulletListCommand.key)}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list (Ctrl+Shift+7)"
        active={state.orderedList}
        disabled={disabled}
        onClick={() => run(wrapInOrderedListCommand.key)}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Task list (Ctrl+Shift+9)"
        active={state.taskList}
        disabled={disabled}
        onClick={() => run(toggleTaskListCommand.key)}
      >
        <ListTodo className="size-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Insert table"
        active={state.inTable}
        disabled={disabled}
        onClick={() => run(insertTableCommand.key, { row: 3, col: 3 })}
      >
        <Table className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert image"
        disabled={disabled}
        onClick={() => {
          const anchor = document.querySelector<HTMLElement>('[data-testid="wysiwyg-toolbar"]');
          if (anchor) insertImage(anchor);
        }}
      >
        <Image className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert inline math"
        disabled={disabled}
        onClick={() => run(insertMathInlineCommand.key, '')}
      >
        <Sigma className="size-4" />
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="More blocks"
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            data-testid="toolbar-more"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => run(wrapInBlockquoteCommand.key)}>
            Quote (Ctrl+Shift+B)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(wrapInCalloutCommand.key, 'note')}>
            Callout
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(insertHrCommand.key)}>Divider</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(insertMathBlockCommand.key, '')}>
            Math block
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(insertDiagramCommand.key)}>
            Mermaid diagram
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
