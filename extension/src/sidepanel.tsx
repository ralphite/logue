import { Bookmark, CornerDownLeft, ExternalLink, Settings2, Sparkles } from "lucide-react";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Answer, Button, ErrorNote, Input, OriginMark, Select, SourceLink, Spinner, Tag, originOf } from "@logue/ui";
import { host, HOST, type Context, type Material } from "./api";
import { readablePageText } from "./readable";

/**
 * Where Logue lives, which is the Host itself.
 *
 * This pointed at the dev server's port, so every "open in Logue" from the
 * panel went to an address that is only up while someone is building. One
 * machine, one Logue, one address — and it is the one already in `api.ts`.
 */
const WEB_APP = HOST;

/** What came off the page, as opposed to what you said about it. */
const FROM_THE_PAGE = new Set(["page", "selection"]);

/** What the last Skill run said, in the order it said it. */
interface ThreadMessage {
  from: "logue" | "skill";
  text: string;
  at: string;
}

const THREAD = "logue:thread";

/** Storage is shared ground; anything in there that is not a message is not one. */
function isMessage(value: unknown): value is ThreadMessage {
  if (!value || typeof value !== "object") return false;
  return "text" in value && typeof value.text === "string" && "from" in value;
}

/**
 * A Skill run from the page's own menu, shown as it happened.
 *
 * Two messages and not a transcript of one: what was run, and what came back.
 * The panel is otherwise a set of sections about this page, and a run has a
 * before and an after — that is a conversation, however short.
 */
function Thread({ messages, onClear }: { messages: ThreadMessage[]; onClear: () => void }) {
  if (messages.length === 0) return null;
  return (
    <section className="mb-3 grid gap-1.5 rounded-lg border border-line bg-surface p-2">
      <span className="flex items-center gap-1">
        <Sparkles size={11} className="text-muted" />
        <span className="flex-1 text-xs text-muted">From this page</span>
        <button type="button" onClick={onClear} className="rounded-md px-1 text-xs text-muted hover:text-ink">
          Clear
        </button>
      </span>
      {messages.map((message) => (
        <p
          key={`${message.from}:${message.at}`}
          className={
            message.from === "logue"
              ? "text-xs text-muted"
              : "rounded-md bg-surface-muted p-2 text-xs leading-[1.55] whitespace-pre-wrap text-ink"
          }
        >
          {message.text}
        </p>
      ))}
    </section>
  );
}

/**
 * The panel is about *this page*: what came off it, what you said about it, and
 * a place to ask using it. Everything past that is folded away — the panel is
 * 360 pixels wide and the page beside it is the thing being read.
 */
