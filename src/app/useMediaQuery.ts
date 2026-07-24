import { useCallback, useSyncExternalStore } from 'react';

/** Small-screen breakpoint (§8.2): below this width the app is single-pane. */
export const SMALL_SCREEN_QUERY = '(max-width: 767px)';

/** Reactive media-query match. Falls back to `false` (desktop) without a DOM. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True on phone/tablet-width viewports (§8.2, D4): single-pane, no dual mode. */
export function useIsSmallScreen(): boolean {
  return useMediaQuery(SMALL_SCREEN_QUERY);
}
