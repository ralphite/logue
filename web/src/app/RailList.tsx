import { ChevronDown, ChevronRight, MoreHorizontal, Pin } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ContextMenu, MenuHeading, MenuItem, MenuSeparator, cn, type MenuPoint } from "@logue/ui";

/**
 * Past this a section stops being a navigator and becomes a scroll.
 *
 * Taken from watching the same rail elsewhere render every group it had — 127
 * of them, a rail twelve screens tall, with the account footer somewhere below
 * the fold. The first few are the ones touched recently; the rest are history,
 * one click away.
 */
export const RAIL_LIMIT = 12;
/** Inside a group the same rule applies, tighter: a group is a glance. */
export const GROUP_LIMIT = 6;
/** And the number of groups, so the sections below one stay reachable. */
export const GROUPS_LIMIT = 8;

export interface RailAction {
  label: string;
  onRun: () => void;
  /** Given when the action is worth a button on the row itself. */
  icon?: ReactNode;
  tone?: "default" | "danger";
}

export interface RailEntry {
  id: string;
  /** What the row reads as. Kept to one line. */
  title: string;
  /** A quiet second fact, when there is one worth the width. */
  detail?: string;
  /** Anything that must be seen without opening the row — a count, a dot. */
  mark?: ReactNode;
  /** Something here is waiting on a decision: the row goes bold with a dot. */
  waiting?: boolean;
  /** Kept at the top, above everything else, in its own section. */
  pinned?: boolean;
  /** Which group heading this row sits under. Absent means a flat list. */
  group?: string;
  /** What the hover card says. A function so a resting list builds none. */
  preview?: () => ReactNode;
  /** Everything the row can do, in the menu — the first two also on hover. */
  actions?: RailAction[];
}

/** Touch has no hover, so the actions have to be somewhere you can tap. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return coarse;
}

/**
 * Which groups are folded, remembered.
 *
 * Held locally rather than in the workspace: this is how someone left their
 * window, not something about their work. It is read synchronously on the
 * first render — reading it a tick later painted every group open and then
 * snapped them shut on every cold load.
 */
function useFolds(storageKey: string) {
  const key = `logue.rail.folded.${storageKey}`;
  const [folded, setFolded] = useState<Set<string>>(() => {
    try {
      const raw: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []);
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback(
    (group: string) => {
      setFolded((was) => {
        const next = new Set(was);
        if (!next.delete(group)) next.add(group);
        try {
          window.localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          // The fold still works when storage is unavailable.
        }
        return next;
      });
    },
    [key],
  );
  return { folded, toggle };
}

/** The card that appears beside a hovered row, placed next to that row. */
function PreviewCard({ anchor, children }: { anchor: DOMRect; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top);

  useLayoutEffect(() => {
    const height = card.current?.getBoundingClientRect().height ?? 0;
    setTop(Math.max(8, Math.min(anchor.top, window.innerHeight - height - 8)));
  }, [anchor]);

  return (
    <div
      ref={card}
      role="tooltip"
      aria-hidden
      // Fixed and pointer-transparent: it hangs outside the rail's scroll box,
      // and a card that took the pointer would flicker the row it describes.
      style={{ position: "fixed", left: anchor.right + 8, top, maxWidth: 320 }}
      className="logue-float pointer-events-none z-popover grid gap-1 p-2.5 text-xs"
    >
      {children}
    </div>
  );
}

function RailRow({
  entry,
  active,
  onSelect,
  onMenu,
  onHover,
  coarse,
}: {
  entry: RailEntry;
  active: boolean;
  onSelect: (id: string) => void;
  onMenu: (entry: RailEntry, at: MenuPoint) => void;
  onHover: (entry: RailEntry, rect?: DOMRect) => void;
  coarse: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const quick = (entry.actions ?? []).filter((action) => action.icon).slice(0, 2);

  // The chosen row is often the one a Show more is hiding, or the one a fresh
  // sort just moved. Bring it back into view rather than leave the rail
  // looking like nothing is selected.
  useEffect(() => {
    if (active) row.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      ref={row}
      // The whole row lights up, including the actions at its end. Colouring
      // only the button left a hovered row looking like two separate things.
      // `min-w-0` because a grid item will not shrink below its content by
      // default: without it a long first line makes every row wider than the
      // rail and the titles run off the edge instead of ending in an ellipsis.
      className={cn(
        "group/row relative flex min-w-0 items-center rounded-md",
        active ? "bg-active" : "hover:bg-hover focus-within:bg-hover",
      )}
      onMouseEnter={() => onHover(entry, row.current?.getBoundingClientRect())}
      onMouseLeave={() => onHover(entry, undefined)}
    >
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(entry.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          onHover(entry, undefined);
          onMenu(entry, { x: event.clientX, y: event.clientY, returnTo: event.currentTarget });
        }}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onMenu(entry, { x: rect.left, y: rect.bottom + 2, returnTo: event.currentTarget });
        }}
        className={cn(
          "flex min-h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-xs outline-none",
          coarse && "min-h-11",
          active ? "font-[560] text-ink" : "text-ink-soft",
          entry.waiting && !active && "font-[560] text-ink",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{entry.title}</span>
        {entry.detail && <span className="shrink-0 text-[11px] text-faint">{entry.detail}</span>}
      </button>

      <span
        className={cn(
          "flex shrink-0 items-center gap-0.5 pr-1",
          // Hovering hides the resting marks to make room, rather than letting
          // the row grow and shift every title under the pointer.
          !coarse && "group-hover/row:hidden group-focus-within/row:hidden",
        )}
      >
        {entry.mark}
        {entry.waiting && (
          <span
            aria-label="Waiting for you"
            title="Waiting for you"
            className="size-1.5 rounded-full bg-accent"
          />
        )}
        {entry.pinned && <Pin size={11} aria-label="Pinned" className="text-faint" />}
      </span>

      {(entry.actions?.length ?? 0) > 0 &&
        (coarse ? (
          <button
            type="button"
            aria-label={`Actions for ${entry.title}`}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onMenu(entry, { x: rect.left, y: rect.bottom + 2, returnTo: event.currentTarget });
            }}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted"
          >
            <MoreHorizontal size={14} />
          </button>
        ) : (
          <span className="hidden shrink-0 items-center gap-0.5 pr-1 group-hover/row:flex group-focus-within/row:flex">
            {quick.map((action) => (
              <button
                key={action.label}
                type="button"
                aria-label={action.label}
                title={action.label}
                onClick={() => action.onRun()}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-ink"
              >
                {action.icon}
              </button>
            ))}
            <button
              type="button"
              aria-label={`Actions for ${entry.title}`}
              title="Actions"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onHover(entry, undefined);
                onMenu(entry, { x: rect.left, y: rect.bottom + 2, returnTo: event.currentTarget });
              }}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-ink"
            >
              <MoreHorizontal size={14} />
            </button>
          </span>
        ))}
    </div>
  );
}

