import { create } from 'zustand';

/**
 * Bridge between the plain-DOM diagram NodeView and the React modal editor
 * (FR-5.9). The NodeView calls `openDiagramEditor` with the current source and
 * a commit callback; `DiagramEditorModal`, mounted in the app shell, renders
 * the session. Transient UI state — never persisted.
 */
export interface DiagramEditorSession {
  /** Identity of this editing session; keys the modal's draft state. */
  id: number;
  /** Source the session opened with; the modal owns the draft from here. */
  value: string;
  /** Commit the edited source back into the document. */
  onApply: (value: string) => void;
  /** Called on close, applied or not (the NodeView restores editor focus). */
  onClose?: () => void;
}

export type DiagramEditorRequest = Omit<DiagramEditorSession, 'id'>;

interface DiagramEditorState {
  session: DiagramEditorSession | null;
  open: (request: DiagramEditorRequest) => void;
  close: () => void;
}

let nextSessionId = 0;

export const useDiagramEditorStore = create<DiagramEditorState>()((set, get) => ({
  session: null,
  open: (request) => set({ session: { ...request, id: ++nextSessionId } }),
  close: () => {
    const { session } = get();
    if (!session) return;
    set({ session: null });
    session.onClose?.();
  },
}));

/** Open the full-screen mermaid editor (callable from plain-DOM NodeViews). */
export function openDiagramEditor(request: DiagramEditorRequest): void {
  useDiagramEditorStore.getState().open(request);
}

/**
 * True while the editor owns the screen. The WYSIWYG adapter checks this
 * before applying a deferred external document replace: the modal blurs the
 * editor, and replacing the document underneath would destroy the NodeView
 * whose position the pending edit targets (silently dropping it).
 */
export function isDiagramEditorOpen(): boolean {
  return useDiagramEditorStore.getState().session !== null;
}
