import { useState, type ReactNode } from "react";
import { cn } from "@logue/ui";

/**
 * Past this a section stops being a navigator and becomes a scroll.
 *
 * Taken from watching the same rail elsewhere render every group it had — 127
 * of them, a rail twelve screens tall, with the account footer somewhere below
 * the fold. The first few are the ones touched recently; the rest are history,
 * one click away.
 */
export const RAIL_LIMIT = 12;

export interface RailEntry {
  id: string;
  /** What the row reads as. Kept to one line. */
  title: string;
  /** A quiet second fact, when there is one worth the width. */
  detail?: string;
  /** Anything that must be seen without opening the row — a count, a dot. */
  mark?: ReactNode;
}

/**
 * A section's own list, in the rail underneath it.
 *
 * The list is the navigator and the main area is the one thing you picked —
 * the arrangement chatgpt.com and Codex use, and the reason neither of them
 * needs a list and a detail fighting for the same screen.
 */
export function RailList({
  entries,
  selectedId,
  onSelect,
  empty,
  loading = false,
}: {
  entries: RailEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
  empty: string;
  loading?: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, RAIL_LIMIT);
  const hidden = entries.length - shown.length;

  if (loading && entries.length === 0) {
    return <p className="px-2 py-1 text-[11px] text-faint">Loading</p>;
  }
  if (entries.length === 0) {
    return <p className="px-2 py-1 text-[11px] text-faint">{empty}</p>;
  }

  return (
    <div className="grid gap-px">
      {shown.map((entry) => {
        const active = entry.id === selectedId;
        return (
          <button
            key={entry.id}
            type="button"
            aria-current={active ? "true" : undefined}
            title={entry.title}
            onClick={() => onSelect(entry.id)}
            className={cn(
              "flex min-h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs",
              active ? "bg-active font-[560] text-ink" : "text-ink-soft hover:bg-hover",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{entry.title}</span>
            {entry.mark}
          </button>
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-md px-2 py-1 text-left text-[11px] text-faint hover:bg-hover hover:text-muted"
        >
          {hidden} more
        </button>
      )}
    </div>
  );
}