function Panel() {
  const [tab, setTab] = useState<{ id?: number; url: string; title: string }>();
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [context, setContext] = useState<Context>();
  const [saved, setSaved] = useState<Material[]>([]);
  const [project, setProject] = useState("");
  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState<{ text: string; sources: Material[] }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openSource, setOpenSource] = useState<number>();
  const [modelReady, setModelReady] = useState(true);

  const load = useCallback(async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = active?.url ?? "";
    setTab({ id: active?.id, url, title: active?.title ?? "" });
    try {
      const [ctx, page, status] = await Promise.all([
        host.context(project),
        url ? host.pageMaterials(url) : { materials: [] },
        host.status(),
      ]);
      setContext(ctx);
      setSaved(page.materials);
      setModelReady(status.model.generation_ready && status.model.voice_ready);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logue is not running on this Mac.");
    }
  }, [project]);

  // The thread is written to storage before the panel opens — a side panel is
  // requested, not called — so it is read on arrival and again on notice.
  useEffect(() => {
    const read = () => {
      void chrome.storage.local.get(THREAD).then((stored) => {
        const found: unknown = stored[THREAD];
        setThread(Array.isArray(found) ? found.filter(isMessage) : []);
      });
    };
    read();
    const onMessage = (message: unknown) => {
      if (message && typeof message === "object" && "type" in message && message.type === "logue:thread-changed") {
        read();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    void load();
    const onActivated = () => void load();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onActivated);
    };
  }, [load]);

  const capture = async () => {
    if (!tab?.url || tab.id === undefined) return;
    setBusy(true);
    try {
      // Keep the page's text, not just its address. A Source that is only a URL
      // stops being evidence the first time the page changes or disappears.
      let body = "";
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: readablePageText,
        });
        body = typeof result?.result === "string" ? result.result : "";
      } catch {
        // A restricted page cannot be read; the title and URL still stand.
      }
      await host.saveMaterial({
        kind: "page",
        content: body || tab.title || tab.url,
        source: { url: tab.url, title: tab.title, domain: new URL(tab.url).hostname },
        projects: project ? [project] : [],
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this page.");
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    const usable = (context?.skills ?? []).filter((skill) => skill.enabled);
    const skill =
      usable.find((item) => item.id === context?.defaults?.qa) ??
      usable.find((item) => item.built_in_key === "ask") ??
      usable[0];
    if (!skill || !instruction.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await host.run({
        skill_id: skill.id,
        instruction: instruction.trim(),
        project,
        source_ids: project ? undefined : saved.map((item) => item.id),
      });
      if (result.run.status !== "complete") {
        setError(result.run.error ?? "The model did not answer.");
        return;
      }
      setAnswer({ text: result.run.original_output ?? "", sources: result.sources });
      setInstruction("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run that.");
    } finally {
      setBusy(false);
    }
  };

  const fromPage = saved.filter((item) => FROM_THE_PAGE.has(item.kind));
  const said = saved.filter((item) => !FROM_THE_PAGE.has(item.kind));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-row shrink-0 items-center gap-1 border-b border-line px-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{tab?.title || "This page"}</span>
        <a
          href={WEB_APP}
          target="_blank"
          rel="noreferrer"
          title="Open Logue"
          className="inline-flex size-control items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-ink"
        >
          <ExternalLink size={14} />
        </a>
      </header>

      <div className="logue-scroll flex-1 p-2">
        {error && <ErrorNote className="mb-2">{error}</ErrorNote>}

        <Thread
          messages={thread}
          onClear={() => {
            setThread([]);
            void chrome.storage.local.remove(THREAD);
          }}
        />

        {!modelReady && !error && (
          // The one thing that makes every other control in here do nothing.
          <a
            href={`${WEB_APP}/settings`}
            target="_blank"
            rel="noreferrer"
            className="mb-2 flex items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2 py-1.5 text-xs text-warning hover:text-ink"
          >
            <Settings2 size={12} />
            The model is not connected. Open Settings.
          </a>
        )}

        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <Select
              className="flex-1"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              aria-label="Project"
            >
              <option value="">No Project</option>
              {context?.projects.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button onClick={() => void capture()} disabled={busy}>
              <Bookmark size={13} /> Save page
            </Button>
          </div>

          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void ask();
              }
            }}
            placeholder={project ? `Ask about ${project}…` : "Ask about this page…"}
            aria-label="What to ask"
            className="min-h-16 w-full resize-y rounded-md border border-line-strong bg-surface px-2 py-1.5 text-[13px] leading-[1.5] text-ink outline-0 focus:border-accent-line"
          />
          <div className="flex justify-end">
            <Button variant="primary" disabled={busy || !instruction.trim()} onClick={() => void ask()}>
              {busy ? <Spinner size={13} /> : <CornerDownLeft size={13} />} Ask
            </Button>
          </div>
        </div>

        {answer && (
          <div className="mt-3 grid gap-2 rounded-lg border border-line bg-surface p-2.5">
            <OriginMark origin="ai" detail={`${answer.sources.length} Sources`} />
            <p className="text-[13px] leading-[1.6] whitespace-pre-wrap text-ink">
              <Answer text={answer.text} open={openSource} onCite={setOpenSource} sources={answer.sources} />
            </p>
            {openSource !== undefined && answer.sources[openSource - 1] && (
              <p className="line-clamp-6 rounded-md bg-surface-muted p-2 text-xs leading-[1.45] text-ink-soft">
                {answer.sources[openSource - 1]!.content}
              </p>
            )}
            <IntoDocument answer={answer} onError={setError} />
          </div>
        )}

        <Kept title="On this page" items={fromPage} context={context} onChanged={load} empty="Nothing saved yet." />
        <Kept title="What you added" items={said} context={context} onChanged={load} empty="No comments yet." />

        {project && <AboutProject project={project} context={context} onError={setError} />}
      </div>
    </div>
  );
}

