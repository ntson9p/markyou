import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

/**
 * Milkdown's list-item-block component renders
 * `<ul><div.milkdown-list-item-block><li.list-item>…</li></div></ul>` — the
 * intervening `<div>` between `<ul>` and `<li>` breaks the semantic list
 * structure (axe `list` + `listitem`, both serious). Re-map ARIA roles so the
 * wrapper is the accessible list item and the inner `<li>` is presentational:
 *   ul/ol > div[role=listitem] > li[role=presentation]
 *
 * setAttribute to an unchanged value emits no mutation, so re-running on every
 * view update is idempotent and cannot loop with ProseMirror's DOM observer.
 */
export const listA11yPlugin = $prose(
  () =>
    new Plugin({
      view: (view) => {
        const fix = () => {
          const wrappers = view.dom.querySelectorAll<HTMLElement>('.milkdown-list-item-block');
          for (const wrapper of wrappers) {
            wrapper.setAttribute('role', 'listitem');
            const li = wrapper.querySelector<HTMLElement>(':scope > li.list-item');
            if (li) li.setAttribute('role', 'presentation');
          }
        };
        fix();
        return { update: fix };
      },
    }),
);
