import { create } from 'zustand';

export interface Notice {
  id: number;
  kind: 'info' | 'error';
  message: string;
}

interface NoticesState {
  notices: Notice[];
  notify: (kind: Notice['kind'], message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Non-blocking, actionable notices (storage errors, fallback messaging — §7 reliability). */
export const useNoticesStore = create<NoticesState>()((set) => ({
  notices: [],
  notify: (kind, message) => {
    const id = nextId++;
    set((s) => ({ notices: [...s.notices, { id, kind, message }] }));
    const ttl = kind === 'error' ? 10_000 : 5_000;
    setTimeout(() => {
      set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
    }, ttl);
  },
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

export function notify(kind: Notice['kind'], message: string) {
  useNoticesStore.getState().notify(kind, message);
}