/**
 * Send the answer somewhere it will be found again.
 *
 * Appending rather than reading and rewriting: the panel cannot see the
 * document, and overwriting whatever was typed in it meanwhile would be a
 * poor trade for a convenience.
 */
function IntoDocument({
  answer,
  onError,
}: {
  answer: { text: string; sources: Material[] };
  onError: (message: string) => void;
}) {
  const [documents, setDocuments] = useState<{ id: string; title: string }[]>([]);
  const [into, setInto] = useState("");
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void host.documents().then(
      (found) => setDocuments(found.documents.slice(0, 20)),
      () => setDocuments([]),
    );
  }, []);

  if (documents.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-t border-line pt-2">
      <Select className="min-w-0 flex-1" value={into} onChange={(e) => setInto(e.target.value)} aria-label="Add to a Document">
        <option value="">Add to a Document…</option>
        {documents.map((document) => (
          <option key={document.id} value={document.id}>
            {document.title || "Untitled"}
          </option>
        ))}
      </Select>
      <Button
        disabled={!into || busy || added}
        onClick={() => {
          setBusy(true);
          void host
            .appendToDocument(into, answer.text, answer.sources.map((s) => s.id))
            .then(
              () => setAdded(true),
              (cause: unknown) => onError(cause instanceof Error ? cause.message : "Could not add it."),
            )
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Spinner size={12} /> : null} {added ? "Added" : "Add"}
      </Button>
    </div>
  );
}

/**
 * What is already kept from this page, and the two things worth doing to it
 * without leaving: hear it again, and file it.
 */
