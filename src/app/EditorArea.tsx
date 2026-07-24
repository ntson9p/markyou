import { TextareaEditor } from '@/editors/placeholder/TextareaEditor';

/**
 * The pane region. M1: a placeholder textarea for every mode; M2/M3/M5
 * replace this with the CodeMirror/Milkdown adapters and the dual splitter.
 */
export function EditorArea() {
  return (
    <div className="h-full">
      <TextareaEditor />
    </div>
  );
}
