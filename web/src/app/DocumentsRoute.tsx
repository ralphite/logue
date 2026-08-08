import { Download, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Empty, ErrorNote, IconButton, Menu, MenuItem, OriginMark, SourceLink, Spinner, originOf } from "@logue/ui";
import { api, ApiError, type Material } from "../api";
import { Page, Row, RowActions, Rows } from "./AppShell";
import { timeAgo, useAction, useHost } from "./useHost";

const AUTOSAVE_MS = 900;

export function DocumentsRoute({
  openId,
  onOpen,
}: {
  openId: string | undefined;
  onOpen: (id: string | undefined) => void;
}) {
  return openId ? <DocumentEditor id={openId} onBack={() => onOpen(undefined)} /> : <DocumentList onOpen={onOpen} />;
}

function DocumentList({ onOpen }: { onOpen: (id: string) => void }) {
  const documents = useHost(() => api.documents(), []);
  const action = useAction();

  return (
    <Page
      title="Documents"
      actions={
        <Button
          variant="primary"
          onClick={() =>
            void action.run(async () => {
              const { document } = await api.createDocument({});
              onOpen(document.id);
            })
          }
        >
          <Plus size={13} /> New
        </Button>
      }
    >
      {documents.error && <ErrorNote className="mb-2">{documents.error}</ErrorNote>}
      {documents.loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted">
          <Spinner /> Loading
        </div>
      ) : (documents.data?.documents.length ?? 0) === 0 ? (
        <Empty>Draft one from a Project, or start an empty page.</Empty>
      ) : (
        <Rows>
          {documents.data?.documents.map((document) => (
            <Row key={document.id} onClick={() => onOpen(document.id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{document.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span>{timeAgo(document.updated_at)}</span>
                  {document.source_ids.length > 0 && <span>{document.source_ids.length} Sources</span>}
                </span>
              </span>
              <RowActions>
                <Menu
                  label="Document actions"
                  trigger={(props) => (
                    <IconButton
                      label="More actions"
                      {...props}
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onClick();
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </IconButton>
                  )}
                >
                  <MenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      window.open(api.documentMarkdownUrl(document.id), "_blank");
                    }}
                  >
                    <Download size={13} /> Export Markdown
                  </MenuItem>
                  <MenuItem
                    tone="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      void action.run(() => api.deleteDocument(document.id)).then(() => documents.refresh());
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </MenuItem>
                </Menu>
              </RowActions>
            </Row>
          ))}
        </Rows>
      )}
    </Page>
  );
}

function DocumentEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const loaded = useHost(() => api.document(id), [id]);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<string>("");
  /** What this editor last saw. Sent with every save so a second writer is caught. */
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const action = useAction();
  const doc = loaded.data?.document;

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setRevision(doc.revision);
    setConflict(false);
    if (body.current) body.current.innerHTML = doc.content;
  }, [doc]);

  const write = async (changes: { title?: string; content?: string }, force = false) => {
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
  const queueSave = (changes: { title?: string; content?: string }) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void action.run(() => write(changes));
    }, AUTOSAVE_MS);
  };

  const mine = () => ({ title, content: body.current?.innerHTML ?? "" });

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
              queueSave({ title: event.target.value });
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
            onInput={() => queueSave({ content: body.current?.innerHTML ?? "" })}
            className="logue-prose min-h-72 outline-0"
          />

          <footer className="mt-6 flex items-center gap-2 border-t border-line pt-2 text-[11px] text-faint">
            <span>Revision {doc.revision}</span>
            {saved && <span>Saved {timeAgo(saved)}</span>}
            {action.busy && <Spinner size={11} />}
          </footer>

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
