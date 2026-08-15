import { bulletListSchema, orderedListSchema } from '@milkdown/kit/preset/commonmark';
import { extendListItemSchemaForTask } from '@milkdown/kit/preset/gfm';

/**
 * Upstream Milkdown stores list `spread` attrs as the STRINGS "true"/"false"
 * (template-literal coercion) and passes them straight to remark-stringify,
 * where "false" is truthy — every tight list would serialize loose, changing
 * rendering (tight items vs `<p>`-wrapped items). These schema extensions
 * store real booleans and pass real booleans back, so tight/loose round-trips
 * losslessly (D13 rule 2: structure is preserved).
 *
 * Registered after preset-gfm; the last schema registered for a node id wins.
 */

const toBool = (v: unknown): boolean => v === true || v === 'true';

export const bulletListSpreadFix = bulletListSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx);
  return {
    ...base,
    parseMarkdown: {
      match: base.parseMarkdown.match,
      runner: (state, node, type) => {
        state
          .openNode(type, { spread: node.spread === true })
          .next(node.children)
          .closeNode();
      },
    },
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        state
          .openNode('list', undefined, { ordered: false, spread: toBool(node.attrs.spread) })
          .next(node.content)
          .closeNode();
      },
    },
  };
});

export const orderedListSpreadFix = orderedListSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx);
  return {
    ...base,
    parseMarkdown: {
      match: base.parseMarkdown.match,
      runner: (state, node, type) => {
        state
          .openNode(type, { spread: node.spread === true, order: node.start ?? 1 })
          .next(node.children)
          .closeNode();
      },
    },
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        state
          .openNode('list', undefined, {
            ordered: true,
            start: (node.attrs.order as number) ?? 1,
            spread: toBool(node.attrs.spread),
          })
          .next(node.content)
          .closeNode();
      },
    },
  };
});

/** Extends the task-list extension (keeping `checked`) with boolean spread. */
export const listItemSpreadFix = extendListItemSchemaForTask.extendSchema((prev) => (ctx) => {
  const base = prev(ctx);
  return {
    ...base,
    /**
     * Upstream defaults `list_item.spread` to `true` while both list nodes
     * default to `false`, so an item born from the `- ` input rule (which calls
     * `createAndFill()` with no attrs) is loose inside a tight list — a state
     * remark never produces. It stays invisible until the item gains a second
     * child, because `mdast-util-to-markdown` only consults an item's spread
     * when joining its own children; then it writes a blank line between the
     * paragraph and its nested list, which makes the whole list loose on
     * reparse. `splitListItem`/`sinkListItem` copy attrs from the item they act
     * on, so creation is the only way the default is ever read.
     */
    attrs: { ...base.attrs, spread: { default: false, validate: 'boolean' } },
    parseMarkdown: {
      match: base.parseMarkdown.match,
      runner: (state, node, type) => {
        const label = node.label != null ? `${node.label as string}.` : '•';
        const listType = node.label != null ? 'ordered' : 'bullet';
        const spread = node.spread === true;
        const checked = node.checked != null ? Boolean(node.checked) : null;
        state.openNode(type, { label, listType, spread, checked });
        state.next(node.children);
        state.closeNode();
      },
    },
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        const props: Record<string, unknown> = { spread: toBool(node.attrs.spread) };
        if (node.attrs.checked != null) props.checked = node.attrs.checked;
        state.openNode('listItem', undefined, props as never);
        state.next(node.content);
        state.closeNode();
      },
    },
  };
});

export const listSpreadFixes = [
  bulletListSpreadFix,
  orderedListSpreadFix,
  listItemSpreadFix,
].flat();
