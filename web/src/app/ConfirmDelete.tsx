import { Button, Dialog, DialogActions, ErrorNote, Spinner } from "@logue/ui";
import { useEffect, useState } from "react";

/**
 * What a deletion takes with it, before it takes it.
 *
 * Deleting here is not deleting a row: an answer cited this Source, a document
 * is standing on it, a Skill has runs that are only explainable while it
 * exists. Asking "are you sure?" with nothing behind it puts the work of
 * remembering on the person. This asks the Host what would break and says so.
 *
 * The impact is loaded when the dialog opens rather than on the row, so the
 * cost is paid by someone who is already deciding.
 */
export function ConfirmDelete({
  open,
  title,
  what,
  impact,
  kept,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** "Delete this Source" — the dialog's heading. */
  title: string;
  /** What is being deleted, in the person's own words. */
  what: string;
  /** Loads the consequences. Called when the dialog opens. */
  impact: () => Promise<string[]>;
  /** What survives, said out loud so a deletion never looks bigger than it is. */
  kept?: string;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [lines, setLines] = useState<string[]>();

  useEffect(() => {
    if (!open) {
      setLines(undefined);
      return;
    }
    let current = true;
    void impact().then(
      (found) => current && setLines(found),
      () => current && setLines([]),
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <p className="text-[13px] leading-normal text-ink">{what}</p>

      {lines === undefined ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Spinner size={12} /> Checking what depends on it
        </p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted">Nothing else depends on it.</p>
      ) : (
        <div className="grid gap-1 rounded-md border border-line bg-surface-muted px-2.5 py-2">
          <span className="text-xs text-warning">This is what it takes with it</span>
          {lines.map((line) => (
            <span key={line} className="text-xs text-ink-soft">
              {line}
            </span>
          ))}
        </div>
      )}

      {kept && <p className="text-xs text-muted">{kept}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button data-primary variant="danger" disabled={busy || lines === undefined} onClick={onConfirm}>
          {busy ? <Spinner size={13} /> : null} Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
