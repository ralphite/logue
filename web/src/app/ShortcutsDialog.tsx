import { Dialog } from "@logue/ui";
import { SHORTCUTS } from "./shortcuts";

/**
 * The keys, read from the same table the badges read from — so a badge can
 * never promise a key the app stopped answering to.
 */
export function ShortcutsList() {
  return (
    <div className="grid gap-1.5">
      {SHORTCUTS.map((shortcut) => (
        <p key={shortcut.keys} className="flex items-baseline gap-3 text-[13px]">
          <kbd className="w-28 shrink-0 font-sans text-xs text-muted">{shortcut.keys}</kbd>
          <span className="text-ink-soft">{shortcut.what}</span>
        </p>
      ))}
    </div>
  );
}

/** The same list, for `?` — which is itself one of the keys on it. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <ShortcutsList />
    </Dialog>
  );
}
