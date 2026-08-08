import { Check, CornerDownLeft, Undo2, X } from "lucide-react";
import type { CSSProperties } from "react";
import { Button, ErrorNote, IconButton, Spinner } from "@logue/ui";

/**
 * The transcript on its way into the page: one editable block, one primary
 * action. Once it lands, the panel collapses to a single confirmation row —
 * state replaces chrome.
 */
export function Candidate({
  text,
  style,
  busy,
  inserted,
  error,
  onChange,
  onInsert,
  onUndo,
  onDismiss,
}: {
  text: string;
  style?: CSSProperties;
  busy?: boolean;
  inserted?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onInsert: () => void;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  if (inserted) {
    return (
      <section
        style={style}
        aria-label="Inserted"
        className="logue-float fixed z-surface flex h-row w-max items-center gap-0.5 p-1 pl-2"
      >
        <Check size={14} className="text-success" />
        <span className="pr-1.5 pl-1 text-xs text-ink-soft">Inserted</span>
        <Button onClick={onUndo} disabled={busy}>
          <Undo2 size={13} /> Undo
        </Button>
        <IconButton label="Done" onClick={onDismiss}>
          <X size={14} />
        </IconButton>
      </section>
    );
  }

  return (
    <section
      style={style}
      aria-label="Transcript"
      className="logue-float fixed z-surface w-[min(340px,calc(100vw-16px))]"
    >
      <IconButton label="Discard" className="absolute top-1 right-1 z-10" onClick={onDismiss}>
        <X size={14} />
      </IconButton>
      <textarea
        autoFocus
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onInsert();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onDismiss();
          }
        }}
        aria-label="Text to insert"
        className="block max-h-52 min-h-20 w-full resize-y border-0 bg-transparent py-2 pr-8 pl-2.5 text-[13px] leading-[1.5] text-ink outline-0"
      />
      {error && <ErrorNote className="mx-2.5 mb-1.5">{error}</ErrorNote>}
      <footer className="flex h-row items-center justify-end gap-0.5 border-t border-line p-1">
        <Button variant="primary" disabled={busy || !text.trim()} onClick={onInsert}>
          {busy ? <Spinner size={13} /> : <CornerDownLeft size={13} />} Insert <kbd>⌘↵</kbd>
        </Button>
      </footer>
    </section>
  );
}