/** The line above a group, and the control that folds it. */
function GroupHeading({
  name,
  count,
  folded,
  onToggle,
}: {
  name: string;
  count: number;
  folded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={!folded}
      onClick={onToggle}
      // Larger than the rows under it. A group name set smaller than its own
      // children reverses the hierarchy it is supposed to establish.
      className="flex min-h-7 w-full items-center gap-1 rounded-md px-1.5 text-left text-[11px] font-[560] tracking-[0.01em] text-muted hover:bg-hover hover:text-ink"
    >
      {folded ? (
        <ChevronRight size={11} aria-hidden className="shrink-0" />
      ) : (
        <ChevronDown size={11} aria-hidden className="shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 pr-0.5 text-faint">{count}</span>
    </button>
  );
}

function More({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-left text-[11px] text-faint hover:bg-hover hover:text-muted"
    >
      {label}
    </button>
  );
}

/**
 * Keep the chosen row visible even when a limit would have cut it.
 *
 * A list that hides what you are currently looking at reads as though nothing
 * is selected. An explicit fold is different — that is someone saying they do
 * not want to see this group — so folding still wins over it.
 */
function withSelected(rows: RailEntry[], limit: number, selectedId?: string): RailEntry[] {
  const shown = rows.slice(0, limit);
  if (!selectedId || shown.some((row) => row.id === selectedId)) return shown;
  const chosen = rows.find((row) => row.id === selectedId);
  return chosen ? [...shown, chosen] : shown;
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
  storageKey,
  onVisibleOrder,
}: {
  entries: RailEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
  empty: string;
  loading?: boolean;
  /** Names this list's folds in local storage. */
  storageKey: string;
  /** The ids as they read down the rail, for the keys that step through them. */
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const coarse = useCoarsePointer();
  const { folded, toggle } = useFolds(storageKey);
  const [allRows, setAllRows] = useState(false);
  const [allGroups, setAllGroups] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ entry: RailEntry; at: MenuPoint }>();
  const [hover, setHover] = useState<{ entry: RailEntry; rect: DOMRect }>();

  const onHover = useCallback((entry: RailEntry, rect?: DOMRect) => {
    setHover((was) => (rect ? { entry, rect } : was?.entry.id === entry.id ? undefined : was));
  }, []);

  const onMenu = useCallback((entry: RailEntry, at: MenuPoint) => setMenu({ entry, at }), []);

  // The card is placed next to a row at a moment in time; scrolling the rail
  // moves the row out from under it and leaves the card describing whatever
  // slid into that spot.
  useEffect(() => {
    if (!hover) return;
    const drop = () => setHover(undefined);
    window.addEventListener("scroll", drop, true);
    return () => window.removeEventListener("scroll", drop, true);
  }, [hover]);

  const pinned = entries.filter((entry) => entry.pinned);
  const rest = entries.filter((entry) => !entry.pinned);
  // Rows with nowhere to belong stay a flat list under the groups: no heading,
  // no fold arrow, no indent. Inventing a "No Project" folder for them would
  // make the absence of a Project look like a Project.
  const loose = rest.filter((entry) => !entry.group);

  // Groups in the order their first row appears, so the caller's sort decides
  // which group is most recent without the rail sorting a second time.
  const groups = useMemo(() => {
    const byName = new Map<string, RailEntry[]>();
    for (const entry of rest) {
      if (!entry.group) continue;
      const list = byName.get(entry.group);
      if (list) list.push(entry);
      else byName.set(entry.group, [entry]);
    }
    return [...byName];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const holdsSelected = (rows: RailEntry[]) => rows.some((row) => row.id === selectedId);
  const shownGroups = allGroups
    ? groups
    : (() => {
        const head = groups.slice(0, GROUPS_LIMIT);
        if (!selectedId || head.some(([, rows]) => holdsSelected(rows))) return head;
        const owner = groups.find(([, rows]) => holdsSelected(rows));
        return owner ? [...head, owner] : head;
      })();

  const looseRows = withSelected(loose, allRows ? loose.length : RAIL_LIMIT, selectedId);
  const rowsOf = (name: string, rows: RailEntry[]) =>
    folded.has(name)
      ? []
      : withSelected(rows, expanded.has(name) ? rows.length : GROUP_LIMIT, selectedId);

  // Published so the keys that step through the rail move to what is actually
  // on screen — stepping onto a row hidden behind a Show more looks broken.
  const order = [
    ...pinned,
    ...shownGroups.flatMap(([name, rows]) => rowsOf(name, rows)),
    ...looseRows,
  ].map((row) => row.id);
  const orderKey = order.join(" ");
  useEffect(() => {
    onVisibleOrder?.(orderKey ? orderKey.split(" ") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  if (loading && entries.length === 0) {
    return (
      <div role="status" aria-label="Loading" className="grid gap-1.5 px-2 py-2">
        {[70, 90, 55].map((width) => (
          <span key={width} style={{ width: `${width}%` }} className="h-3 animate-pulse rounded-sm bg-surface-muted" />
        ))}
      </div>
    );
  }
  // One empty state for the whole list. A per-section one would print the same
  // sentence three times on a rail with nothing in it.
  if (entries.length === 0) {
    return <p className="px-2 py-1 text-[11px] text-faint">{empty}</p>;
  }

  const row = (entry: RailEntry) => (
    <RailRow
      key={entry.id}
      entry={entry}
      active={entry.id === selectedId}
      onSelect={onSelect}
      onMenu={onMenu}
      onHover={onHover}
      coarse={coarse}
    />
  );

  return (
    <div className="grid gap-px">
      {pinned.length > 0 && (
        <>
          <GroupHeading
            name="Pinned"
            count={pinned.length}
            folded={folded.has(" pinned")}
            onToggle={() => toggle(" pinned")}
          />
          {!folded.has(" pinned") && pinned.map(row)}
        </>
      )}

      {shownGroups.map(([name, rows]) => {
        const shown = rowsOf(name, rows);
        const hidden = rows.length - shown.length;
        return (
          <div key={name} className="grid gap-px">
            <GroupHeading
              name={name}
              count={rows.length}
              folded={folded.has(name)}
              onToggle={() => toggle(name)}
            />
            {shown.map(row)}
            {!folded.has(name) && hidden > 0 && (
              <More label={`${hidden} more`} onClick={() => setExpanded((was) => new Set(was).add(name))} />
            )}
          </div>
        );
      })}
      {groups.length > GROUPS_LIMIT && (
        <More
          label={allGroups ? "Show fewer groups" : `${groups.length - GROUPS_LIMIT} more groups`}
          onClick={() => setAllGroups(!allGroups)}
        />
      )}

      {looseRows.map(row)}
      {loose.length > RAIL_LIMIT && (
        <More
          label={allRows ? "Show fewer" : `${loose.length - RAIL_LIMIT} more`}
          onClick={() => setAllRows(!allRows)}
        />
      )}

      {/* One card and one menu for the whole list, and never both: two panels
          racing for the same corner is how a right-click ends up reading a
          preview instead. */}
      {hover && !menu && hover.entry.preview && (
        <PreviewCard anchor={hover.rect}>{hover.entry.preview()}</PreviewCard>
      )}
      <ContextMenu at={menu?.at} onClose={() => setMenu(undefined)} label="Row actions">
        <MenuHeading>{menu?.entry.title}</MenuHeading>
        {(menu?.entry.actions ?? []).map((action, index) => (
          <div key={action.label}>
            {action.tone === "danger" && index > 0 && <MenuSeparator />}
            <MenuItem tone={action.tone} onClick={() => action.onRun()}>
              {action.label}
            </MenuItem>
          </div>
        ))}
      </ContextMenu>
    </div>
  );
}
