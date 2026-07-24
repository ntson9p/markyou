import { useEffect, type RefObject } from 'react';

/**
 * ARIA toolbar keyboard pattern (§a11y, WCAG 2.1.1): the toolbar is a single
 * Tab stop and Arrow keys move focus between its controls. Exactly one enabled
 * control carries `tabindex="0"` at a time (the roving one); the rest are
 * `tabindex="-1"`. Home/End jump to the ends.
 *
 * Tabindex is managed on the DOM (not in JSX) so React re-renders — which fire
 * on every selection change — don't clobber it. A MutationObserver watches for
 * buttons enabling/disabling (all toolbar buttons flip together when the editor
 * mounts) and re-normalizes; it deliberately ignores `tabindex` so our own
 * writes can't loop.
 */
export function useRovingToolbar(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const items = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button')).filter(
        (b) => !b.hasAttribute('disabled'),
      );

    const normalize = (preferred?: HTMLElement | null) => {
      const list = items();
      if (list.length === 0) return;
      const focused = list.find((b) => b === document.activeElement);
      const active =
        preferred && list.includes(preferred)
          ? preferred
          : (focused ?? list.find((b) => b.tabIndex === 0) ?? list[0]);
      for (const b of list) b.tabIndex = b === active ? 0 : -1;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
      const list = items();
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      const last = list.length - 1;
      const next =
        key === 'Home'
          ? 0
          : key === 'End'
            ? last
            : key === 'ArrowRight'
              ? (idx + 1) % list.length
              : (idx - 1 + list.length) % list.length;
      e.preventDefault();
      normalize(list[next]);
      list[next].focus();
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLButtonElement && el.contains(t)) normalize(t);
    };

    normalize();
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('focusin', onFocusIn);
    const mo = new MutationObserver(() => normalize());
    mo.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });

    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('focusin', onFocusIn);
      mo.disconnect();
    };
  }, [ref]);
}