function Kept({
  title,
  items,
  context,
  onChanged,
  empty,
}: {
  title: string;
  items: Material[];
  context?: Context;
  onChanged: () => Promise<void> | void;
  empty: string;
}) {
  const [openId, setOpenId] = useState<string>();

  /*
   * An empty section is one line, not a block.
   *
   * Two of them, each with a heading and a panel saying nothing is here, took
   * most of a 360-pixel panel to report twice over that there was nothing to
   * report — and pushed whatever did exist off the bottom. The count next to
   * the heading already says it: 0.
   *
   * Not the same as an empty list in the rail, which has to offer a way to
   * begin. Nothing is created from here; these two are a reading of this page,
   * and when the page has nothing they should take up the room of a line.
   */
  if (items.length === 0) {
    return (
      <section className="mt-3 flex items-center gap-1.5 text-xs text-muted" title={empty}>
        {title}
        <span>0</span>
      </section>
    );
  }

  return (
    <section className="mt-4 grid gap-1">
      <h2 className="flex items-center gap-1.5 text-xs text-muted">
        {title}
        <span className="text-muted">{items.length}</span>
      </h2>
      {(
        <div className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <div key={item.id} className="py-1.5">
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setOpenId(openId === item.id ? undefined : item.id)}
              >
                <span className="flex items-center gap-2 text-xs text-muted">
                  <OriginMark origin={originOf(item.kind)} />
                  <SourceLink url={item.source?.url} label={item.source?.domain || "This Mac"} />
                </span>
                <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
              </button>
              {item.capture_id && (
                // The recording, playable where it was made rather than only
                // in the Web App — this is the page it was made on.
                <audio controls preload="none" src={host.audioUrl(item.capture_id)} className="mt-1 h-7 w-full" />
              )}
              {openId === item.id && <Filing material={item} context={context} onChanged={onChanged} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Where a Source belongs and what it is about, decided while it is fresh. */
function Filing({
  material,
  context,
  onChanged,
}: {
  material: Material;
  context?: Context;
  onChanged: () => Promise<void> | void;
}) {
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const tags = material.tags ?? [];

  const run = (work: Promise<unknown>) => {
    setBusy(true);
    void work.then(() => onChanged()).finally(() => setBusy(false));
  };

  return (
    <div className="mt-1.5 grid gap-1.5 rounded-md bg-surface-muted p-1.5">
      <div className="flex flex-wrap gap-1">
        {(context?.projects ?? []).map((project) => {
          const member = material.projects.includes(project.name);
          return (
            <Button
              key={project.id}
              variant={member ? "primary" : "default"}
              disabled={busy}
              onClick={() => run(host.setMembership(material.id, project.name, !member))}
            >
              {project.name}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {tags.map((name) => (
          <Tag
            key={name}
            name={name}
            onRemove={() => run(host.tagMaterial(material.id, tags.filter((tag) => tag !== name)))}
          />
        ))}
        <Input
          value={adding}
          disabled={busy}
          placeholder="Add a tag"
          aria-label="Add a tag"
          className="h-6 w-24 px-1.5 text-xs"
          onChange={(event) => setAdding(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const name = adding.trim().replace(/^#/, "");
            setAdding("");
            if (name && !tags.includes(name)) run(host.tagMaterial(material.id, [...tags, name]));
          }}
        />
      </div>
    </div>
  );
}

/**
 * The Project's background and the words it uses, editable here.
 *
 * These are what make a transcript sound like this work rather than like
 * anyone's, and the moment you notice they are wrong is the moment something
 * came out wrong — which happens on a page, not in the Web App.
 */
function AboutProject({
  project,
  context,
  onError,
}: {
  project: string;
  context?: Context;
  onError: (message: string) => void;
}) {
  const found = context?.projects.find((item) => item.name === project);
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState("");
  const [terms, setTerms] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !found) return;
    void host.project(found.id).then(
      ({ project: detail }) => {
        setOverview(detail.overview ?? "");
        setTerms((detail.transcription_profile?.vocabulary?.terms ?? []).join(", "));
      },
      () => undefined,
    );
  }, [open, found]);

  if (!found) return null;

  return (
    <section className="mt-4 border-t border-line pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 text-left text-xs text-muted hover:text-ink"
      >
        {open ? "▾" : "▸"} About {project}
      </button>
      {open && (
        <div className="mt-1.5 grid gap-1.5">
          <textarea
            value={overview}
            onChange={(event) => {
              setOverview(event.target.value);
              setSaved(false);
            }}
            placeholder="What this Project is about"
            aria-label="Project context"
            className="min-h-16 w-full resize-y rounded-md border border-line-strong bg-surface px-2 py-1.5 text-xs leading-[1.5] text-ink outline-0 focus:border-accent-line"
          />
          <Input
            value={terms}
            onChange={(event) => {
              setTerms(event.target.value);
              setSaved(false);
            }}
            placeholder="Terms to spell exactly, comma separated"
            aria-label="Project terms"
            className="text-xs"
          />
          <div className="flex items-center justify-end gap-1">
            {saved && <span className="text-xs text-success">Saved</span>}
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                const list = terms.split(",").map((term) => term.trim()).filter(Boolean);
                void host
                  .updateProject(found.id, {
                    overview,
                    // `customized` is what makes the Host prefer these over the
                    // global profile when transcribing for this Project.
                    transcription_profile: { mode: "customized", vocabulary: { terms: list } },
                  })
                  .then(
                    () => setSaved(true),
                    (cause: unknown) => onError(cause instanceof Error ? cause.message : "Could not save."),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? <Spinner size={12} /> : null} Save
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
