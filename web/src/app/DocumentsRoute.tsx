import { Download, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ErrorNote, Spinner, Tooltip } from "@logue/ui";
import { api, ApiError, type Document as DocumentRecord, type Material } from "../api";
import { DRAFT } from "./AppShell";
import { useHoldsUnsaved } from "./freshness";
import { DOCUMENT, History } from "./History";
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
/** How far a title taken from the body follows it. */
const TITLE_LIMIT = 50;

/** The first line of the body, which is what a document is usually called. */
function firstLine(html: string, limit = TITLE_LIMIT): string {
  const text = (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) : text;
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
  const documents = useHost(() => api.documents(), [made, openId]);
  const [query, setQuery] = useState("");

  const all = useMemo(() => documents.data?.documents ?? [], [documents.data]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = all.toSorted((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    if (!needle) return sorted;
    return sorted.filter((one) => (one.title || "Untitled").toLowerCase().includes(needle));
  }, [all, query]);

  useEffect(() => {
    onVisibleOrder?.(shown.map((one) => one.id));
  }, [shown, onVisibleOrder]);

  const selectedId = openId && openId !== DRAFT ? openId : openId === DRAFT ? undefined : shown[0]?.id;

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        title="Documents"
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
        {shown.map((one) => (
          <RowShell
            key={one.id}
            badge={<IconBadge name="document" tinted={one.id === selectedId} />}
            selected={one.id === selectedId}
            onSelect={() => onOpen(one.id)}
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
            </RowMeta>
          </RowShell>
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
            {!documents.loading && (
              <p className="text-[12.5px] text-muted">Nothing written yet — press + to start a page.</p>
            )}
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
    title_state: "auto",
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
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<string>("");
  /** What this editor last saw. Sent with every save so a second writer is caught. */
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [looking, setLooking] = useState(false);
  /** The selected passage, frozen when Rewrite was pressed. */
  const [rewriting, setRewriting] = useState<string>();
  /** Whether there is a passage to rewrite right now, so the button can say so. */
  const [selected, setSelected] = useState(false);
  /**
   * Who named this: the first line, a model, or the person.
   *
   * One value, so two can never be true at once — and the whole point is the
   * last one. Once someone has typed a name, the body does not overwrite it
   * and neither does a model.
   */
  const [named, setNamed] = useState<"auto" | "generated" | "edited">("auto");
  // Read inside a promise that outlives the render it started in.
  const namedRef = useRef(named);
  namedRef.current = named;
  const body = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const action = useAction();
  const doc = loaded.data?.document;
  const sources = loaded.data?.sources ?? [];

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setNamed(doc.title_state ?? (doc.title.trim() && doc.title !== "Untitled" ? "edited" : "auto"));
    setRevision(doc.revision);
    setConflict(false);
    if (body.current) body.current.innerHTML = doc.content;
  }, [doc]);

  // Whether Rewrite has anything to work on. Watched rather than read on the
  // press, because the button has to *say* it is unavailable before it is
  // pressed — the press itself is too late to explain anything.
  useEffect(() => {
    const read = () => {
      const chosen = window.getSelection();
      const text = chosen?.toString().trim() ?? "";
      setSelected(Boolean(text) && Boolean(chosen?.anchorNode) && Boolean(body.current?.contains(chosen!.anchorNode)));
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, []);

  const write = async (
    changes: { title?: string; content?: string; title_state?: "auto" | "generated" | "edited" },
    force = false,
  ) => {
    try {
      // The first save is what brings it into being.
      if (draft) {
        const { document: born } = await api.createDocument({
          title: changes.title ?? title,
          content: changes.content ?? body.current?.innerHTML ?? "",
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
  const queueSave = (changes: {
    title?: string;
    content?: string;
    title_state?: "auto" | "generated" | "edited";
  }) => {
    window.clearTimeout(timer.current);
    setWaitingToSave(true);
    timer.current = window.setTimeout(() => {
      void action.run(() => write(changes)).finally(() => setWaitingToSave(false));
    }, AUTOSAVE_MS);
  };

  const mine = () => ({ title, content: body.current?.innerHTML ?? "" });

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

  /**
   * Every document starts "Untitled" and, left alone, stays that way — which
   * makes a list of them useless. So the title follows the first line while
   * nobody has claimed it.
   */
  const onBodyInput = () => {
    const content = body.current?.innerHTML ?? "";
    if (named !== "auto") {
      queueSave({ content });
      return;
    }
    const following = firstLine(content);
    setTitle(following);
    queueSave({ content, title: following, title_state: "auto" });
  };

  /**
   * Once, when the body is finished with: ask a model for a real title.
   *
   * Only while the name is still the first line's. A person who has typed one
   * never sees it change, and a model that has already had its turn does not
   * get a second — which is the whole reason the three states exist.
   */
  const nameIt = () => {
    if (draft || named !== "auto" || !firstLine(body.current?.innerHTML ?? "")) return;
    void action.run(async () => {
      const { document } = await api.nameDocument(id);
      // Someone may have started typing a name during the round trip. Theirs
      // wins; the model's answer is dropped without a word.
      setTitle((was) => (namedRef.current === "auto" ? document.title : was));
      if (namedRef.current === "auto") setNamed("generated");
      setRevision(document.revision);
    });
  };

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
                    const chosen = window.getSelection()?.toString() ?? "";
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
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-2 text-xs text-ink"
          >
            <span>This document changed somewhere else. Your edits are still here, unsaved.</span>
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
          </div>
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
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  // Typing here is the claim. Nothing renames it after this.
                  setNamed("edited");
                  queueSave({ title: event.target.value, title_state: "edited" });
                }}
                placeholder="Untitled"
                aria-label="Document title"
                className="mb-3 w-full border-0 bg-transparent text-[22px] leading-tight font-[700] tracking-[-0.02em] text-ink outline-0 placeholder:text-line-strong"
              />
              <div
                ref={body}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Document body"
                onInput={onBodyInput}
                onBlur={nameIt}
                className="logue-prose min-h-72 max-w-[44rem] outline-0"
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
            onApply={(text) => {
              // The selection is long gone — the dialog had focus. Replace
              // the frozen passage in the body by matching its text, which
              // is the passage the person chose.
              const editor = body.current;
              if (!editor) return;
              const plain = editor.innerText;
              const at = plain.indexOf(rewriting);
              if (at >= 0) {
                editor.innerText = plain.slice(0, at) + text + plain.slice(at + rewriting.length);
              } else {
                editor.innerText = plain + "\n" + text;
              }
              onBodyInput();
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
