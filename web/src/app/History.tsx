import { ChevronLeft, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, ErrorNote, Spinner, cn } from "@logue/ui";
import { api, type DiffLine, type Version } from "../api";
import { timeAgo, useAction, useHost } from "./useHost";

/**
 * What keeps a history, and what going back to it costs.
 *
 * Written out here rather than passed in from each page: these have to keep
 * the same identity between renders, and an inline `() => api.…` would ask the
 * Host again on every keystroke in the editor behind the dialog.
 */
export interface Kind {
  versions: (id: string) => Promise<{ versions: Version[] }>;
  diff: (id: string, revision: number) => Promise<{ lines: DiffLine[] }>;
  restore: (id: string, revision: number) => Promise<unknown>;
  /** One line under the list, in this thing's own terms. */
  note: string;
}

export const DOCUMENT: Kind = {
  versions: api.documentVersions,
  diff: api.documentDiff,
  restore: api.restoreDocument,
  // The button's verb, used for the whole act: one word or the person is
  // left wondering whether restoring and going back are two things.
  note: "Going back keeps every version; unsaved changes are saved first.",
};

export const SKILL: Kind = {
  versions: api.skillVersions,
  diff: api.skillDiff,
  restore: api.restoreSkill,
  note: "Going back writes a new revision; Runs keep the prompt they ran with.",
};

/** How long to wait between asking whether the missing lines have arrived. */
const SUMMARY_WAIT_MS = 1500;
/** And how many times, before leaving the counted line to stand on its own. */
const SUMMARY_TRIES = 10;

/** "+3 −1", or nothing at all when a version changed no lines. */
function Change({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) return null;
  return (
    <span className="shrink-0 font-mono text-xs">
      {added > 0 && <span className="text-success">+{added}</span>}
      {added > 0 && removed > 0 && " "}
      {removed > 0 && <span className="text-danger">−{removed}</span>}
    </span>
  );
}

function Entry({ version, onOpen }: { version: Version; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
    >
      {/* The top entry is the working copy, not a version, so it does not
          wear a number a save has not written yet. */}
      <span className="w-14 shrink-0 text-xs text-muted">{version.current ? "now" : `v${version.revision}`}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">
          {/* `||`, not `??`: an empty summary is a version that changed no
              visible line, and it falls through to the plain word. */}
          {version.summary ||
            (version.summary_state === "pending" ? (
              <span className="text-muted">Summarizing…</span>
            ) : version.current ? (
              version.unsaved ? (
                "Unsaved changes"
              ) : (
                "As saved"
              )
            ) : (
              "Edited"
            ))}
        </span>
        {version.created_at && <span className="text-xs text-muted">{timeAgo(version.created_at)}</span>}
      </span>
      <Change added={version.added} removed={version.removed} />
      {/* An agent's save, told apart from the person's: the history is where
          the two must stay tellable apart. The current row needs no chip —
          "now" on the left is the whole fact. */}
      {version.author === "agent" && !version.current && (
        <span className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-1.5 text-[10px] font-[650] text-accent-ink">
          agent
        </span>
      )}
    </button>
  );
}

/** One version's changes, against the version before it. */
function Diff({ kind, id, revision }: { kind: Kind; id: string; revision: number }) {
  const lines = useHost(() => kind.diff(id, revision), [kind, id, revision]);
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
    return <p className="px-2 py-4 text-xs text-muted">No visible change.</p>;
  }
  return (
    <div className="logue-scroll max-h-80 rounded-md border border-line">
      {found.map((line) => (
        // A diff line is identified by where it sits on each side: two
        // identical lines in one text are still different lines.
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
  );
}

/**
 * Everything a document — or a Skill's prompt — has been.
 *
 * Both have written every edit down since they existed; until now neither had
 * a screen that could read them back, which is the worst of both costs: the
 * storage without the safety. Going back is written forward as a new edit, so
 * the versions it skipped over are still there afterwards.
 */
export function History({
  kind,
  id,
  open,
  onClose,
  onRestored,
}: {
  kind: Kind;
  id: string;
  open: boolean;
  onClose: () => void;
  /** It changed underneath the editor; the page has to re-read. */
  onRestored: () => void;
}) {
  const [looking, setLooking] = useState<Version>();
  const versions = useHost(
    () => (open ? kind.versions(id) : Promise.resolve({ versions: [] })),
    [kind, id, open],
  );
  const action = useAction();

  // A model is writing the lines that are still missing — documents only, and
  // only for a while. Ask again until they arrive, then stop; give up rather
  // than poll forever, because a model that never answers should still leave a
  // list you can read.
  const waiting = (versions.data?.versions ?? []).some((one) => one.summary_state === "pending");
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!open) {
      setTries(0);
      return;
    }
    if (!waiting || tries >= SUMMARY_TRIES) return;
    const timer = window.setTimeout(() => {
      setTries((n) => n + 1);
      void versions.refresh();
    }, SUMMARY_WAIT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, waiting, tries]);

  const close = () => {
    setLooking(undefined);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      // The row's own name: `v4` the way every surface writes it, and the
      // working copy is "Now" — never a number no save has written.
      title={looking ? (looking.current ? "Now" : `v${looking.revision}`) : "History"}
    >
      {versions.error && <ErrorNote>{versions.error}</ErrorNote>}
      {action.error && <ErrorNote>{action.error}</ErrorNote>}

      {looking ? (
        <>
          <button
            type="button"
            onClick={() => setLooking(undefined)}
            className="flex items-center gap-1 self-start rounded-md py-0.5 text-xs text-muted hover:text-ink"
          >
            <ChevronLeft size={13} /> History
          </button>
          <Diff kind={kind} id={id} revision={looking.revision} />
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
                      await kind.restore(id, looking.revision);
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
      ) : versions.loading && !versions.data ? (
        <p className="flex items-center gap-2 py-4 text-xs text-muted">
          <Spinner size={12} /> Reading
        </p>
      ) : (
        <>
          <div className="logue-scroll -mx-1 max-h-80">
            {(versions.data?.versions ?? []).map((version) => (
              <Entry key={version.revision} version={version} onOpen={() => setLooking(version)} />
            ))}
          </div>
          <p className="text-xs text-muted">{kind.note}</p>
          <DialogActions>
            <Button onClick={close}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
