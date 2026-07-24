import {
  defaultValueCtx,
  Editor,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
} from '@milkdown/kit/core';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { cursor } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { indent } from '@milkdown/kit/plugin/indent';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import * as commonmarkExports from '@milkdown/kit/preset/commonmark';
import { commonmark, remarkInlineLinkPlugin } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';

import {
  DEFAULT_STYLE_PREFS,
  toStringifyOptions,
  type MarkdownStylePrefs,
} from '@/core/markdown/style';

import { calloutMarkerHandler, calloutNodes } from './nodes/callout';
import { definitionNodes } from './nodes/definition';
import { diagramNodes } from './nodes/diagram';
import { htmlBlockNodes } from './nodes/html-block';
import { mathNodes } from './nodes/math';
import { listSpreadFixes } from './plugins/list-spread-fix';
import { remarkReferencesPlugin } from './plugins/references';
import { wysiwygRemarkPlugins } from './plugins/remark-plugins';

/**
 * Exported at runtime but missing from the package typings.
 * preserve-empty-line rewrites empty paragraphs to `<br />` html on
 * serialize; inside list items that grows a new `<br />` per round-trip
 * (non-idempotent), and it injects HTML the user never wrote. Empty
 * paragraphs are transient editing state — dropping them on serialize is the
 * correct normalization.
 */
const remarkPreserveEmptyLinePlugin = (
  commonmarkExports as unknown as Record<
    'remarkPreserveEmptyLinePlugin',
    typeof remarkInlineLinkPlugin
  >
).remarkPreserveEmptyLinePlugin;

/**
 * preset-commonmark minus `remark-inline-links` (silently drops link
 * definitions — content loss; our references plugin resolves references and
 * preserves definitions as chips) and minus preserve-empty-line (see above).
 */
const EXCLUDED_PRESET_PLUGINS = new Set([
  remarkInlineLinkPlugin.plugin,
  remarkInlineLinkPlugin.options,
  remarkPreserveEmptyLinePlugin.plugin,
  remarkPreserveEmptyLinePlugin.options,
]);

const commonmarkPreset = commonmark.filter((plugin) => !EXCLUDED_PRESET_PLUGINS.has(plugin));

export interface CreateWysiwygEditorOptions {
  root: HTMLElement;
  defaultValue?: string;
  stylePrefs?: MarkdownStylePrefs;
  /** Reactive editable flag; defaults to always-editable. */
  editable?: () => boolean;
  /** Fires on every user-driven markdown change (undebounced — adapters debounce). */
  onMarkdownUpdated?: (markdown: string) => void;
}

/**
 * Milkdown's preserve-empty-line plugin serializes a truly empty document
 * (one empty paragraph) as `<br />`. An empty document must serialize to an
 * empty string — apply this to every serializer output.
 */
export function normalizeSerialized(doc: ProseNode, markdown: string): string {
  const first = doc.firstChild;
  if (doc.childCount === 1 && first?.type.name === 'paragraph' && first.content.size === 0) {
    return '';
  }
  return markdown;
}

/**
 * The single WYSIWYG serializer configuration (plan §3.1): shared stringify
 * style prefs + the calloutMarker verbatim handler.
 */
export function wysiwygStringifyOptions(prefs: MarkdownStylePrefs) {
  return {
    ...toStringifyOptions(prefs),
    // Handlers for custom mdast nodes; the upstream type only enumerates
    // built-in node types, hence the cast.
    handlers: { calloutMarker: calloutMarkerHandler } as unknown as NonNullable<
      import('remark-stringify').Options['handlers']
    >,
  };
}

/**
 * Builds the Milkdown editor used by both the app (WysiwygEditor component)
 * and the round-trip corpus — the corpus therefore tests the exact grammar
 * configuration that ships (plan §1, §3).
 *
 * Plugin order matters: presets register before the custom nodes so that
 * ProseMirror's default block filler resolves to `paragraph` (a `callout`
 * registered first would recurse — its content is `block+`). Parse-matcher
 * conflicts are avoided by re-tagging mdast types in the remark transforms
 * instead of relying on registration order.
 */
export function createWysiwygEditor(options: CreateWysiwygEditorOptions): Promise<Editor> {
  const prefs = options.stylePrefs ?? DEFAULT_STYLE_PREFS;

  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, options.root);
      ctx.set(defaultValueCtx, options.defaultValue ?? '');
      ctx.set(remarkStringifyOptionsCtx, wysiwygStringifyOptions(prefs));
      if (options.editable) {
        ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, editable: options.editable }));
      }
      if (options.onMarkdownUpdated) {
        const on = options.onMarkdownUpdated;
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) on(markdown);
        });
      }
    })
    .use(wysiwygRemarkPlugins)
    .use(remarkReferencesPlugin)
    .use(commonmarkPreset)
    .use(gfm)
    .use(listSpreadFixes)
    .use(calloutNodes)
    .use(diagramNodes)
    .use(htmlBlockNodes)
    .use(mathNodes)
    .use(definitionNodes)
    .use(history)
    .use(clipboard)
    .use(cursor)
    .use(indent)
    .use(listener)
    .create();
}
