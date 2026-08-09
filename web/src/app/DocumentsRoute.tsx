import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorNote, OriginMark, SourceLink, Spinner, originOf } from "@logue/ui";
import { api, ApiError, type Document as DocumentRecord, type Material } from "../api";
import { DRAFT, Nothing, Page } from "./AppShell";
import { DOCUMENT, History } from "./History";
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

export function DocumentsRoute({
  openId,
  onOpen,
  onCreated,
  onOpenSource,
}: {
  openId: string | undefined;
  onOpen: (id: string | undefined) => void;
  /** A draft became real. */
  onCreated: (id: string) => void;
  /** Go to this Source where it lives — in the Stream. */
  onOpenSource: (id: string) => void;
}) {
  return openId ? (
    <DocumentEditor
      // Remounts when the draft becomes real, which is what makes the editor
      // pick up the id without having to thread it back through itself.
      key={openId}
      id={openId}
      onBack={() => onOpen(undefined)}
      onCreated={onCreated}
      onOpenSource={onOpenSource}
    />
  ) : (
    <Nothing section="Documents" hint="Pick one from the list, or start a new page." />
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
  onBack,
  onCreated,
  onOpenSource,
}: {
  id: string;
  onBack: () => void;
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

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setNamed(doc.title_state ?? (doc.title.trim() && doc.title !== "Untitled" ? "edited" : "auto"));
    setRevision(doc.revision);
    setConflict(false);
    if (body.current) body.current.innerHTML = doc.content;
  }, [doc]);

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

  /** Autosave on a pause, not on every keystroke — history should read as edits. */
  const queueSave = (changes: {
    title?: string;
    content?: string;
    title_state?: "auto" | "generated" | "edited";
  }) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void action.run(() => write(changes));
    }, AUTOSAVE_MS);
  };

  const mine = () => ({ title, content: body.current?.innerHTML ?? "" });

  // A link to something that has been deleted is a normal thing to click —
  // from a bookmark, from a message, from Back. Say so plainly rather than
  // drawing an editor around nothing, with an Export button for a document
  // that is not there and a spinner that never stops.
  if (loaded.error && !doc) {
    return <Nothing section="Documents" hint={loaded.error} />;
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
    // Nothing to name while it is still a draft; the first keystroke has
    // already created it by then anyway.
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
    <Page
      title="Documents"
      onBack={onBack}
      here={doc?.title ?? ""}
      axis="reading"
      actions={
        draft ? undefined : (
          <Button onClick={() => window.open(api.documentMarkdownUrl(id), "_blank")}>
            <Download size={13} /> Export
          </Button>
        )
      }
    >
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
        <>
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
            className="mb-3 w-full border-0 bg-transparent text-[30px] leading-tight font-[700] tracking-[-0.02em] text-ink outline-0 placeholder:text-line-strong"
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
            className="logue-prose min-h-72 outline-0"
          />

          <footer className="mt-6 flex items-center gap-2 border-t border-line pt-2 text-[11px] text-faint">
            {draft && <span>Not saved yet — it will be, as soon as you write something.</span>}
            {/* The revision number was already printed here and meant nothing
                to anyone. Making it the way in costs the rail no new control. */}
            {!draft && (
              <button
                type="button"
                onClick={() => setLooking(true)}
                className="rounded-md py-0.5 text-[11px] text-faint underline decoration-line underline-offset-2 hover:text-ink"
              >
                Version {doc.revision}
              </button>
            )}
            {saved && <span>Saved {timeAgo(saved)}</span>}
            {action.busy && <Spinner size={11} />}
          </footer>

          {!draft && (
            <History
              kind={DOCUMENT}
              id={id}
              open={looking}
              onClose={() => setLooking(false)}
              onRestored={() => void loaded.refresh()}
            />
          )}

          <Sources sources={loaded.data?.sources ?? []} onOpen={onOpenSource} />
        </>
      )}
    </Page>
  );
}

/** The Sources a document cites, so a reader can check any claim. */
function Sources({ sources, onOpen }: { sources: Material[]; onOpen: (id: string) => void }) {
  if (sources.length === 0) return null;
  return (
    <section className="mt-6 grid gap-1.5">
      <h2 className="text-xs text-muted">{sources.length} Sources</h2>
      {sources.map((source, index) => (
        // Clickable for the same reason as everywhere else: this Source has a
        // home in the Stream, and a citation you cannot follow is a dead end.
        <div
          key={source.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(source.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(source.id);
            }
          }}
          className="flex cursor-pointer gap-2 rounded-md bg-surface-muted px-2 py-1.5 hover:bg-hover"
        >
          <span className="shrink-0 text-[11px] font-[650] text-accent">{index + 1}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[11px] text-muted">
              <OriginMark origin={originOf(source.kind)} />
              <SourceLink url={source.source?.url} label={source.source?.domain || "This Mac"} />
            </span>
            <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{source.content}</p>
          </span>
        </div>
      ))}
    </section>
  );
}
