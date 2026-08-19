import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, DialogActions, ErrorNote, Notice, Spinner, cn } from "@logue/ui";
import { api } from "../api";
import { useAction, useHost } from "./useHost";

/**
 * An agent finished while this document had moved on; its result waits here.
 *
 * The person rules on it: read what would change, take it, or drop it —
 * nothing lands on its own. Applying saves the working copy's unsaved words
 * as a user version before the agent's content does, because nothing that
 * replaces the working copy may lose it.
 */
export function PendingChange({ id, onSettled }: { id: string; onSettled: () => void }) {
  const [reading, setReading] = useState(false);
  const action = useAction();
  // Asked for only while the dialog is up: the diff is against the working
  // copy, which moves with every keystroke behind this banner.
  const pending = useHost(
    () => (reading ? api.pendingChange(id) : Promise.resolve({ pending: null, lines: [] })),
    [id, reading],
  );

  const settle = (how: () => Promise<unknown>) =>
    void action.run(how).then((ok) => {
      if (ok) {
        setReading(false);
        onSettled();
      }
    });

  return (
    <>
      <Notice
        tone="quiet"
        className="mb-3"
        action={
          <Button onClick={() => setReading(true)} disabled={action.busy}>
            Review
          </Button>
        }
      >
        An agent finished a change while you were editing. Your words were kept; nothing was overwritten.
      </Notice>
      {action.error && <ErrorNote className="mb-3">{action.error}</ErrorNote>}

      <Dialog open={reading} onClose={() => setReading(false)} title="Agent change">
        {pending.error && <ErrorNote>{pending.error}</ErrorNote>}
        {pending.loading ? (
          <p className="flex items-center gap-2 px-2 py-4 text-xs text-muted">
            <Spinner size={12} /> Reading
          </p>
        ) : (
          <div className="logue-scroll max-h-80 rounded-md border border-line">
            {(pending.data?.lines ?? []).map((line) => (
              <p
                key={`${line.kind}:${line.old}:${line.new}`}
                className={cn(
                  "flex gap-2 px-2 py-0.5 text-xs leading-[1.5]",
                  line.kind === "added" && "bg-success-soft text-ink",
                  line.kind === "removed" && "bg-danger-soft text-muted line-through",
                  line.kind === "same" && "text-muted",
                )}
              >
                <span aria-hidden className="w-3 shrink-0 select-none text-center font-mono">
                  {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : ""}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text || " "}</span>
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">Applying saves your current text as a version first.</p>
        <DialogActions>
          <Button disabled={action.busy} onClick={() => settle(() => api.discardPendingChange(id))}>
            <X size={13} /> Discard
          </Button>
          <Button
            data-primary
            variant="primary"
            disabled={action.busy}
            onClick={() => settle(() => api.applyPendingChange(id))}
          >
            {action.busy ? <Spinner size={13} /> : <Check size={13} />} Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
