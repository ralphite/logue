import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorNote, OriginMark, SourceLink, Spinner, originOf } from "@logue/ui";
import { api, ApiError, type Material } from "../api";
import { Nothing, Page } from "./AppShell";
import { DocumentHistory } from "./DocumentHistory";
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
}: {
  openId: string | undefined;
  onOpen: (id: string | undefined) => void;
}) {
  return openId ? (
    <DocumentEditor id={openId} onBack={() => onOpen(undefined)} />
  ) : (
    <Nothing section="Documents" hint="Pick one from the list, or start a new page." />
  );
}

function DocumentEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const loaded = useHost(() => api.document(id), [id]);
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
  const queueSave = (changes: { title?: string; content?: string; title_state?: "auto" | "generated" | "edited" }) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void action.run(() => write(changes));
    }, AUTOSAVE_MS);
  };

  const mine = () => ({ title, content: body.current?.innerHTML ?? "" });

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
    if (named !== "auto" || !firstLine(body.current?.innerHTML ?? "")) return;
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
        <Button onClick={() => window.open(api.documentMarkdownUrl(id), "_blank")}>
          <Download size={13} /> Export
        </Button>
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
            {/* The revision number was already printed here and meant nothing
                to anyone. Making it the way in costs the rail no new control. */}
            <button
              type="button"
              onClick={() => setLooking(true)}
              className="rounded-md py-0.5 text-[11px] text-faint underline decoration-line underline-offset-2 hover:text-ink"
            >
              Version {doc.revision}
            </button>
            {saved && <span>Saved {timeAgo(saved)}</span>}
            {action.busy && <Spinner size={11} />}
          </footer>

          <DocumentHistory
            id={id}
            open={looking}
            onClose={() => setLooking(false)}
            onRestored={() => void loaded.refresh()}
          />

          <Sources sources={loaded.data?.sources ?? []} />
        </>
      )}
    </Page>
  );
}

/** The Sources a document cites, so a reader can check any claim. */
function Sources({ sources }: { sources: Material[] }) {
  if (sources.length === 0) return null;
  return (
    <section className="mt-6 grid gap-1.5">
      <h2 className="text-xs text-muted">{sources.length} Sources</h2>
      {sources.map((source, index) => (
        <div key={source.id} className="flex gap-2 rounded-md bg-surface-muted px-2 py-1.5">
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
