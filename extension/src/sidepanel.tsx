import { Bookmark, Check, Copy, CornerDownLeft, Crosshair, ExternalLink, Mic, Settings2, Sparkles, X } from "lucide-react";
import { StrictMode, useCallback, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Answer,
  Button,
  ErrorNote,
  IconButton,
  Input,
  OriginMark,
  Recording,
  Select,
  Spinner,
  Tag,
  Textarea,
  cn,
  originOf,
} from "@logue/ui";
import { audioUrl, host, HostError, type Context, type Material } from "./api";
import { send } from "./messages";
import { readablePageText } from "./readable";
import { currentServer, DEFAULT_SERVER, readAddress, rememberServer, whenServerChanges } from "./server";
import { clearThread, readThread, writeThread } from "./thread";
import { useVoice } from "./useVoice";


/** What came off the page, as opposed to what you said about it. */
const FROM_THE_PAGE = new Set(["page", "selection"]);

/** What the last Skill run said, in the order it said it. */
interface ThreadMessage {
  from: "logue" | "skill" | "you";
  text: string;
  at: string;
  /** What the agent did to get here, in the order it did it. */
  steps?: { did: string; detail: string; proposed?: boolean }[];
  /** A change it would like to make, waiting for a person. */
  proposal?: { id: string; tool: string; reason?: string; title?: string } | null;
  /** Sources behind this answer, so a claim can be followed back. */
  sources?: Material[];
}

/** A key that belongs to whatever is being typed into, not to the panel. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
/** Written by ⌘⇧K before the panel opens; read here on arrival. */
const LISTEN = "logue:listen-at";

/** Storage is shared ground; anything in there that is not a message is not one. */
function isMessage(value: unknown): value is ThreadMessage {
  if (!value || typeof value !== "object") return false;
  return "text" in value && typeof value.text === "string" && "from" in value;
}

/** What each tool call is called, in words rather than in function names. */
const DID: Record<string, string> = {
  find_sources: "Looked through your Sources",
  run_skill: "Ran a Skill",
  save_page: "Would save this page",
  add_to_project: "Would file this into a Project",
  draft_document: "Would draft a document",
};

/**
 * The conversation: what you said, what the agent did, and what it answered.
 *
 * Everything the agent touched is listed above the answer it produced, and a
 * change it would like to make sits underneath waiting for a person. An agent
 * that worked invisibly would be the wrong shape for a product whose claim is
 * that every sentence can be traced.
 */
