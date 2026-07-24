export function StatusBar() {
  return (
    <footer
      className="flex h-7 shrink-0 items-center gap-4 border-t bg-background px-3 text-xs text-muted-foreground"
      aria-label="Status bar"
    >
      <span data-testid="status-counts">0 words · 0 characters</span>
      <span className="flex-1" />
      <span data-testid="status-save">No document</span>
    </footer>
  );
}
