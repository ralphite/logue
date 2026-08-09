import { ChevronLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, DialogActions, ErrorNote, Spinner, cn } from "@logue/ui";
import { api, type DocumentVersion } from "../api";
import { timeAgo, useAction, useHost } from "./useHost";

/** "+3 −1", or nothing at all when a version changed no lines. */
function Change({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) return null;
  return (
    <span className="shrink-0 font-mono text-[11px]">
      {added > 0 && <span className="text-success">+{added}</span>}
      {added > 0 && removed > 0 && " "}
      {removed > 0 && <span className="text-danger">−{removed}</span>}
    </span>
  );
}

function Version({
  version,
  onOpen,
}: {
  version: DocumentVersion;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
    >
      <span className="w-14 shrink-0 text-xs text-muted">v{version.revision}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">
          {version.summary ??
            (version.summary_state === "pending" ? "Working out what changed…" : version.current ? "Now" : "Edited")}
        </span>
        {version.created_at && <span className="text-[11px] text-faint">{timeAgo(version.created_at)}</span>}
      </span>
      <Change added={version.added} removed={version.removed} />
      {version.current && <span className="shrink-0 text-[11px] text-faint">current</span>}
    </button>
  );
}

/** One version's changes, against the version before it. */
function Diff({ id, revision }: { id: string; revision: number }) {
  const lines = useHost(() => api.documentDiff(id, revision), [id, revision]);
  if (lines.loading) {
    return (
      <p className="flex items-center gap-2 px-2 py-4 text-xs text-muted">
        <Spinner size={12} /> Reading
      </p>
    );
  }
  if (lines.error) return <ErrorNote>{lines.error}</ErrorNote>;
  const found = lines.data?.lines ?? [];
  if (found.every((line) => line.kind === "same")) {
    return <p className="px-2 py-4 text-xs text-muted">Nothing a reader would see changed here.</p>;
  }
  return (
    <div className="logue-scroll max-h-80 rounded-md border border-line">
      {found.map((line) => (
        // A diff line is identified by where it sits on each side: two
        // identical lines in one document are still different lines.
        <p
          key={`${line.kind}:${line.old}:${line.new}`}
          className={cn(
            "flex gap-2 px-2 py-0.5 text-xs leading-[1.5]",
            line.kind === "added" && "bg-success-soft text-ink",
            line.kind === "removed" && "bg-danger-soft text-muted line-through",
            line.kind === "same" && "text-faint",
          )}
        >
          <span aria-hidden className="w-3 shrink-0 select-none text-center font-mono">
            {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : ""}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text || " "}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Everything this document has been.
 *
 * Every edit has been written down since the first one; until now there was no
 * screen that could read them back, which is the worst of both costs — the
 * storage without the safety. Going back is written forward as a new edit, so
 * the versions it skipped over are still there afterwards.
 */
export function DocumentHistory({
  id,
  open,
  onClose,
  onRestored,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  /** The document changed under the editor; it has to re-read. */
  onRestored: () => void;
}) {
  const [looking, setLooking] = useState<DocumentVersion>();
  const versions = useHost(() => (open ? api.documentVersions(id) : Promise.resolve({ versions: [] })), [id, open]);
  const action = useAction();

  const close = () => {
    setLooking(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={looking ? `Version ${looking.revision}` : "History"}>
      {versions.error && <ErrorNote>{versions.error}</ErrorNote>}
      {action.error && <ErrorNote>{action.error}</ErrorNote>}

      {looking ? (
        <>
          <button
            type="button"
            onClick={() => setLooking(undefined)}
            className="flex items-center gap-1 self-start rounded-md py-0.5 text-xs text-muted hover:text-ink"
          >
            <ChevronLeft size={13} /> All versions
          </button>
          <Diff id={id} revision={looking.revision} />
          <DialogActions>
            <Button onClick={close}>Close</Button>
            {!looking.current && (
              <Button
                data-primary
                variant="primary"
                disabled={action.busy}
                onClick={() =>
                  void action
                    .run(async () => {
                      await api.restoreDocument(id, looking.revision);
                      onRestored();
                    })
                    .then((ok) => ok && close())
                }
              >
                {action.busy ? <Spinner size={13} /> : <RotateCcw size={13} />} Go back to this
              </Button>
            )}
          </DialogActions>
        </>
      ) : versions.loading ? (
        <p className="flex items-center gap-2 py-4 text-xs text-muted">
          <Spinner size={12} /> Reading
        </p>
      ) : (
        <>
          <div className="logue-scroll -mx-1 max-h-80">
            {(versions.data?.versions ?? []).map((version) => (
              <Version key={version.revision} version={version} onOpen={() => setLooking(version)} />
            ))}
          </div>
          <p className="text-[11px] text-faint">Going back keeps everything — it is written as a new version.</p>
          <DialogActions>
            <Button onClick={close}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
