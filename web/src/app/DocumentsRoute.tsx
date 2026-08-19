import { ChevronRight, Download, History as HistoryIcon, MoreHorizontal, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, cn, Empty, ErrorNote, IconButton, Menu, MenuItem, Notice, Spinner, Tooltip } from "@logue/ui";
import { api, ApiError, type Document as DocumentRecord, type Material } from "../api";
import { DRAFT } from "./AppShell";
import { ConfirmDelete } from "./ConfirmDelete";
import { useHoldsUnsaved } from "./freshness";
import { DOCUMENT, History } from "./History";
import { MarkdownEditor, type MarkdownHandle } from "./MarkdownEditor";
import {
  DetailBody,
  DetailHeader,
  DetailPane,
  IconBadge,
  ListPane,
  ListSearch,
  QuietRow,
  RowName,
  RowShell,
  Section,
} from "./panes";
import { PendingChange } from "./PendingChange";
import { RewriteDialog } from "./RewriteDialog";
import { useAction, useHost } from "./useHost";

const AUTOSAVE_MS = 900;
/** How far the name follows the first line. The Host cuts it the same way. */
const TITLE_LIMIT = 50;

/**
 * What a document is called: its first line, with the Markdown taken off.
 *
 * The Host computes the same thing and stores it, so lists and links agree
 * with the editor. This copy exists only so the header can say the new name
 * while the words are still being typed, before the save.
 */
