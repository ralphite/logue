import { ChevronRight, Download, Plus, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, ErrorNote, IconButton, Notice, Spinner, Tooltip } from "@logue/ui";
import { api, ApiError, type Document as DocumentRecord, type Material } from "../api";
import { DRAFT } from "./AppShell";
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
  RowMeta,
  RowName,
  RowShell,
  Section,
} from "./panes";
import { RewriteDialog } from "./RewriteDialog";
import { timeAgo, useAction, useHost } from "./useHost";

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
      .replace(/(\*\*|__|\*|_|`)/g, "")
      .trim();
    if (bare) return bare.slice(0, limit);
  }
  return "";
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

  const all = useMemo(() => documents.data?.documents ?? [], [documents.data]);
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
        {shown.map(({ one, depth, children }) => (
          <div key={one.id} className="relative">
            <RowShell
              badge={<IconBadge name="document" tinted={one.id === selectedId} />}
              selected={one.id === selectedId}
              onSelect={() => onOpen(one.id)}
              indent={depth}
            >
              <RowName edge={one.updated_at ? timeAgo(one.updated_at) : undefined}>
                {one.title || "Untitled"}
              </RowName>
              <RowMeta>
                <span className="flex-none tabular-nums">
                  {(one.source_ids?.length ?? 0) > 0
                    ? `${one.source_ids.length} ${one.source_ids.length === 1 ? "source" : "sources"}`
                    : "written by hand"}
                </span>
                {children > 0 && (
                  <span className="flex-none tabular-nums">
                    · {children} {children === 1 ? "page" : "pages"}
                  </span>
                )}
              </RowMeta>
            </RowShell>
            {/* The fold, and the way to put a page inside this one. Both sit on
                the row they act on, because that is the only place they mean
                anything. */}
            <span className="absolute inset-y-0 right-3 flex items-center gap-0.5 opacity-0 focus-within:opacity-100 hover:opacity-100 [div:hover>&]:opacity-100">
              {children > 0 && (
                <Tooltip label={shut.has(one.id) ? "Show what is inside" : "Fold this away"}>
                  <IconButton
                    label={shut.has(one.id) ? "Show what is inside" : "Fold this away"}
                    onClick={() =>
                      setShut((was) => {
                        const next = new Set(was);
                        if (next.has(one.id)) next.delete(one.id);
                        else next.add(one.id);
                        return next;
                      })
                    }
                  >
                    <ChevronRight size={13} className={shut.has(one.id) ? undefined : "rotate-90"} />
                  </IconButton>
                </Tooltip>
              )}
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
            </span>
          </div>
        ))}
      </ListPane>

      {selectedId || openId === DRAFT ? (
        <DocumentEditor
          // Remounts when the draft becomes real, which is what makes the editor
          // pick up the id without having to thread it back through itself.
          key={openId ?? selectedId}
          id={openId ?? selectedId!}
          onCreated={onCreated}
          onOpenSource={onOpenSource}
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
}: {
  id: string;
  onCreated: (id: string) => void;
  onOpenSource: (id: string) => void;
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
  const [saved, setSaved] = useState<string>("");
  /** What this editor last saw. Sent with every save so a second writer is caught. */
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [looking, setLooking] = useState(false);
  /** When a version was last marked by hand, so the control can say so. */
  const [kept, setKept] = useState<string>();
  /** Marking a version is its own act; it must not blank the editor's spinner. */
  const editing = useAction();
  /** The selected passage, frozen when Rewrite was pressed. */
  const [rewriting, setRewriting] = useState<string>();
  /** Whether there is a passage to rewrite right now, so the button can say so. */
  const [selected, setSelected] = useState(false);
  const editor = useRef<MarkdownHandle>(null);
  /** Read inside the autosave, which fires after the render that queued it. */
  const written = useRef("");
  written.current = text;
  const timer = useRef<number>(undefined);
  const action = useAction();
  const doc = loaded.data?.document;
  const sources = loaded.data?.sources ?? [];
  const title = firstLine(text) || (draft ? "" : doc?.title || "Untitled");

  useEffect(() => {
    if (!doc) return;
    setText(doc.content);
    setRevision(doc.revision);
    setConflict(false);
  }, [doc]);

  const write = async (changes: { content?: string }, force = false) => {
    try {
      // The first save is what brings it into being.
      if (draft) {
        const { document: born } = await api.createDocument({
          content: changes.content ?? written.current,
        });
        onCreated(born.id);
        return;
      }
      const { document } = await api.updateDocument(id, {
        ...changes,
        ...(force ? {} : { expected_revision: revision }),
      });
      setRevision(document.revision);
      setSaved(new Date().toISOString());
      setConflict(false);
    } catch (cause) {
      // Someone else wrote while this editor had the document open. Stop
      // autosaving rather than overwrite them, and keep what is on screen —
      // it is the only copy of these edits.
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        return;
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
  useHoldsUnsaved(waitingToSave || action.busy);

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
    queueSave({ content: next });
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
        name={draft ? "New Document" : title || "Untitled"}
        // What it is made of. Whether it is saved is the footer's line, and
        // saying it twice on one screen — once lower case, once capitalised —
        // was the screen disagreeing with itself.
        sub={draft ? undefined : sources.length > 0 ? `${sources.length} sources` : undefined}
        actions={
          draft ? undefined : (
            <>
              <Tooltip label={selected ? "Rewrite the passage" : "Select a passage first"}>
                <Button
                  // A button that answers a press by doing nothing is broken,
                  // however good its reason: with no passage selected there is
                  // nothing to rewrite, and it says so instead of going quiet.
                  disabled={!selected}
                  onClick={() => {
                    // Frozen at the press: opening a dialog steals focus, and a
                    // selection read afterwards is empty.
                    const chosen = editor.current?.selection() ?? "";
                    if (chosen.trim()) setRewriting(chosen);
                  }}
                >
                  <Wand2 size={13} /> Rewrite
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
                    void action.run(() => write(mine(), true));
                  }}
                >
                  Keep mine
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.clearTimeout(timer.current);
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
        {!doc ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner /> Loading
          </div>
        ) : (
          <div
            className={
              sources.length > 0 ? "grid grid-cols-[minmax(0,1fr)_216px] items-start gap-5" : undefined
            }
          >
            <article className="min-w-0">
              {/* No title field: the first line is the name. Nothing sits
                  above the text but the text. */}
              <MarkdownEditor
                value={text}
                onChange={onTyped}
                onSelection={setSelected}
                handle={editor}
                // A citation is a claim you can follow. `[Source 3]` printed
                // as three words was one you could only read.
                onCite={(n) => {
                  const source = sources[n - 1];
                  if (source) onOpenSource(source.id);
                }}
                label="Document"
              />

              <footer className="mt-6 flex items-center gap-2 border-t border-line pt-2 text-xs text-muted">
                {draft && <span>Not saved yet</span>}
                {!draft && (
                  <Tooltip label="Every version is kept">
                    <button
                      type="button"
                      onClick={() => setLooking(true)}
                      className="-my-1 inline-flex min-h-6 items-center rounded-md py-1 text-xs text-muted underline decoration-line underline-offset-2 hover:text-ink"
                    >
                      Version {doc.revision}
                    </button>
                  </Tooltip>
                )}
                {saved && <span>Saved {timeAgo(saved)}</span>}
                {/* Typing keeps a working copy; this marks a state to come
                    back to. One per sitting happens on its own — this is for
                    the moments a person wants to name. */}
                {!draft && (
                  <Tooltip label="Mark this state as a version to come back to">
                    <button
                      type="button"
                      onClick={() =>
                        void editing.run(async () => {
                          await api.keepVersion(id);
                          setKept(new Date().toISOString());
                        })
                      }
                      className="-my-1 ml-auto inline-flex min-h-6 items-center gap-1 rounded-md py-1 text-xs text-muted underline decoration-line underline-offset-2 hover:text-ink"
                    >
                      {kept ? "Version kept" : "Keep this version"}
                    </button>
                  </Tooltip>
                )}
                {action.busy && <Spinner size={11} />}
              </footer>
            </article>

            {sources.length > 0 && (
              <aside className="min-w-0">
                <Section cap="Sources" count={sources.length} first>
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