function Thread({
  messages,
  onClear,
  onAccept,
  onDiscard,
  onError,
  busy,
}: {
  messages: ThreadMessage[];
  onClear: () => void;
  onAccept: (message: ThreadMessage) => void;
  onDiscard: (message: ThreadMessage) => void;
  onError: (message: string) => void;
  busy: boolean;
}) {
  // Which citation is open, by message and number: two answers in one thread
  // each have a [Source 1], and opening one must not open the other's.
  const [openCite, setOpenCite] = useState<string>();

  if (messages.length === 0) return null;
  return (
    <section className="mb-3 grid gap-1.5 rounded-lg border border-line bg-surface p-2">
      <span className="flex items-center gap-1">
        <Sparkles size={11} className="text-muted" />
        <span className="flex-1 text-xs text-muted">From this page</span>
        <button
          type="button"
          onClick={onClear}
          className="-my-1 rounded-md px-1 py-1 text-xs text-muted hover:text-ink"
        >
          Clear
        </button>
      </span>
      {messages.map((message) => (
        <div key={`${message.from}:${message.at}`} className="grid gap-1">
        {(message.steps ?? []).length > 0 && (
          // Everything it touched, before the answer that came of it. An agent
          // that quietly did three things and reported one is worse than none.
          <ul className="grid gap-0.5">
            {(message.steps ?? []).map((step) => (
              <li key={`${step.did}:${step.detail}`} className="flex items-baseline gap-1 text-xs text-muted">
                <span className="text-ink-soft">{DID[step.did] ?? step.did}</span>
                <span className="truncate">{step.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <p
          className={
            message.from === "logue"
              ? "text-xs text-muted"
              : message.from === "you"
                ? // What you said, set apart from what came back — a conversation
                  // where both sides look alike is a wall of text.
                  "rounded-md border border-accent-line bg-accent-soft p-2 text-[13px] leading-[1.55] whitespace-pre-wrap text-ink"
                : "rounded-md bg-surface-muted p-2 text-[13px] leading-[1.55] whitespace-pre-wrap text-ink"
          }
        >
          {(message.sources ?? []).length > 0 ? (
            // Live citations, the same as everywhere else: an answer whose
            // [Source n] cannot be opened is a claim with nothing behind it.
            <Answer
              text={message.text}
              sources={message.sources ?? []}
              open={openCite?.startsWith(`${message.at}:`) ? Number(openCite.split(":").pop()) : undefined}
              onCite={(n) => setOpenCite(n === undefined ? undefined : `${message.at}:${n}`)}
            />
          ) : (
            message.text
          )}
        </p>
        {openCite?.startsWith(`${message.at}:`) &&
          (message.sources ?? [])[Number(openCite.split(":").pop()) - 1] && (
            <p className="line-clamp-6 rounded-md bg-surface-muted p-2 text-xs leading-[1.45] text-ink-soft">
              {(message.sources ?? [])[Number(openCite.split(":").pop()) - 1]!.content}
            </p>
          )}
        {(message.sources ?? []).length > 0 && (
          <div className="grid gap-1.5 rounded-md border border-line p-2">
            <OriginMark origin="ai" detail={`${(message.sources ?? []).length} Sources`} />
            <IntoDocument answer={{ text: message.text, sources: message.sources ?? [] }} onError={onError} />
          </div>
        )}
        {message.proposal && (
          // Nothing has happened yet. A change is a proposal until someone
          // says yes — the line between this and every other assistant.
          <div className="flex items-center gap-1 rounded-md border border-accent-line bg-accent-soft px-2 py-1.5">
            <span className="flex-1 text-xs text-ink">
              {DID[message.proposal.tool] ?? message.proposal.tool}
              {message.proposal.title ? ` — “${message.proposal.title}”` : ""}
            </span>
            <Button variant="primary" disabled={busy} onClick={() => onAccept(message)}>
              Do it
            </Button>
            <IconButton label="Leave it" disabled={busy} onClick={() => onDiscard(message)}>
              <X size={13} />
            </IconButton>
          </div>
        )}
        </div>
      ))}
    </section>
  );
}


/** Time, in the words a person uses. */
function timeAgo(when: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(when).toLocaleDateString();
}

/** Someone's own words go into HTML as text, never as markup. */
function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Copy something with what it was about.
 *
 * A comment on its own is half a thought: whoever you paste it to cannot see
 * the sentence you were answering. So the passage goes first, as a quote, and
 * your words underneath — with a way back to where it lives.
 *
 * Both flavours are written at once: rich text for Notion and Docs, plain for
 * anywhere that would otherwise receive a paragraph of angle brackets.
 */
async function copyWithQuote(item: Material): Promise<void> {
  let quoted = "";
  const parent = item.parent_ids?.[0];
  if (parent) {
    try {
      quoted = (await host.material(parent)).material.content;
    } catch {
      // The passage is gone or unreachable; the comment still copies, and
      // saying less is better than refusing to copy at all.
    }
  }
  if (!quoted && item.context && item.context !== item.content) quoted = item.context;

  const where = item.source?.url ?? "";
  const plain = [
    quoted ? quoted.split("\n").map((line) => `> ${line}`).join("\n") : "",
    item.content,
    where ? `— ${where}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const html = [
    quoted ? `<blockquote>${escape(quoted).replace(/\n/g, "<br>")}</blockquote>` : "",
    `<p>${escape(item.content).replace(/\n/g, "<br>")}</p>`,
    where ? `<p><a href="${escape(where)}">${escape(where)}</a></p>` : "",
  ]
    .filter(Boolean)
    .join("");

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } catch {
    // Some contexts refuse the rich write; the words matter more than the
    // formatting, so fall back rather than copy nothing.
    await navigator.clipboard.writeText(plain);
  }
}

/**
 * Nothing here yet, said the same way everywhere.
 *
 * The three tabs each had their own shape for this: a grey line shoved to the
 * bottom by `justify-end`, a folded section row, and a long sentence sitting
 * above half a screen of white. One thing, three faces.
 */
function NothingYet({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <p className="max-w-56 text-center text-xs leading-[1.6] text-muted">{children}</p>
    </div>
  );
}

/** A recording made while Logue was off, and what can be done about it. */
interface Waiting {
  id: string;
  at: string;
  seconds?: number;
  tries?: number;
  audio: string;
  mediaType: string;
  page?: string;
}

const PENDING_KEY = "logue:pending-voice";

function isWaiting(value: unknown): value is Waiting {
  if (typeof value !== "object" || value === null) return false;
  return "id" in value && typeof value.id === "string" && "audio" in value;
}

function clock(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/**
 * The recordings waiting for Logue, where a person can see them.
 *
 * They were already being kept and already being sent — but only the queue
 * knew that. Audio sitting on disk that nobody can reach, retry or export
 * reads exactly like audio that was lost.
 */
/** Hand the audio back as a file — the words are the person's, not ours. */
function download(one: Waiting): void {
  const bytes = Uint8Array.from(atob(one.audio), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: one.mediaType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `logue-${one.at.replace(/[:.]/g, "-")}.webm`;
  link.click();
  URL.revokeObjectURL(url);
}

function WaitingRecordings({ items, onChanged }: { items: Waiting[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (items.length === 0) return null;

  const failing = items.filter((one) => (one.tries ?? 0) > 0).length;

  return (
    <section className="grid gap-1.5 rounded-lg border border-line bg-surface-muted p-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left text-xs text-ink-soft"
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", failing > 0 ? "bg-danger" : "bg-warning")} />
        <span className="flex-1">
          {items.length} recording{items.length === 1 ? "" : "s"} waiting
          {failing > 0 ? ` · ${failing} failed` : ""}
        </span>
        <span className="text-accent-ink">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="grid gap-1.5">
          {items.map((one) => (
            <div key={one.id} className="grid gap-1 rounded-md border border-line bg-surface p-2">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{new Date(one.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                {one.seconds ? <span>· {clock(one.seconds)}</span> : null}
                {one.page ? <span className="truncate">· {one.page}</span> : null}
              </div>
              <p className={cn("text-xs", (one.tries ?? 0) > 0 ? "text-danger" : "text-muted")}>
                {(one.tries ?? 0) > 0
                  ? `Failed ${one.tries} time${one.tries === 1 ? "" : "s"} — the audio is kept`
                  : "Goes in when Logue is back — nothing to do"}
              </p>
              <div className="flex gap-1">
                <Button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void chrome.runtime
                      .sendMessage({ type: "logue:pending-send" })
                      .catch(() => undefined)
                      .then(() => setTimeout(() => { setBusy(false); onChanged(); }, 1200));
                  }}
                >
                  Try now
                </Button>
                <Button onClick={() => download(one)}>Export audio</Button>
                <Button
                  onClick={() => {
                    void chrome.storage.local.get(PENDING_KEY).then((stored) => {
                      const found: unknown = stored[PENDING_KEY];
                      const rest = (Array.isArray(found) ? found.filter(isWaiting) : []).filter((x) => x.id !== one.id);
                      void chrome.storage.local.set({ [PENDING_KEY]: rest }).then(onChanged);
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The panel is about *this page*: what came off it, what you said about it, and
 * a place to ask using it. Everything past that is folded away — the panel is
 * 360 pixels wide and the page beside it is the thing being read.
 */
/**
 * Where Logue is.
 *
 * The extension used to know this on its own, because there was one answer.
 * A Host published through a tunnel or sitting on another computer has an
 * address no build can guess, and this panel is the only place a person can
 * say it — the app's own Settings live behind the very Host being named.
 *
 * The address is tried before it is kept. A typo that was stored first would
 * leave every surface pointing at nothing, and the way back would be this same
 * box, now unable to tell you whether the new address is any better.
 */
function WhereLogueIs({ server, onConnected }: { server: string; onConnected: (server: string) => void }) {
  const [draft, setDraft] = useState(server);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const [note, setNote] = useState("");

  // Another panel may have changed it while this one was open.
  useEffect(() => setDraft(server), [server]);

  const connect = async () => {
    setFailed("");
    setNote("");
    let address: string;
    try {
      address = readAddress(draft);
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "That is not an address Logue can reach.");
      return;
    }
    setBusy(true);
    const reply = await send<{ ok: boolean; message?: string }>({ type: "logue:server-probe", server: address });
    setBusy(false);
    if (!reply?.ok) {
      setFailed(reply?.message ?? "Logue's background service is restarting. Try again in a moment.");
      return;
    }
    await rememberServer(address);
    setDraft(address);
    setNote(`Connected to ${address}`);
    onConnected(address);
  };

  return (
    <div className="grid gap-1.5 border-t border-line bg-surface-muted px-2 py-2">
      <label htmlFor="logue-server" className="text-xs text-muted">
        Logue server
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id="logue-server"
          className="flex-1 text-xs"
          value={draft}
          placeholder={DEFAULT_SERVER}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void connect();
          }}
        />
        <Button variant="primary" disabled={busy} onClick={() => void connect()}>
          {busy ? <Spinner size={13} /> : null} Connect
        </Button>
      </div>
      {failed ? (
        <ErrorNote>{failed}</ErrorNote>
      ) : (
        <p className="text-xs text-muted">
          {note || "The address of the Host this browser talks to — this computer, another one, or a tunnel."}
        </p>
      )}
    </div>
  );
}

function Panel() {
  const [page, setPage] = useState<{ id?: number; url: string; title: string }>();
  /** Which page the conversation belongs to. Empty means there is no page. */
  const pageUrl = page?.url ?? "";
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [context, setContext] = useState<Context>();
  const [saved, setSaved] = useState<Material[]>([]);
  const [project, setProject] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(true);
  /** Which part of the panel is showing. Chat is the one people come for. */
  const [tab, setTab] = useState<"chat" | "page" | "project">("chat");
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  /** Which Logue this browser is talking to, and whether it is being changed. */
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [changingServer, setChangingServer] = useState(false);
  /** The Host never answered at all — which the address can be the reason for. */
  const [unreachable, setUnreachable] = useState(false);
  const voice = useVoice();

  // Read before anything is asked of the Host, and followed afterwards: the
  // address can be changed from another panel, and a panel still calling the
  // previous one would report it as down.
  useEffect(() => {
    void currentServer().then(setServer);
    return whenServerChanges(setServer);
  }, []);

  /**
   * Add to the conversation, in the panel and in storage, as one act.
   *
   * Filed under the page it was said on. There used to be one conversation
   * with nothing tying it to anywhere, so a question about an article stayed
   * on screen over a Google Doc, above an unrelated answer.
   */
  const say = useCallback(
    (message: ThreadMessage) => {
      setThread((was) => {
        const next = [...was, message];
        if (pageUrl) void writeThread(pageUrl, next, new Date().toISOString());
        return next;
      });
    },
    [pageUrl],
  );

  const load = useCallback(async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = active?.url ?? "";
    setPage({ id: active?.id, url, title: active?.title ?? "" });
    try {
      const [ctx, onPage, status] = await Promise.all([
        host.context(project),
        url ? host.pageMaterials(url) : { materials: [] },
        host.status(),
      ]);
      setContext(ctx);
      setSaved(onPage.materials);
      setModelReady(status.model.generation_ready && status.model.voice_ready);
      setError("");
      setUnreachable(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logue is not answering.");
      // Status 0 is the worker saying the request never happened. That is the
      // one failure the address can be the reason for, so it is the only one
      // that opens the address form — a Host that answered 500 is reachable.
      setUnreachable(cause instanceof HostError && cause.status === 0);
    }
  }, [project]);

  // The thread is written to storage before the panel opens — a side panel is
  // requested, not called — so it is read on arrival and again on notice.
  // …and re-read whenever the page changes, because the conversation belongs
  // to the page rather than to the panel.
  useEffect(() => {
    const read = () => {
      if (!pageUrl) {
        setThread([]);
        return;
      }
      void readThread(pageUrl).then((found) => setThread(found.filter(isMessage)));
    };
    read();
    const onMessage = (message: unknown) => {
      if (message && typeof message === "object" && "type" in message && message.type === "logue:thread-changed") {
        read();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [pageUrl]);

  // ⌘⇧K: the panel opens and starts listening in the same act. The flag is
  // consumed on read so re-opening the panel later does not start a recording
  // nobody asked for.
  const listen = voice.start;
  useEffect(() => {
    const begin = () => {
      void chrome.storage.local.get(LISTEN).then((stored) => {
        if (!stored[LISTEN]) return;
        void chrome.storage.local.remove(LISTEN);
        void listen();
      });
    };
    begin();
    const onMessage = (message: unknown) => {
      if (message && typeof message === "object" && "type" in message && message.type === "logue:listen") {
        begin();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [listen]);

  const readWaiting = useCallback(() => {
    void chrome.storage.local.get(PENDING_KEY).then((stored) => {
      const found: unknown = stored[PENDING_KEY];
      setWaiting(Array.isArray(found) ? found.filter(isWaiting) : []);
    });
  }, []);

  useEffect(() => {
    readWaiting();
    const onStorage = (changes: Record<string, unknown>) => {
      if (PENDING_KEY in changes) readWaiting();
    };
    chrome.storage.local.onChanged.addListener(onStorage);
    return () => chrome.storage.local.onChanged.removeListener(onStorage);
  }, [readWaiting]);

  useEffect(() => {
    void load();
    const onActivated = () => void load();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onActivated);
    };
    // `server` is not read here, but everything `load` asks for is fetched from
    // it — a panel that kept the failure from the old address would say Logue
    // is down while it is answering at the new one.
  }, [load, server]);

  const capture = async () => {
    if (!page?.url || page.id === undefined) return;
    setBusy(true);
    try {
      // Keep the page's text, not just its address. A Source that is only a URL
      // stops being evidence the first time the page changes or disappears.
      let body = "";
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: page.id },
          func: readablePageText,
        });
        body = typeof result?.result === "string" ? result.result : "";
      } catch {
        // A restricted page cannot be read; the title and URL still stand.
      }
      await host.saveMaterial({
        kind: "page",
        content: body || page.title || page.url,
        source: { url: page.url, title: page.title, domain: new URL(page.url).hostname },
        projects: project ? [project] : [],
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this page.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Typing and speaking reach the same conversation.
   *
   * They used to be two things: the box ran one Skill and printed an answer
   * below itself, while a spoken message went into the thread. Two ways to
   * ask one question, and the answers did not know about each other.
   */
  const ask = async () => {
    const words = instruction.trim();
    if (!words) return;
    const mine: ThreadMessage = { from: "you", text: words, at: new Date().toISOString() };
    say(mine);
    setInstruction("");
    await converse(words, [...thread, mine]);
  };

  /**
   * Enter accepts, Esc cancels — the same two keys as the bar on the page,
   * so nobody learns a second set. Accepting turns the words into a message
   * from you; cancelling leaves nothing behind.
   */
  /**
   * Send a message to the agent and show everything that came of it.
   *
   * The page travels with the message because "this page" is what the panel
   * is about; the agent reads it rather than guessing from a URL.
   */
  const converse = useCallback(
    async (text: string, history: ThreadMessage[]) => {
      setBusy(true);
      setError("");
      try {
        let body = "";
        if (page?.id !== undefined) {
          try {
            const [result] = await chrome.scripting.executeScript({
              target: { tabId: page.id },
              func: readablePageText,
            });
            body = typeof result?.result === "string" ? result.result : "";
          } catch {
            // A restricted page cannot be read; the agent works without it.
          }
        }
        const turn = await host.agentMessage({
          message: text,
          project,
          page: page?.url ? { url: page.url, title: page.title, text: body } : undefined,
          history: history.map((m) => ({ from: m.from, text: m.text })),
        });
        say({
          from: "skill",
          text: turn.answer,
          at: new Date().toISOString(),
          steps: turn.steps,
          proposal: turn.proposal,
          sources: turn.sources,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not reach Logue.");
      } finally {
        setBusy(false);
      }
    },
    [project, say, page?.id, page?.title, page?.url],
  );

  const accept = useCallback(async () => {
    const settled = await voice.stop({ project, source: { kind: "panel", url: page?.url } });
    const words = settled?.text.trim();
    if (!words) return;
    const mine: ThreadMessage = { from: "you", text: words, at: new Date().toISOString() };
    say(mine);
    // Said, then answered: a message that only sat there would make the
    // shortcut a dictation key rather than a way to ask for something.
    await converse(words, [...thread, mine]);
  }, [voice, project, page?.url, say, converse, thread]);

  useEffect(() => {
    if (voice.phase !== "recording") return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Not while someone is typing. These keys belong to the recording only
      // when nothing else has a claim on them: Esc in the ask box cancelled
      // the recording, and Enter accepted instead of making a new line —
      // v1 had a guard for exactly this and the rebuild did not carry it.
      if (typing(event.target) || event.isComposing || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        voice.cancel();
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void accept();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [voice, accept]);

  /** A person said yes. This is the only path a change can arrive by. */
  const carryOut = useCallback(
    async (message: ThreadMessage) => {
      if (!message.proposal) return;
      setBusy(true);
      try {
        await host.agentAccept({
          proposal: message.proposal,
          page: pageUrl ? { url: pageUrl, title: page?.title ?? "", domain: new URL(pageUrl).hostname } : undefined,
        });
        setThread((was) => {
          const next = was.map((m) => (m.at === message.at ? { ...m, proposal: null } : m));
          if (pageUrl) void writeThread(pageUrl, next, new Date().toISOString());
          return next;
        });
        say({ from: "logue", text: "Done — it is in your workspace.", at: new Date().toISOString() });
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not do that.");
      } finally {
        setBusy(false);
      }
    },
    [pageUrl, page?.title, say, load],
  );

  const leaveIt = useCallback(
    (message: ThreadMessage) => {
      setThread((was) => {
        const next = was.map((m) => (m.at === message.at ? { ...m, proposal: null } : m));
        if (pageUrl) void writeThread(pageUrl, next, new Date().toISOString());
        return next;
      });
    },
    [pageUrl],
  );

  const fromPage = saved.filter((item) => FROM_THE_PAGE.has(item.kind));
  const said = saved.filter((item) => !FROM_THE_PAGE.has(item.kind));

  const composer = (
    // Pinned to the bottom, the way a conversation is written everywhere else:
    // what was said stays above, and the place to say the next thing does not
    // move. The old shape put the box in the middle with the answer printed
    // under it, which reads as a form that has been filled in.
    <div className="shrink-0 border-t border-line bg-surface p-2">
      {(voice.phase === "recording" || voice.phase === "starting" || voice.pending > 0 || voice.error) && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-line bg-surface-muted px-2 py-1.5">
          {voice.phase === "recording" ? (
            <>
              <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden />
              <span className="flex-1 text-xs text-ink">Listening — {voice.seconds}s</span>
              <Button variant="primary" onClick={() => void accept()}>
                Accept <kbd>↵</kbd>
              </Button>
              <IconButton label="Cancel (Esc)" onClick={() => voice.cancel()}>
                <X size={13} />
              </IconButton>
            </>
          ) : voice.error ? (
            <>
              <span className="flex-1 text-xs text-warning">{voice.error}</span>
              <Button onClick={() => void voice.start()}>Try again</Button>
            </>
          ) : (
            <>
              <Spinner size={13} />
              <span className="flex-1 text-xs text-muted">
                {voice.phase === "starting" ? "Reaching the microphone…" : `Transcribing ${voice.pending}`}
              </span>
            </>
          )}
        </div>
      )}

      <div className="grid gap-1.5 rounded-lg border border-line-strong bg-surface p-1.5">
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void ask();
            }
          }}
          placeholder="Ask about this page, or just say it…"
          aria-label="What to ask"
          className="min-h-12 w-full resize-none bg-transparent px-1 py-0.5 text-[13px] leading-[1.5] text-ink outline-0"
        />
        <div className="flex items-center gap-1">
          {/* What this turn is about, said before it is sent rather than
              guessed at afterwards. */}
          <span className="rounded-full border border-line px-1.5 text-xs text-muted">This page</span>
          <Select
            className="h-6 max-w-28 flex-1 text-xs"
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
          <span className="ml-auto flex items-center gap-1">
            <IconButton
              label="Chat with Logue · ⌘⇧K"
              disabled={voice.phase === "recording" || voice.phase === "starting"}
              onClick={() => void voice.start()}
            >
              <Mic size={14} />
            </IconButton>
            <Button variant="primary" disabled={busy || !instruction.trim()} onClick={() => void ask()}>
              {busy ? <Spinner size={13} /> : <CornerDownLeft size={13} />} Ask
            </Button>
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col">
      {/*
        Two rows, two subjects. The first belongs to Logue — the same mark and
        wordmark the app carries, and a way into it that says so in words. The
        second belongs to the page you are on. They used to share one row, so
        the only control up here read as an action on the page's title.
      */}
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
          {/*
            The page, and one way out. Chrome's own panel title bar already
            carries the product's icon and name — ours underneath made two,
            and the rule has always been that the identity appears once.
          */}
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{page?.title || "This page"}</span>
          <a
            href={server}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-control shrink-0 items-center gap-1 rounded-md border border-line px-1.5 text-xs text-muted hover:bg-surface-muted hover:text-ink"
          >
            <ExternalLink size={12} /> Open Logue web app
          </a>
          {/* The address itself, one click away rather than in a menu: when
              Logue is not answering, this is the only control on screen that
              can be the reason. */}
          <IconButton
            label={changingServer ? "Close server address" : `Logue server: ${server}`}
            onClick={() => setChangingServer((was) => !was)}
          >
            <Settings2 size={13} />
          </IconButton>
        </div>
        {(changingServer || unreachable) && (
          <WhereLogueIs server={server} onConnected={() => setChangingServer(false)} />
        )}
      </header>

      <h1 className="sr-only">{tab === "chat" ? "Chat with Logue" : tab === "page" ? "What is kept from this page" : "This Project"}</h1>
      <div role="tablist" aria-label="Panel sections" className="flex shrink-0 gap-0.5 border-b border-line bg-surface px-1.5">
        {([
          ["chat", "Chat", undefined],
          ["page", "This page", fromPage.length + said.length],
          ["project", "Project", undefined],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs",
              tab === key ? "border-accent font-[560] text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
            {count ? (
              <span className="rounded-full bg-surface-muted px-1.5 text-xs text-muted">{count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <>
          {/* Anything the person must see stays at the top, above the
              conversation: an error pushed to the bottom by `justify-end`
              ends up whispering next to the composer. */}
          {(error || waiting.length > 0) && (
            <div className="grid shrink-0 gap-2 px-2 pt-2">
              {error && <ErrorNote>{error}</ErrorNote>}
              <WaitingRecordings items={waiting} onChanged={readWaiting} />
            </div>
          )}
          <div
            className={cn(
              "logue-scroll flex flex-1 flex-col gap-2 p-2",
              thread.length > 0 ? "justify-end" : "justify-center",
            )}
          >
            {!modelReady && !error && (
              // The one thing that makes every other control in here do nothing.
              <a
                href={`${server}/settings`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2 py-1.5 text-xs text-warning hover:text-ink"
              >
                <Settings2 size={12} />
                The model is not connected. Open Settings.
              </a>
            )}
            <Thread
              messages={thread}
              busy={busy}
              onError={setError}
              onAccept={(message) => void carryOut(message)}
              onDiscard={leaveIt}
              onClear={() => {
                // This page's conversation, not every page's.
                setThread([]);
                if (pageUrl) void clearThread(pageUrl);
              }}
            />
            {thread.length === 0 && (
              // Said once. The composer's placeholder says the other half —
              // two near-identical sentences, one above the other, was the
              // whole of what this space offered.
              <NothingYet>Nothing said yet. ⌘⇧K starts a conversation from anywhere.</NothingYet>
            )}
          </div>
          {composer}
        </>
      ) : tab === "page" ? (
        <div className="logue-scroll flex-1 p-2">
          {error && <ErrorNote className="mb-2">{error}</ErrorNote>}
          <WaitingRecordings items={waiting} onChanged={readWaiting} />
          <div className="mt-2 mb-2 flex">
            <Button onClick={() => void capture()} disabled={busy}>
              <Bookmark size={13} /> Save this page
            </Button>
          </div>
          {/* One list, newest first. Splitting it into "from the page" and
              "what you added" made two headings for one question — what is
              here — and buried the newest thing under whichever half it fell
              into. Each row still says which it is. */}
          <Kept
            title="Kept from this page"
            items={[...fromPage, ...said].toSorted((a, b) => (a.created_at < b.created_at ? 1 : -1))}
            context={context}
            server={server}
            tabId={page?.id}
            onChanged={load}
            empty="Nothing kept from this page yet."
          />
        </div>
      ) : (
        <div className="logue-scroll flex-1 p-2">
          {error && <ErrorNote className="mb-2">{error}</ErrorNote>}
          <div className="mb-2">
            <Select
              className="w-full"
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
          </div>
          {project ? (
            <AboutProject project={project} context={context} onError={setError} />
          ) : (
            <NothingYet>Choose a Project to see and edit what Logue knows about it.</NothingYet>
          )}
        </div>
      )}
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
  server,
  tabId,
  onChanged,
  empty,
}: {
  title: string;
  items: Material[];
  context?: Context;
  /** The Logue these were kept in: what plays a recording, and what a link opens. */
  server: string;
  /** The page these were kept from, so a row can ask it where the passage is. */
  tabId?: number;
  onChanged: () => Promise<void> | void;
  empty: string;
}) {
  const [openId, setOpenId] = useState<string>();
  /** Which row was just copied, so the button can say so for a moment. */
  const [copied, setCopied] = useState<string>();

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
      <h2 className="flex items-center gap-1.5 text-xs font-[560] text-muted">
        {title}
        <span className="text-muted">{items.length}</span>
      </h2>
      {(
        <div className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <div key={item.id} className="py-1.5">
              <button
                type="button"
                className="-my-1 block w-full py-1 text-left"
                onClick={() => setOpenId(openId === item.id ? undefined : item.id)}
              >
                {/* The domain used to be printed here, on every row, in a
                    list that is about one page — the same thing said fourteen
                    times. This line carries the recording instead, which is
                    what it was asked to carry. */}
                <span className="flex items-center gap-2 text-xs text-muted">
                  <OriginMark origin={originOf(item.kind)} detail={timeAgo(item.created_at)} />
                </span>
              </button>
              <div className="mt-0.5 flex items-center gap-1">
                {item.capture_id ? (
                  <Recording src={audioUrl(server, item.capture_id)} seconds={item.capture_seconds} className="flex-1" />
                ) : (
                  <span className="flex-1" />
                )}
                {/* This one opens the Source in Logue — the row itself, with
                    its lineage and everything made from it. Where it came
                    from on the web is already one tap away inside that page,
                    and a panel about this page has little to say by sending
                    you back to this page. */}
                <IconButton
                  label="Open this in Logue"
                  onClick={() => window.open(`${server}/stream/${item.id}`, "_blank", "noreferrer")}
                >
                  <ExternalLink size={13} />
                </IconButton>
                <IconButton
                  label={copied === item.id ? "Copied" : "Copy, with the passage it is about"}
                  onClick={() => void copyWithQuote(item).then(() => {
                    setCopied(item.id);
                    window.setTimeout(() => setCopied(undefined), 1500);
                  })}
                >
                  {copied === item.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </IconButton>
              </div>
              {/* The words themselves, under the line that describes them. Moving
                  the recording up here took this with it once — a row in a list of
                  kept things has to show the thing. */}
              <button
                type="button"
                className="-my-1 mt-0.5 block w-full py-1 text-left"
                onClick={() => setOpenId(openId === item.id ? undefined : item.id)}
              >
                <p className="line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
              </button>
              {openId === item.id && <Filing material={item} context={context} tabId={tabId} onChanged={onChanged} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Getting back to where a saved passage was (P6).
 *
 * Everything else in this panel is about what you kept. This is the one thing
 * that was missing entirely: a way back to *where* you kept it from. A quote
 * saved from a long page is a needle you have no way of finding again — the
 * URL takes you to the top of the article and no further.
 *
 * Four states, and they are all real outcomes rather than decorations:
 * anchored (nothing said, it just works), the page has changed, re-anchored,
 * and snapshot only. The last one is not a failure — the words are in the
 * Source either way, and saying so plainly is better than an entry that keeps
 * offering a button that cannot work.
 */
function OnThePage({
  material,
  tabId,
  onChanged,
}: {
  material: Material;
  tabId?: number;
  onChanged: () => Promise<void> | void;
}) {
  const anchor = material.anchor;
  const [state, setState] = useState<"ready" | "looking" | "gone" | "found">("ready");
  const [busy, setBusy] = useState(false);
  if (!anchor?.exact) return null;

  const ask = async <T,>(message: unknown): Promise<T | undefined> => {
    if (tabId === undefined) return undefined;
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return (await chrome.tabs.sendMessage(tabId, message)) as T;
    } catch {
      // No content script on this tab — a restricted page, or one loaded
      // before the extension was. Nothing to say beyond "not found".
      return undefined;
    }
  };

  const find = async () => {
    setState("looking");
    const reply = await ask<{ found: boolean }>({ type: "logue:locate", anchor });
    setState(reply?.found ? "found" : "gone");
    if (reply?.found) window.setTimeout(() => setState("ready"), 2000);
  };

  const repair = async () => {
    const reply = await ask<{ anchor?: unknown; text?: string }>({ type: "logue:anchor-here" });
    if (!reply?.anchor) {
      // Nothing selected. Say what to do rather than failing quietly.
      setState("gone");
      return;
    }
    setBusy(true);
    try {
      await host.reanchor(material.id, { ...reply.anchor, reanchored_at: new Date().toISOString() });
      await onChanged();
      setState("ready");
    } finally {
      setBusy(false);
    }
  };

  const keepSnapshot = async () => {
    setBusy(true);
    try {
      await host.reanchor(material.id, { ...anchor, snapshot_only: true });
      await onChanged();
      setState("ready");
    } finally {
      setBusy(false);
    }
  };

  if (anchor.snapshot_only) {
    return (
      <p className="text-xs text-muted">
        The page moved on — this is the snapshot Logue kept.
      </p>
    );
  }

  return (
    <div className="grid gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="ghost" disabled={busy || state === "looking"} onClick={() => void find()}>
          {state === "looking" ? <Spinner size={12} /> : <Crosshair size={13} />}
          Find it on the page
        </Button>
        {state === "found" && <span className="text-success">Found it</span>}
        {anchor.reanchored_at && state !== "gone" && <span className="text-muted">Re-anchored</span>}
      </div>
      {state === "gone" && (
        <div className="grid gap-1 rounded-md bg-surface p-1.5">
          <p className="text-muted">
            It is not on this page any more. Select the passage where it lives now, then point this at it.
          </p>
          <div className="flex flex-wrap gap-1">
            <Button variant="primary" disabled={busy} onClick={() => void repair()}>
              Point it at what I selected
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void keepSnapshot()}>
              Keep the snapshot
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The words, editable where they are.
 *
 * Everything a recording becomes stands on this text, and until now the panel
 * could only show it: a name heard wrong had to be carried to the Web App to
 * be fixed, from a panel that is open on the very page it came from. Nothing
 * about that trip made the correction better. This is D2.
 *
 * Saved on leaving the box, so there is no button to find and nothing to
 * forget to press. Escape puts it back the way it was, which is the only way
 * out of a change someone has started and does not want.
 */
function Words({
  material,
  busy,
  onSave,
}: {
  material: Material;
  busy: boolean;
  onSave: (content: string) => void;
}) {
  const [draft, setDraft] = useState(material.content);
  const [saved, setSaved] = useState(false);

  const keep = () => {
    const next = draft.trim();
    // An empty box is a slip, not an instruction: a Source with no words is
    // one that everything derived from it now points at for nothing.
    if (!next || next === material.content) return;
    onSave(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="grid gap-1">
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <span>What it says</span>
        {saved && (
          <span className="flex items-center gap-1 text-success">
            <Check size={12} /> Saved
          </span>
        )}
        <Textarea
          rows={3}
          value={draft}
          disabled={busy}
          className="mt-0.5 text-xs leading-[1.45]"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={keep}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(material.content);
              event.currentTarget.blur();
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.blur();
          }}
        />
      </label>
    </div>
  );
}

/** Where a Source belongs, what it is about, and what it actually says. */
function Filing({
  material,
  context,
  tabId,
  onChanged,
}: {
  material: Material;
  context?: Context;
  tabId?: number;
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
      <Words material={material} busy={busy} onSave={(content) => run(host.editMaterial(material.id, content))} />
      <OnThePage material={material} tabId={tabId} onChanged={onChanged} />
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