export function firstLine(text: string, limit = TITLE_LIMIT): string {
  for (const line of (text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const bare = line
      .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__|\*|_|`)/g, "")
      .trim();
    if (bare) return bare.slice(0, limit);
  }
  return "";
}

/**
 * The same words, with the first line saying something else.
 *
 * A document has no name of its own — the first line is the name — so renaming
 * one from the list means writing that line. The line's own markup is kept: a
 * page whose first line is `# Notes` renamed to `Plans` is `# Plans`, not a
 * heading that quietly stopped being one.
 */
export function renamed(text: string, name: string): string {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const at = lines.findIndex((line) => line.trim());
  if (at < 0) return name;
  const prefix = /^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)?/.exec(lines[at] ?? "")?.[0] ?? "";
  lines[at] = `${prefix}${name}`;
  return lines.join("\n");
}

/** Where a dragged page would land, relative to the row it is over. */
type Zone = "above" | "into" | "below";

/** How long a folded row waits under the pointer before it opens. */
const HOVER_OPEN_MS = 700;

/**
 * Where in a row the pointer is, in the three parts a drop can mean.
 *
 * A quarter at each end puts the page beside this one; the half in the middle
 * puts it inside.
 */
function zoneOf(event: React.DragEvent<HTMLElement>): Zone {
  const box = event.currentTarget.getBoundingClientRect();
  const part = (event.clientY - box.top) / box.height;
  return part < 0.25 ? "above" : part > 0.75 ? "below" : "into";
}

/**
 * Documents, as three panes: everything written on the left, the page being
 * written on the right — with the Sources it cites down its own rail.
 */
export function DocumentsRoute({
  openId,
  onOpen,
  onCreated,
  onOpenSource,
  made = 0,
  onVisibleOrder,
}: {
  openId: string | undefined;
  onOpen: (id: string | undefined) => void;
  /** A draft became real. */
  onCreated: (id: string) => void;
  /** Go to this Source where it lives — in the Stream. */
  onOpenSource: (id: string) => void;
  made?: number;
  /** The rows on screen, for ⌥⌘↑/↓ to step through. */
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const documents = useHost(() => api.documentTree(), [made, openId]);
  const [query, setQuery] = useState("");
  /** Which pages are folded shut, by id. Everything starts open. */
  const [shut, setShut] = useState<Set<string>>(new Set());
  const action = useAction();

  /**
   * The page being dragged, and the row the pointer is over.
   *
   * Held in a ref as well as in state: `dragover` can fire in the same tick as
   * `dragstart`, and a handler reading the state would still be reading the
   * render before the drag began — no drop target, and the drag does nothing.
   */
  const [dragging, setDragging] = useState<string>();
  const dragged = useRef<string>(undefined);
  const [over, setOver] = useState<{ id: string; zone: Zone }>();
  /** The row being renamed in place, and the name so far. */
  const [renaming, setRenaming] = useState<string>();
  const [dropping, setDropping] = useState<DocumentRecord>();
  /** Bumped when a page is renamed from the list, to reload it if it is open. */
  const [rewritten, setRewritten] = useState(0);
  const opening = useRef<{ id: string; timer: number }>(undefined);

  const all = useMemo(() => documents.data?.documents ?? [], [documents.data]);

  /** What a page is called right now — stable per list, so the editor can
      redraw its subpage blocks exactly when the workspace moved. */
  const titleOf = useCallback((target: string) => all.find((one) => one.id === target)?.title, [all]);

  /** A page cannot be dropped inside itself — the one move that breaks a tree. */
  const subtreeOf = useCallback(
    (id: string) => {
      const children = new Map<string, string[]>();
      for (const one of all) {
        const parent = one.parent_id ?? "";
        children.set(parent, [...(children.get(parent) ?? []), one.id]);
      }
      const found = new Set<string>([id]);
      const walk = (from: string) => {
        for (const child of children.get(from) ?? []) {
          found.add(child);
          walk(child);
        }
      };
      walk(id);
      return found;
    },
    [all],
  );

  /** Put the dragged page where the pointer says, and tell the Host once. */
  const drop = (row: DocumentRecord, zone: Zone) => {
    const moving = dragged.current;
    dragged.current = undefined;
    setDragging(undefined);
    setOver(undefined);
    if (!moving || moving === row.id || subtreeOf(moving).has(row.id)) return;
    const siblings = all.filter((one) => (one.parent_id ?? "") === (row.parent_id ?? ""));
    const at = siblings.findIndex((one) => one.id === row.id);
    const where =
      zone === "into"
        ? { parent_id: row.id, before: null }
        : {
            parent_id: row.parent_id ?? null,
            // Above this row, or above the one after it — which is the end of
            // the list when there is nothing after it.
            before: zone === "above" ? row.id : (siblings[at + 1]?.id ?? null),
          };
    if (zone === "into") setShut((was) => new Set([...was].filter((one) => one !== row.id)));
    void action.run(async () => {
      await api.moveDocument(moving, where);
      await documents.refresh();
    });
  };

  /** Hovering over a folded page opens it, so its inside can be dropped into. */
  const linger = (row: DocumentRecord, children: number) => {
    if (opening.current?.id === row.id) return;
    window.clearTimeout(opening.current?.timer);
    if (children === 0 || !shut.has(row.id)) {
      opening.current = undefined;
      return;
    }
    opening.current = {
      id: row.id,
      timer: window.setTimeout(() => {
        setShut((was) => new Set([...was].filter((one) => one !== row.id)));
      }, HOVER_OPEN_MS),
    };
  };

  /** Write a new first line, which is what a name is. */
  const rename = (id: string, name: string) => {
    setRenaming(undefined);
    const wanted = name.trim();
    if (!wanted) return;
    void action.run(async () => {
      const { document } = await api.document(id);
      const next = renamed(document.content, wanted);
      if (next === document.content) return;
      await api.updateDocument(id, { content: next, expected_revision: document.revision });
      await documents.refresh();
      // The editor holds its own copy of the words; if this page is the one
      // open in it, it has to read them again or its next autosave would put
      // the old first line back.
      if (id === openId) setRewritten((was) => was + 1);
    });
  };
  /**
   * The list as a tree: each row knows how deep it sits and whether anything
   * is under it. Searching flattens it — a result you cannot see because its
   * parent is folded is a result that did not answer.
   */
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return all
        .filter((one) => (one.title || "Untitled").toLowerCase().includes(needle))
        .toSorted((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
        .map((one) => ({ one, depth: 0, children: 0 }));
    }
    const under = new Map<string, DocumentRecord[]>();
    for (const one of all) {
      const parent = one.parent_id ?? "";
      under.set(parent, [...(under.get(parent) ?? []), one]);
    }
    const rows: { one: DocumentRecord; depth: number; children: number }[] = [];
    const walk = (parent: string, depth: number) => {
      for (const one of under.get(parent) ?? []) {
        const children = (under.get(one.id) ?? []).length;
        rows.push({ one, depth, children });
        if (!shut.has(one.id)) walk(one.id, depth + 1);
      }
    };
    walk("", 0);
    return rows;
  }, [all, query, shut]);

  useEffect(() => {
    onVisibleOrder?.(shown.map((row) => row.one.id));
  }, [shown, onVisibleOrder]);

  const selectedId = openId && openId !== DRAFT ? openId : openId === DRAFT ? undefined : shown[0]?.one.id;

  /**
   * The pages this one sits inside, outermost first.
   *
   * Documents nest now, and a page opened from a search or a link arrives with
   * nothing saying where it is. The trail is that, and each step opens.
   */
  const trail = useMemo(() => {
    const byId = new Map(all.map((one) => [one.id, one]));
    const steps: DocumentRecord[] = [];
    let at = byId.get(selectedId ?? "")?.parent_id ?? undefined;
    while (at && byId.has(at) && steps.length < 8) {
      const parent = byId.get(at)!;
      steps.unshift(parent);
      at = parent.parent_id ?? undefined;
    }
    return steps;
  }, [all, selectedId]);

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        title="Documents"
        onNew={() => onOpen(DRAFT)}
        newLabel="New Document"
        count={all.length}
        controls={<ListSearch value={query} onChange={setQuery} />}
      >
        {documents.error && (
          <div className="p-4">
            <ErrorNote>{documents.error}</ErrorNote>
          </div>
        )}
        {documents.loading && all.length === 0 && (
          <div className="flex items-center gap-2 p-4 text-xs text-muted">
            <Spinner /> Loading
          </div>
        )}
        {shown.map(({ one, depth, children }) =>
          renaming === one.id ? (
            <RenameRow
              key={one.id}
              name={one.title || "Untitled"}
              depth={depth}
              onDone={(name) => rename(one.id, name)}
              onCancel={() => setRenaming(undefined)}
            />
          ) : (
          <div
            key={one.id}
            // Which page this row is, so a check can drop one onto another.
            data-doc={one.id}
            // The page being carried is faded where it came from, so a drag
            // over a long list still says what is being moved.
            className={cn("relative", dragging === one.id && "opacity-40")}
            // The whole row is the handle: a page is a thing on a list, and a
            // list you can only reorder by finding a grip is a list nobody
            // reorders. Searching flattens the tree, and a flattened tree has
            // no order to change — so dragging is off while a query is on.
            draggable={!query}
            onDragStart={(event) => {
              dragged.current = one.id;
              setDragging(one.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", one.id);
            }}
            onDragEnd={() => {
              dragged.current = undefined;
              setDragging(undefined);
              setOver(undefined);
              window.clearTimeout(opening.current?.timer);
              opening.current = undefined;
            }}
            onDragOver={(event) => {
              const moving = dragged.current;
              if (!moving || subtreeOf(moving).has(one.id)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const zone = zoneOf(event);
              setOver({ id: one.id, zone });
              if (zone === "into") linger(one, children);
            }}
            onDragLeave={() => {
              window.clearTimeout(opening.current?.timer);
              opening.current = undefined;
            }}
            onDrop={(event) => {
              event.preventDefault();
              // Read off the event, not off `over`: a drop can arrive in the
              // same tick as the dragover that set it, and the state would
              // still be a render behind — every drop landed "into".
              drop(one, zoneOf(event));
            }}
            onDoubleClick={() => setRenaming(one.id)}
          >
            {/* Where it would land, drawn where it would land. */}
            {over?.id === one.id && over.zone !== "into" && (
              <span
                aria-hidden
                className={`absolute inset-x-0 z-10 h-[2px] bg-accent ${over.zone === "above" ? "top-0" : "bottom-0"}`}
                style={{ marginLeft: 16 + depth * 16 }}
              />
            )}
            {over?.id === one.id && over.zone === "into" && (
              <span aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-sm ring-2 ring-accent ring-inset" />
            )}
            <RowShell
              badge={<IconBadge name="document" tinted={one.id === selectedId} />}
              selected={one.id === selectedId}
              onSelect={() => onOpen(one.id)}
              indent={depth}
              /* One page, one line — his instruction of 2026-08-19, with
                 Notion's sidebar beside it. The second line said "written by
                 hand" under almost every row and cost half the height of the
                 list to say nothing: what a page is made of belongs in the
                 page, and the time it changed is in its footer. Twice as many
                 pages now fit on a screen, which is what a list is for. */
              dense
            >
              <RowName>{one.title || "Untitled"}</RowName>
            </RowShell>
            {/* The fold, on the left where the tree is, and never moving the
                title: the space it needs is always there, and only the arrow
                comes and goes. A control that appears and shoves the words
                sideways is read as the list twitching. */}
            <span
              className="pointer-events-none absolute inset-y-0 flex items-center"
              style={{ left: 16 + depth * 16 - 15 }}
            >
              {children > 0 && (
                <button
                  type="button"
                  aria-label={shut.has(one.id) ? "Show what is inside" : "Fold this away"}
                  title={shut.has(one.id) ? "Show what is inside" : "Fold this away"}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShut((was) => {
                      const next = new Set(was);
                      if (next.has(one.id)) next.delete(one.id);
                      else next.add(one.id);
                      return next;
                    });
                  }}
                  className="pointer-events-auto flex size-[15px] items-center justify-center rounded-[4px] text-muted opacity-0 hover:bg-hover hover:text-ink focus-visible:opacity-100 [div:hover>&]:opacity-100"
                >
                  <ChevronRight size={12} className={shut.has(one.id) ? undefined : "rotate-90"} />
                </button>
              )}
            </span>
            {/* An agent change waits on this page — said here too, so it can
                be seen without opening every page. It steps aside when the
                pointer brings the row's own actions in. Interim spot, his
                word, while the rows are being redesigned. */}
            {one.pending_agent && (
              <Tooltip label="An agent change is waiting">
                <span className="absolute inset-y-0 right-3 flex items-center [div:hover>&]:pointer-events-none [div:hover>&]:opacity-0">
                  <span className="rounded-full border border-accent-line bg-accent-soft px-1.5 text-[10px] font-[650] text-accent-ink">
                    review
                  </span>
                </span>
              </Tooltip>
            )}
            <span className="absolute inset-y-0 right-3 flex items-center gap-0.5 opacity-0 focus-within:opacity-100 hover:opacity-100 [div:hover>&]:opacity-100">
              <Tooltip label="New page inside this one">
                <IconButton
                  label="New page inside this one"
                  onClick={() =>
                    void action.run(async () => {
                      const { document } = await api.createDocument({ parent_id: one.id, content: "" });
                      setShut((was) => {
                        const next = new Set(was);
                        next.delete(one.id);
                        return next;
                      });
                      onCreated(document.id);
                    })
                  }
                >
                  <Plus size={13} />
                </IconButton>
              </Tooltip>
              <Menu
                label="More"
                align="end"
                trigger={(props) => (
                  <IconButton label="More" {...props}>
                    <MoreHorizontal size={13} />
                  </IconButton>
                )}
              >
                <MenuItem onClick={() => setRenaming(one.id)}>
                  <Pencil size={12} /> Rename
                </MenuItem>
                <MenuItem onClick={() => setDropping(one)}>
                  <Trash2 size={12} /> Delete…
                </MenuItem>
              </Menu>
            </span>
          </div>
          ),
        )}
      </ListPane>

      {dropping && (
        <ConfirmDelete
          open
          title="Delete this page"
          what={dropping.title || "Untitled"}
          impact={() => {
            const under = all.filter((one) => one.parent_id === dropping.id).length;
            return Promise.resolve(
              under > 0
                ? [`${under} ${under === 1 ? "page" : "pages"} inside it move up to where it was`]
                : [],
            );
          }}
          kept="Every Source it cited stays in the workspace."
          busy={action.busy}
          error={action.error}
          onCancel={() => setDropping(undefined)}
          onConfirm={() =>
            void action.run(async () => {
              await api.deleteDocument(dropping.id);
              setDropping(undefined);
              if (dropping.id === openId) onOpen(undefined);
              await documents.refresh();
            })
          }
        />
      )}

      {selectedId || openId === DRAFT ? (
        <DocumentEditor
          // Remounts when the draft becomes real, which is what makes the editor
          // pick up the id without having to thread it back through itself.
          key={`${openId ?? selectedId}:${rewritten}`}
          id={openId ?? selectedId!}
          onCreated={onCreated}
          onOpenSource={onOpenSource}
          trail={trail}
          onOpen={onOpen}
          titleOf={titleOf}
        />
      ) : (
        <DetailPane>
          <DetailHeader name={<span className="font-[500] text-muted">Documents</span>} />
          <DetailBody>
            {!documents.loading && <Empty>Nothing written yet — press + to start a page.</Empty>}
          </DetailBody>
        </DetailPane>
      )}
    </div>
  );
}

/** A page at the top of the tree sits inside nothing. One array, not one a render. */
const NO_TRAIL: { id: string; title: string }[] = [];

/** A document that does not exist yet, so the editor has something to show. */
const BLANK: { document: DocumentRecord; sources: Material[] } = {
  document: {
    id: "",
    title: "",
    content: "",
    source_ids: [],
    revision: 0,
    created_at: "",
    updated_at: "",
  },
  sources: [],
};

function DocumentEditor({
  id,
  onCreated,
  onOpenSource,
  trail = NO_TRAIL,
  onOpen,
  titleOf,
}: {
  id: string;
  onCreated: (id: string) => void;
  onOpenSource: (id: string) => void;
  /** The pages this one sits inside, outermost first. */
  trail?: { id: string; title: string }[];
  onOpen?: (id: string) => void;
  /** What a page is called right now, for the subpage blocks in the text. */
  titleOf?: (id: string) => string | undefined;
}) {
  // Nothing is in the workspace yet. It goes in at the first keystroke, so
  // pressing `+` and walking away leaves no trace.
  const draft = id === DRAFT;
  const loaded = useHost(() => (draft ? Promise.resolve(BLANK) : api.document(id)), [id]);
  /**
   * The text, held here rather than only in the editor.
   *
   * A document has no name of its own any more — the first line is the name —
   * so the header has to read the words as they are typed, not as they were
   * last saved.
   */
  const [text, setText] = useState("");
  /** What this editor last saw. Sent with every save so a second writer is caught. */
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [looking, setLooking] = useState(false);
  /** What the last save answered, so the control can say so until the next keystroke. */
  const [kept, setKept] = useState<string>();
  /** Saving a version is its own act; it must not blank the editor's spinner. */
  const editing = useAction();
  /** The selected passage, frozen when Rewrite was pressed. */
  const [rewriting, setRewriting] = useState<string>();
  const editor = useRef<MarkdownHandle>(null);
  /** Read inside the autosave, which fires after the render that queued it. */
  const written = useRef("");
  written.current = text;
  const timer = useRef<number>(undefined);
  const action = useAction();
  const doc = loaded.data?.document;
  const sources = loaded.data?.sources ?? [];
  // Headings, in the order they are written. The first line is the document's
  // name, so it is not one of them — it is already the title on screen.
  const outline = useMemo(() => {
    const found: { at: number; depth: number; text: string }[] = [];
    let at = 0;
    const lines = text.split("\n");
    for (const [index, line] of lines.entries()) {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading && index > 0 && heading[2]?.trim()) {
        found.push({ at, depth: heading[1]?.length ?? 1, text: heading[2].trim() });
      }
      at += line.length + 1;
    }
    return found;
  }, [text]);
  const title = firstLine(text) || (draft ? "" : doc?.title || "Untitled");

  useEffect(() => {
    if (!doc) return;
    setText(doc.content);
    setRevision(doc.revision);
    setConflict(false);
    // A different text is under the editor now — a restore, an applied agent
    // change, another page — so the save control stops answering for the old
    // one. Only for a *different* text: the save's own write moves the
    // workspace counter, and the refresh that follows must not eat the
    // "Saved as a version" it is the receipt for.
    if (doc.content !== written.current) setKept(undefined);
  }, [doc]);

  const write = async (changes: { content?: string }, force = false): Promise<boolean> => {
    try {
      // The first save is what brings it into being.
      if (draft) {
        const { document: born } = await api.createDocument({
          content: changes.content ?? written.current,
        });
        onCreated(born.id);
        return true;
      }
      const { document } = await api.updateDocument(id, {
        ...changes,
        ...(force ? {} : { expected_revision: revision }),
      });
      setRevision(document.revision);
      setConflict(false);
      return true;
    } catch (cause) {
      // Someone else wrote while this editor had the document open. Stop
      // autosaving rather than overwrite them, and keep what is on screen —
      // it is the only copy of these edits.
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        return false;
      }
      throw cause;
    }
  };

  /**
   * Words typed but not yet written to the Host.
   *
   * Held so nothing reloads the page over them — see freshness.ts. Between a
   * keystroke and the autosave there is a second or two where the only copy
   * of a sentence is in this tab.
   */
  const [waitingToSave, setWaitingToSave] = useState(false);
  // Conflict is a dirty state too: the tab holds the only copy of the words
  // the 409 refused, and a quiet refresh would put the other writer's text
  // over them. Held until the person chooses Keep or Discard.
  useHoldsUnsaved(waitingToSave || action.busy || conflict);

  /** Autosave on a pause, not on every keystroke — history should read as edits. */
  const queueSave = (changes: { content?: string }) => {
    window.clearTimeout(timer.current);
    setWaitingToSave(true);
    timer.current = window.setTimeout(() => {
      void action.run(() => write(changes)).finally(() => setWaitingToSave(false));
    }, AUTOSAVE_MS);
  };

  const mine = () => ({ content: written.current });

  /** Every keystroke: the name follows the first line, so the header follows too. */
  const onTyped = (next: string) => {
    setText(next);
    // Written now, not at the render: a flush that follows this keystroke in
    // the same tick — opening a just-made subpage — must not read the text
    // from one edit ago.
    written.current = next;
    // The words moved past the last saved version, so the control offers again.
    setKept(undefined);
    queueSave({ content: next });
  };

  /**
   * The working copy as a version, because the person said so.
   *
   * The words on screen are flushed first — the version is of what the Host
   * holds — and a save that changed nothing is answered honestly rather than
   * minting a twin.
   */
  const saveVersion = () => {
    if (draft) return;
    // This flush replaces the queued autosave; the flag has to fall with the
    // timer, or "Autosaving…" stands forever and holds the whole tab's
    // refreshes with it.
    window.clearTimeout(timer.current);
    setWaitingToSave(false);
    void editing.run(async () => {
      if (!(await write(mine()))) return;
      const answer = await api.saveVersion(id);
      setKept(answer.saved ? "Saved as a version" : "No changes to save");
    });
  };

  // A link to something that has been deleted is a normal thing to click.
  // Say so plainly rather than drawing an editor around nothing.
  if (loaded.error && !doc) {
    return (
      <DetailPane>
        <DetailHeader name={<span className="font-[500] text-muted">Documents</span>} />
        <DetailBody>
          <p className="text-[12.5px] text-muted">{loaded.error}</p>
        </DetailBody>
      </DetailPane>
    );
  }

  return (
    <DetailPane>
      <DetailHeader
        badge={<IconBadge name="document" tinted />}
        name={
          <span className="flex min-w-0 items-center">
            {/* Where this page sits, when it sits inside another. */}
            {trail.map((step) => (
              <span key={step.id} className="flex min-w-0 items-center">
                <button
                  type="button"
                  onClick={() => onOpen?.(step.id)}
                  className="max-w-[10rem] truncate font-[500] text-muted hover:text-ink"
                >
                  {step.title || "Untitled"}
                </button>
                <ChevronRight size={11} className="mx-1 flex-none text-faint" />
              </span>
            ))}
            <span className="truncate">{draft ? "New Document" : title || "Untitled"}</span>
          </span>
        }
        // What it is made of. Whether it is saved is the footer's line, and
        // saying it twice on one screen — once lower case, once capitalised —
        // was the screen disagreeing with itself.
        sub={draft ? undefined : sources.length > 0 ? `${sources.length} sources` : undefined}
        actions={
          draft ? undefined : (
            <>
              {/* Rewrite is on the passage now — see the toolbar in
                  MarkdownEditor. A button in the header that is disabled
                  whenever nothing is selected is an action parked where the
                  thing it acts on never is. History and the save live here
                  the way Notion's clock does — the strip under the page is
                  gone, his word. */}
              <Tooltip label="Every version of this document">
                <Button onClick={() => setLooking(true)}>
                  <HistoryIcon size={13} /> History
                </Button>
              </Tooltip>
              <Tooltip label="Save the working copy as a version" keys="⌘S">
                <Button onClick={saveVersion}>
                  {editing.busy ? <Spinner size={13} /> : <Save size={13} />} {kept ?? "Save version"}
                </Button>
              </Tooltip>
              <Tooltip label="Download as Markdown">
                <Button onClick={() => window.open(api.documentMarkdownUrl(id), "_blank")}>
                  <Download size={13} /> Export
                </Button>
              </Tooltip>
            </>
          )
        }
      />
      <DetailBody>
        {loaded.error && <ErrorNote>{loaded.error}</ErrorNote>}
        {conflict && (
          <Notice
            tone="quiet"
            className="mb-3"
            action={
              <>
                <Button
                  onClick={() => {
                    window.clearTimeout(timer.current);
                    setWaitingToSave(false);
                    void action.run(() => write(mine(), true));
                  }}
                >
                  Keep mine
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.clearTimeout(timer.current);
                    setWaitingToSave(false);
                    setConflict(false);
                    void loaded.refresh();
                  }}
                >
                  Discard mine
                </Button>
              </>
            }
          >
            This document changed somewhere else. Your edits are still here, unsaved.
          </Notice>
        )}
        {/* ⌘S is a deliberate act; failing silently reads as saved. */}
        {editing.error && <ErrorNote className="mb-3">{editing.error}</ErrorNote>}
        {/* So is choosing Page: a Host that refused the child says why here. */}
        {action.error && <ErrorNote className="mb-3">{action.error}</ErrorNote>}
        {/* An agent finished while the working copy had moved; the person
            rules on the result here rather than being silently overwritten. */}
        {doc?.pending_agent && <PendingChange id={id} onSettled={() => void loaded.refresh()} />}
        {!doc ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner /> Loading
          </div>
        ) : (
          /*
           * Sources sit beside the page, because a citation is part of what
           * the page says. The outline is not: it is a way of moving around,
           * and Notion floats its own over the right margin so the page stays
           * where the eye left it. In a window too narrow to float it, it
           * gives way to the words.
           */
          <div className={sources.length > 0 ? "grid grid-cols-[minmax(0,1fr)_216px] items-start gap-5" : "relative"}>
            {/* Notion opens a page with room above its name. The pane's own
                header is only 48px away otherwise, and the title reads as a
                toolbar label rather than as the page. */}
            <article className="min-w-0 pt-8">
              {/* No title field: the first line is the name. Nothing sits
                  above the text but the text. */}
              <MarkdownEditor
                value={text}
                onChange={onTyped}
                handle={editor}
                // ⌘S in the editor is the same save as the header's control.
                onSave={saveVersion}
                // `/page`: a child of this document, born Untitled; the link
                // lands in the text and the page opens, the way Notion's does.
                onSubpage={
                  draft
                    ? undefined
                    : async () => {
                        // Through the action so a Host that refuses is said
                        // out loud, not swallowed into an empty menu press.
                        let born: DocumentRecord | undefined;
                        const ok = await action.run(async () => {
                          born = (await api.createDocument({ parent_id: id })).document;
                        });
                        return ok && born ? { id: born.id, title: born.title || "Untitled" } : undefined;
                      }
                }
                // Opening leaves this page, so what was just typed is flushed
                // first — the same promise every working-copy replacement keeps.
                onOpenPage={(target) => {
                  window.clearTimeout(timer.current);
                  setWaitingToSave(false);
                  void action.run(async () => {
                    // A refused flush means these words have nowhere else to
                    // live yet; the conflict notice takes it from here.
                    if (!(await write(mine()))) return;
                    onOpen?.(target);
                  });
                }}
                autoFocus={!draft && doc?.content === ""}
                pageTitle={titleOf}
                // Frozen at the press: opening a dialog steals focus, and a
                // selection read afterwards is empty.
                onRewrite={(passage) => setRewriting(passage)}
                // A citation is a claim you can follow. `[Source 3]` printed
                // as three words was one you could only read.
                onCite={(n) => {
                  const source = sources[n - 1];
                  if (source) onOpenSource(source.id);
                }}
                label="Document"
              />

            </article>

            {(sources.length > 0 || outline.length > 1) && (
              <aside className="min-w-0 grid gap-4">
                {/* The shape of a long document, from its own headings. Only
                    once there is a shape to show: two headings is a document
                    with a heading, not one that needs a map. */}
                {outline.length > 1 && (
                  <Section cap="Outline" count={outline.length} first>
                    <nav className="mt-2 grid gap-0.5">
                      {outline.map((heading) => (
                        <button
                          key={heading.at}
                          type="button"
                          onClick={() => editor.current?.goto(heading.at)}
                          style={{ paddingLeft: `${(heading.depth - 1) * 10}px` }}
                          className="truncate rounded-md py-1 pr-1.5 text-left text-xs text-muted hover:bg-hover hover:text-ink"
                          title={heading.text}
                        >
                          {heading.text}
                        </button>
                      ))}
                    </nav>
                  </Section>
                )}
                {sources.length > 0 && (
                <Section cap="Sources" count={sources.length} first={outline.length <= 1}>
                  <div className="mt-2 grid gap-0.5">
                    {sources.map((source, index) => (
                      <QuietRow
                        key={source.id}
                        onClick={() => onOpenSource(source.id)}
                        icon={
                          <span className="mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] bg-accent-soft text-[10px] font-[650] text-accent-ink">
                            {index + 1}
                          </span>
                        }
                      >
                        {source.content}
                      </QuietRow>
                    ))}
                  </div>
                </Section>
                )}
              </aside>
            )}
          </div>
        )}

        {!draft && rewriting !== undefined && (
          <RewriteDialog
            documentId={id}
            selection={rewriting}
            open
            onClose={() => setRewriting(undefined)}
            onApply={(rewritten) => {
              // The selection is long gone — the dialog had focus. Replace
              // the frozen passage by matching its text, which is the passage
              // the person chose.
              editor.current?.replace(rewriting, rewritten);
            }}
          />
        )}

        {!draft && (
          <History
            kind={DOCUMENT}
            id={id}
            open={looking}
            onClose={() => setLooking(false)}
            onRestored={() => void loaded.refresh()}
          />
        )}
      </DetailBody>
    </DetailPane>
  );
}

