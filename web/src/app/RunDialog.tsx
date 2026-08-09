import { useState } from "react";
import { Answer, Button, Dialog, DialogActions, ErrorNote, OriginMark, SourceLink, Spinner, originOf } from "@logue/ui";
import { api } from "../api";
import { timeAgo, useHost } from "./useHost";

/**
 * An answer, read back after the fact.
 *
 * A Run in a list printed its Skill, its Source count and when it happened,
 * and every one of those was dead text: the answer itself had nowhere to be
 * read, and "28 Sources" named twenty-eight things you could not reach. An
 * answer nobody can open is a record of work rather than the work.
 */
export function RunDialog({
  id,
  open,
  onClose,
  onOpenSource,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Into the Stream, where the Source lives. */
  onOpenSource: (id: string) => void;
}) {
  const [cited, setCited] = useState<number>();
  const loaded = useHost(
    () => (open ? api.run(id) : Promise.resolve(undefined)),
    [id, open],
  );

  const run = loaded.data?.run;
  const sources = loaded.data?.sources ?? [];
  const shown = cited === undefined ? undefined : sources[cited - 1];

  const close = () => {
    setCited(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={run?.instruction || "Answer"}>
      {loaded.error && <ErrorNote>{loaded.error}</ErrorNote>}
      {loaded.loading && !loaded.data && (
        <p className="flex items-center gap-2 py-4 text-xs text-muted">
          <Spinner size={12} /> Reading
        </p>
      )}

      {run && (
        <>
          <OriginMark
            origin="ai"
            detail={`${run.skill_name} · ${sources.length} Sources · ${timeAgo(run.created_at)}`}
          />
          <p className="logue-scroll max-h-64 text-[13px] leading-[1.6] whitespace-pre-wrap text-ink">
            <Answer text={run.original_output ?? ""} onCite={setCited} open={cited} sources={sources} />
          </p>

          {shown && (
            <div className="rounded-md bg-surface-muted p-2">
              <OriginMark origin={originOf(shown.kind)} detail={shown.source?.domain || "This Mac"} />
              <p className="mt-1 line-clamp-6 text-xs leading-[1.5] text-ink-soft">{shown.content}</p>
            </div>
          )}

          {/* Every Source it stood on, each one click from where it lives. The
              count in the row above is what opens this; leaving the list out
              would move the dead end one screen along rather than remove it. */}
          {sources.length > 0 && (
            <div role="list" aria-label="Sources behind this answer" className="logue-scroll -mx-1 max-h-48">
              {sources.map((source, index) => (
                <button
                  key={source.id}
                  type="button"
                  role="listitem"
                  onClick={() => {
                    onOpenSource(source.id);
                    close();
                  }}
                  className="flex w-full min-w-0 items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-hover"
                >
                  <span className="w-6 shrink-0 font-mono text-xs text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ink">{source.content || "Empty"}</span>
                    {source.source?.url && (
                      <SourceLink url={source.source.url} label={source.source.domain || source.source.url} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <DialogActions>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
