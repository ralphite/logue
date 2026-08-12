import { useMemo, useState } from "react";
import { ACTS, ActBadge, ErrorNote, Glyph, Spinner, cn, type ActKind } from "@logue/ui";
import { type Material } from "../api";

/**
 * Activities: everything the person did, newest first — the middle pane.
 *
 * Named by the owner — "it's a list of different actions from the user" — a
 * recording made, a passage kept, a page saved. Not an inbox: there was a
 * triage queue at the top of this page for exactly one deploy, 250 cards
 * asking for approval of the auto-filer's suggestions, and the owner's
 * verdict was that he could not name the feature it served. Filing happens
 * silently; each Source carries its own receipt.
 *
 * The pane is 486px against the detail's remainder, rows are 82px against a
 * 30px badge, and the day is a sticky 31px cap — the approved mock's numbers,
 * kept exactly, because the density is the design.
 */
export function ActivitiesList({
  items,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  items: Material[];
  loading: boolean;
  error?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"" | ActKind>("");
  const kinds = Object.keys(ACTS).filter(isKind);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((one) => {
      if (kind && kindOf(one) !== kind) return false;
      if (!needle) return true;
      const haystack = [one.content, one.source?.domain, one.source?.title, ...(one.projects ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, kind]);

  const groups = useMemo(() => {
    const byDay = new Map<string, Material[]>();
    for (const one of shown) {
      const day = dayOf(one.created_at);
      const bucket = byDay.get(day);
      if (bucket) bucket.push(one);
      else byDay.set(day, [one]);
    }
    return [...byDay.entries()];
  }, [shown]);

  return (
    <section aria-label="Activities" className="flex w-[486px] flex-none flex-col border-r border-line bg-surface">
      <header className="flex-none border-b border-line bg-panel px-4">
        <div className="flex h-[58px] items-baseline gap-2">
          <h1 className="text-[18px] font-[700] tracking-[-0.025em] text-ink">Activities</h1>
          <span className="text-[11px] font-[550] tabular-nums text-muted">{items.length || ""}</span>
          <span className="ml-auto text-[10.5px] font-[500] text-muted">Newest first</span>
        </div>
        <div className="flex items-start gap-2 pb-4">
          <label className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-line-strong bg-surface px-3 focus-within:border-accent-line">
            <Glyph name="search" className="h-[15px] w-[15px] flex-none text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words, pages, or projects"
              className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-faint"
            />
          </label>
          <select
            aria-label="Filter by action"
            value={kind}
            onChange={(event) => setKind(isKind(event.target.value) ? event.target.value : "")}
            className="h-[38px] w-[144px] flex-none appearance-none rounded-[9px] border border-line-strong bg-surface bg-[image:var(--logue-chevron)] bg-[position:right_10px_center] bg-no-repeat pr-7 pl-3 text-[12.5px] font-[500] text-ink-soft"
          >
            <option value="">All actions</option>
            {kinds.map((one) => (
              <option key={one} value={one}>
                {ACTS[one].label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="logue-scroll min-h-0 flex-1">
        {error && (
          <div className="p-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 p-4 text-xs text-muted">
            <Spinner /> Loading
          </div>
        )}
        {!loading && !error && shown.length === 0 && (
          <p className="p-4 text-xs leading-relaxed text-muted">
            {items.length === 0
              ? "Nothing here yet. Speak into the side panel, or save a passage from any page."
              : "Nothing matches. Clear the search or the filter to see everything again."}
          </p>
        )}
        {groups.map(([day, rows]) => (
          <section key={day}>
            <div className="sticky top-0 z-[5] flex h-[31px] items-center border-b border-line bg-panel/95 px-[15px] text-[9.5px] font-[700] tracking-[0.13em] text-muted uppercase backdrop-blur-sm">
              {day}
            </div>
            {rows.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function ActivityRow({ item, selected, onSelect }: { item: Material; selected: boolean; onSelect: () => void }) {
  const kind = kindOf(item);
  const excerpt = condense(item.content);
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "relative grid w-full grid-cols-[30px_minmax(0,1fr)] gap-x-[11px] border-b border-line py-[10px] pr-[14px] pl-[13px] text-left transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-hover-soft",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      <ActBadge kind={kind} className="mt-px" />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate text-[11.5px] font-[650] tracking-[-0.005em]", ACTS[kind].ink)}>
            {ACTS[kind].label}
          </span>
          <span className="ml-auto flex-none text-[10.5px] tabular-nums text-muted">{clockOf(item.created_at)}</span>
        </span>
        <span className="mt-[3px] block truncate text-[12.7px] font-[430] leading-[1.35] text-ink/85" title={excerpt}>
          {excerpt || "Empty"}
        </span>
        <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10.5px] leading-none text-muted">
          {item.capture_seconds ? (
            <span className="inline-flex flex-none items-center gap-[3px] tabular-nums">
              <Glyph name="clock" />
              {duration(item.capture_seconds)}
            </span>
          ) : null}
          {item.projects?.[0] && (
            <span className="max-w-[132px] flex-none truncate rounded-full border border-line bg-surface-muted px-[7px] py-[3px] text-[9.8px] font-[600] text-ink-soft">
              {item.projects[0]}
            </span>
          )}
          {item.source?.domain && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <Glyph name="globe" className="flex-none" />
              <span className="truncate">{item.source.domain}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/**
 * What the person DID, as one of seven kinds.
 *
 * The owner's words: "actions are different with different type and
 * purpose" — "input and page translation are very different, also voice
 * comment/dictation". Same audio pipe, different acts; the badge and the
 * verb's ink carry the kind so a mixed day splits without reading.
 */
export function kindOf(item: Material): ActKind {
  if (item.kind === "voice") {
    if (item.parent_ids?.length) return "comment";
    if (item.source?.kind === "dictation") return "dictated";
    if (item.source?.kind === "panel") return "spoke";
    if (item.source?.url) return "dictated";
    return "spoke";
  }
  if (item.kind === "selection") return "kept";
  if (item.kind === "page") return "saved";
  if (item.kind === "derived") return "generated";
  return "typed";
}

function isKind(value: string): value is ActKind {
  return value in ACTS;
}

/** Midnight of the date, for whole-day arithmetic. */
function floorDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Today · Yesterday · a weekday for the past week · "Mar 4" beyond it. */
function dayOf(iso: string): string {
  const then = new Date(iso);
  const days = Math.round((floorDay(new Date()) - floorDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString("en-US", { weekday: "long" });
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The row's own clock — the day is already the group's name. */
function clockOf(iso: string): string {
  const then = new Date(iso);
  return `${then.getHours()}:${String(then.getMinutes()).padStart(2, "0")}`;
}

function duration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The first line, breathable. */
function condense(content: string, limit = 160): string {
  const line = content.split("\n").find((one) => one.trim()) ?? "";
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}
