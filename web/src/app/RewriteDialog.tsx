import { useState } from "react";
import { Button, Dialog, DialogActions, ErrorNote, Spinner, Textarea, cn } from "@logue/ui";
import { api, type RewriteHunk } from "../api";
import { useAction } from "./useHost";

/**
 * A model's rewrite of a selected passage, decided change by change.
 *
 * The model proposes; nothing lands until the person has ruled on each
 * change and pressed Apply — and applying is an ordinary edit, recorded by
 * the same history as any other. This is the shape the in-place question
 * resolved to: the model may touch the document, but only through a person's
 * accept, one change at a time.
 */
export function RewriteDialog({
  documentId,
  selection,
  open,
  onClose,
  onApply,
}: {
  documentId: string;
  selection: string;
  open: boolean;
  onClose: () => void;
  /** Replace the selection in the editor with this text. */
  onApply: (text: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [hunks, setHunks] = useState<(RewriteHunk & { id: string })[]>();
  /** For each change hunk, whether its replacement is accepted. On by default. */
  const [taken, setTaken] = useState<Record<number, boolean>>({});
  const action = useAction();

  const close = () => {
    setInstruction("");
    setHunks(undefined);
    setTaken({});
    onClose();
  };

  const propose = () =>
    void action.run(async () => {
      const result = await api.rewriteSelection(documentId, selection, instruction);
      // Ids minted on arrival: hunks are never reordered, but a list key must
      // outlive a re-render on its own name, not its position.
      setHunks(result.hunks.map((hunk, index) => ({ ...hunk, id: `hunk-${index}` })));
      setTaken(Object.fromEntries(result.hunks.map((h, i) => (h.kind === "change" ? [i, true] : []))));
    });

  /** The final text: kept stretches, plus each change as the person ruled. */
  const assembled = (hunks ?? [])
    .flatMap((hunk, index) => {
      if (hunk.kind === "same") return hunk.lines;
      return taken[index] ? hunk.after : hunk.before;
    })
    .join("\n");

  const changes = (hunks ?? []).filter((h) => h.kind === "change").length;

  return (
    <Dialog open={open} onClose={close} title="Rewrite the selection">
      {action.error && <ErrorNote>{action.error}</ErrorNote>}

      {!hunks ? (
        <>
          <p className="logue-scroll max-h-24 rounded-md bg-surface-muted p-2 text-xs leading-[1.5] whitespace-pre-wrap text-ink-soft">
            {selection}
          </p>
          <Textarea
            autoFocus
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="How should it change? — tighten it, make it plainer, turn it into a list…"
            aria-label="How to rewrite"
            className="min-h-16"
          />
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button data-primary variant="primary" disabled={!instruction.trim() || action.busy} onClick={propose}>
              {action.busy ? <Spinner size={13} /> : null} Propose
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <div className="logue-scroll max-h-80 rounded-md border border-line">
            {hunks.map((hunk, index) =>
              hunk.kind === "same" ? (
                <p key={hunk.id} className="px-2 py-1 text-xs leading-[1.5] whitespace-pre-wrap text-faint">
                  {hunk.lines.join("\n")}
                </p>
              ) : (
                <button
                  key={hunk.id}
                  type="button"
                  aria-pressed={Boolean(taken[index])}
                  onClick={() => setTaken((was) => ({ ...was, [index]: !was[index] }))}
                  title={taken[index] ? "Accepted — click to keep the original" : "Rejected — click to take the rewrite"}
                  className="block w-full border-y border-line text-left"
                >
                  <span
                    className={cn(
                      "block px-2 py-1 text-xs leading-[1.5] whitespace-pre-wrap",
                      taken[index] ? "text-muted line-through opacity-60" : "bg-surface-muted text-ink",
                    )}
                  >
                    {hunk.before.join("\n") || " "}
                  </span>
                  <span
                    className={cn(
                      "block px-2 py-1 text-xs leading-[1.5] whitespace-pre-wrap",
                      taken[index] ? "bg-success-soft text-ink" : "text-muted line-through opacity-60",
                    )}
                  >
                    {hunk.after.join("\n") || " "}
                  </span>
                </button>
              ),
            )}
          </div>
          <p className="text-[11px] text-faint">
            {changes === 0
              ? "The rewrite changes nothing a reader would see."
              : "Click a change to take it or keep the original. Applying is an ordinary edit — the history keeps every version."}
          </p>
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button
              data-primary
              variant="primary"
              disabled={action.busy || changes === 0}
              onClick={() => {
                onApply(assembled);
                close();
              }}
            >
              Apply
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