/**
 * A page's name, being typed.
 *
 * It replaces the row rather than sitting on top of it: an input inside the
 * row's own button is not a thing a browser will render, and a name being
 * changed is not a row you can also click.
 */
function RenameRow({
  name,
  depth,
  onDone,
  onCancel,
}: {
  name: string;
  depth: number;
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <div
      className="grid w-full grid-cols-[24px_minmax(0,1fr)] gap-x-[9px] border-b border-line py-[7px] pr-4 pl-4"
      style={depth ? { paddingLeft: 16 + depth * 16 } : undefined}
    >
      <IconBadge name="document" tinted />
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Name"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onDone(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onDone(draft);
          if (event.key === "Escape") onCancel();
        }}
        onFocus={(event) => event.target.select()}
        className="h-5 w-full rounded-sm border border-accent-line bg-surface px-1 text-[12px] font-[600] text-ink outline-0"
      />
    </div>
  );
}

/**
 * How much has been written, in the unit people count in.
 *
 * Words, not characters: nobody writing a page thinks in characters. Markup
 * is not counted — `##` is not a word — and CJK is counted by character,
 * because a Chinese sentence has no spaces to count between.
 */
export function words(text: string): string {
  const bare = (text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~[\]()|-]/g, " ");
  const cjk = bare.match(/[\u3400-\u9fff\u3040-\u30ff]/g)?.length ?? 0;
  const latin = bare.replace(/[\u3400-\u9fff\u3040-\u30ff]/g, " ").match(/\S+/g)?.length ?? 0;
  const total = cjk + latin;
  return `${total} ${total === 1 ? "word" : "words"}`;
}
