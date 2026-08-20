import { Download, ExternalLink, MoreHorizontal, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  Empty,
  ErrorNote,
  IconButton,
  Input,
  Keys,
  Menu,
  MenuItem,
  Notice,
  Recording,
  Spinner,
} from "@logue/ui";
import { audioUrl, host, HostError, type Context, type Material } from "./api";
import { entriesOf, merge } from "./entries";
import { send, tagOf } from "./messages";
import { readablePageText } from "./readable";
import { currentServer, DEFAULT_SERVER, readAddress, rememberServer, whenServerChanges } from "./server";
import { Composer, type ComposerHandle, type Quote } from "./panel/Composer";
import { EntryRow } from "./panel/Entry";
import { useEntries } from "./useEntries";
import { held, type Held } from "./unfinished";
import { useWatermark } from "./sync";
import { useVoice } from "./useVoice";

/**
 * The panel: one list, one composer.
 *
 * His instruction of 2026-08-13, and his ruling on the three questions it
 * raised: **sending keeps** (asking is a Skill you run on something kept),
 * **"into a Document" stays** as a chip on the composer's own row, and
 * **saving the page keeps a button** — the bookmark beside the microphone.
 *
 * What that removed: three verbs across the top, a second recorder, an ask
 * box that opened under the buttons, four separate lists, and the hidden
 * state that remembered which of the two boxes a recording was for.
 */

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
      setFailed(reply?.message ?? "Logue did not answer. Try again.");
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
          {note || "Where Logue is running."}
        </p>
      )}
    </div>
  );
}

/**
 * A recording still in this browser, because Logue was not running.
 *
 * An entry like any other — it happened, it is on the list at the time it
 * happened — with the three things that can be done to something stuck here:
 * try it now, take the audio away, or throw it out.
 */
function WaitingRow({ one, onChanged }: { one: Waiting; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const failed = (one.tries ?? 0) > 0;
  /**
   * The audio, playable where it is.
   *
   * This row reported a recording it would not let anyone hear — the row
   * beside it, for a recording the Host is holding, has always had the
   * player. Two rows about the same trouble looked like two products, and
   * "your words are safe" is easier to believe when you can press play.
   * Held as a blob because the bytes are here, not on the Host yet.
   */
  const audio = useMemo(() => {
    try {
      const bytes = Uint8Array.from(atob(one.audio), (c) => c.charCodeAt(0));
      return URL.createObjectURL(new Blob([bytes], { type: one.mediaType }));
    } catch {
      return undefined;
    }
  }, [one.audio, one.mediaType]);
  useEffect(() => () => (audio ? URL.revokeObjectURL(audio) : undefined), [audio]);

  return (
    <article className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 border-b border-line px-3 py-2.5">
      <span className="flex size-6 items-center justify-center rounded-[7px] bg-act-voiced-soft text-act-voiced">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="9" y="3" width="6" height="9.5" rx="3" />
          <path d="M6.5 9.5a5.5 5.5 0 0 0 11 0" strokeLinecap="round" />
          <path d="M6 17.5h12M8.5 20.5h7" strokeLinecap="round" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] font-[600] text-muted">Waiting for Logue</span>
          <span className="ml-auto text-[10.5px] tabular-nums text-muted">
            {new Date(one.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        </div>
        {audio && (
          <div className="mt-1.5">
            <Recording src={audio} seconds={one.seconds} shape={one.id} />
          </div>
        )}
        <Notice tone={failed ? "danger" : "warning"} className="mt-1.5">
          {failed
            ? `Tried ${one.tries}×. The recording is kept here.`
            : "Kept here. It will be transcribed when Logue starts."}
        </Notice>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void chrome.runtime
                .sendMessage({ type: "logue:pending-send" })
                .catch(() => undefined)
                .then(() =>
                  setTimeout(() => {
                    setBusy(false);
                    onChanged();
                  }, 1200),
                );
            }}
          >
            {busy ? <Spinner size={11} /> : null} Try again
          </Button>
          {/* Taking the audio away and throwing it away are not the ordinary
              thing to do to a recording, and one of them cannot be undone. */}
          <Menu
            label="More"
            align="end"
            trigger={(props) => (
              <IconButton label="More" {...props}>
                <MoreHorizontal size={14} />
              </IconButton>
            )}
          >
            <MenuItem icon={<Download size={12} />} onClick={() => download(one)}>
              Export audio
            </MenuItem>
            <MenuItem icon={<Trash2 size={12} />} onClick={() => setDropping(true)}>
              Delete recording…
            </MenuItem>
          </Menu>
        </div>
        <Dialog open={dropping} onClose={() => setDropping(false)} title="Delete this recording?">
          <p className="text-[13px] text-ink-soft">
            The audio is only in this browser. Deleting it cannot be undone.
          </p>
          <div className="mt-3 flex justify-end gap-1.5">
            <Button onClick={() => setDropping(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                setDropping(false);
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
        </Dialog>
      </div>
    </article>
  );
}

/** A recording the Host is holding that never became words. */
function HeldRow({ one, server, onChanged }: { one: Held; server: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <article className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 border-b border-line px-3 py-2.5">
      <span className="flex size-6 items-center justify-center rounded-[7px] bg-act-voiced-soft text-act-voiced">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="9" y="3" width="6" height="9.5" rx="3" />
          <path d="M6.5 9.5a5.5 5.5 0 0 0 11 0" strokeLinecap="round" />
          <path d="M6 17.5h12M8.5 20.5h7" strokeLinecap="round" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] font-[600] text-act-voiced">Dictated</span>
          <span className="ml-auto text-[10.5px] tabular-nums text-muted">
            {new Date(one.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        </div>
        <div className="mt-1.5">
          <Recording src={audioUrl(server, one.captureId)} seconds={one.seconds} shape={one.captureId} />
        </div>
        {/* What the model said, when it said anything: "the words did not
            come back" alone reads as Logue losing them, and three recordings
            said that on an evening the model was answering 503. */}
        <Notice className="mt-1.5">
          {one.message || "Not transcribed. The recording is kept."}
        </Notice>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void host
                .transcribeKept(one.captureId, {})
                .then((said) =>
                  said.text.trim()
                    ? host.saveVoice({
                        capture_id: one.captureId,
                        text: said.text,
                        applied_context: said.applied_context,
                      })
                    : undefined,
                )
                .catch(() => undefined)
                .then(() => {
                  setBusy(false);
                  onChanged();
                });
            }}
          >
            {busy ? <Spinner size={11} /> : null} Try again
          </Button>
          <a
            href={audioUrl(server, one.captureId)}
            download
            className="inline-flex h-control shrink-0 items-center gap-1 rounded-md border border-control-line bg-surface px-2 text-xs font-[560] text-ink-soft hover:bg-surface-muted hover:text-ink"
          >
            <Download size={12} /> Export audio
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * The page this panel is about.
 *
 * A side panel is not a tab, so the active tab is the page beside it — except
 * when the panel is opened as an ordinary tab, which is how it is checked in a
 * browser under automation and how someone lands on it from a bookmark. There
 * it would be the active tab itself: the panel would report its own address as
 * the page, quote nothing, and file everything against a `chrome-extension://`
 * URL. The panel is never the page it is about.
 */
async function whichPage() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active && !active.url?.startsWith(`chrome-extension://${chrome.runtime.id}`)) return active;
  const others = await chrome.tabs.query({ currentWindow: true });
  return others.findLast((one) => !one.url?.startsWith("chrome-extension://"));
}

export function Panel() {
  const [page, setPage] = useState<{ id?: number; url: string; title: string }>();
  const [context, setContext] = useState<Context>();
  const [saved, setSaved] = useState<Material[]>([]);
  const [documents, setDocuments] = useState<{ id: string; title: string }[]>([]);
  const [project, setProject] = useState("");
  const [into, setInto] = useState<{ id: string; title: string }>();
  const [quote, setQuote] = useState<Quote>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(true);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [stuck, setStuck] = useState<Held[]>([]);
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [changingServer, setChangingServer] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const composer = useRef<ComposerHandle>(null);
  const voice = useVoice();
  /** Read inside listeners that were made before this recording started. */
  const recording = useRef(false);
  recording.current = voice.phase === "recording" || voice.phase === "starting";
  const entries = useEntries(voice);
  /** The workspace moving, from anywhere — see `sync.ts`. */
  const written = useWatermark();

  // Read before anything is asked of the Host, and followed afterwards: the
  // address can be changed from another panel, and a panel still calling the
  // previous one would report it as down.
  useEffect(() => {
    void currentServer().then(setServer);
    return whenServerChanges(setServer);
  }, []);

  const load = useCallback(async () => {
    const active = await whichPage();
    const url = active?.url ?? "";
    setPage({ id: active?.id, url, title: active?.title ?? "" });
    try {
      const [ctx, onPage, status, docs] = await Promise.all([
        host.context(project),
        url ? host.pageMaterials(url) : { materials: [] },
        host.status(),
        host.documents(),
      ]);
      setContext(ctx);
      setSaved(onPage.materials);
      setDocuments(docs.documents.slice(0, 20));
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
    // it. `written` is the workspace moving: a Project made in the app, a
    // Source saved from another tab.
  }, [load, server, written]);

  /**
   * What is selected on the page, as the page sees it.
   *
   * Pushed by the content script rather than fetched when a button is
   * pressed, because only the page can make an anchor and only while the
   * selection exists. Without it a comment on a passage can never be found
   * on that page again.
   */
  useEffect(() => {
    const onMessage = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (tagOf(message) !== "logue:selection") return;
      // Only the tab this panel is about. Another tab's selection arriving
      // here would quote a passage from a page nobody is looking at.
      if (page?.id !== undefined && sender.tab?.id !== page.id) return;
      // Narrowed by reading, not by asserting: the message channel is shared
      // ground, and only the shape we declared counts as a selection.
      if (typeof message !== "object" || message === null || !("text" in message)) return;
      const text = typeof message.text === "string" ? message.text : "";
      const anchor = "anchor" in message ? message.anchor : undefined;
      // A new selection replaces the quote; an empty one does not remove it.
      // Clicking back on the page to keep reading collapses the highlight, and
      // a quote that vanished then took the anchor with it — the comment was
      // saved against nothing, which is the one thing this channel exists to
      // prevent. It goes when the person drops it, or when it is sent.
      if (text) setQuote({ text, anchor });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [page?.id]);

  /**
   * A quote belongs to the page it was taken from.
   *
   * The panel follows whichever tab is in front, but the passage above the
   * box did not: move to another tab and the quote from the last one was
   * still sitting there, and what you wrote next was filed against this page
   * with that page's words above it.
   */
  useEffect(() => {
    setQuote(undefined);
  }, [page?.id]);

  // Chosen once, kept — including across the panel being closed, which is the
  // common way a side panel ends.
  useEffect(() => {
    void chrome.storage.local.get("logue:dictation-into").then((stored) => {
      const kept: unknown = stored["logue:dictation-into"];
      if (kept && typeof kept === "object" && "id" in kept && "title" in kept) {
        setInto({ id: String(kept.id), title: String(kept.title) });
      }
    });
  }, []);

  const readWaiting = useCallback(() => {
    void chrome.storage.local.get(PENDING_KEY).then((stored) => {
      const found: unknown = stored[PENDING_KEY];
      setWaiting(Array.isArray(found) ? found.filter(isWaiting) : []);
    });
    // And the other half: what the Host is holding with no words. The Host is
    // the record of that — nothing here keeps a second copy to disagree with.
    void held()
      .then(setStuck)
      .catch(() => setStuck([]));
  }, []);

  useEffect(() => {
    readWaiting();
    const onStorage = (changes: Record<string, unknown>) => {
      if (PENDING_KEY in changes) readWaiting();
    };
    chrome.storage.local.onChanged.addListener(onStorage);
    return () => chrome.storage.local.onChanged.removeListener(onStorage);
  }, [readWaiting, written]);

  /** The page's own words, which travel with anything said about it. */
  const pageText = useCallback(async () => {
    if (page?.id === undefined) return "";
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: page.id }, func: readablePageText });
      return typeof result?.result === "string" ? result.result : "";
    } catch {
      // A restricted page cannot be read; everything else still works.
      return "";
    }
  }, [page?.id]);

  const sending = useCallback(
    async () => ({
      project,
      page: { url: page?.url, title: page?.title },
      quote: quote ? { text: quote.text, anchor: quote.anchor } : undefined,
      into,
      nearby: [page?.title, await pageText()].filter(Boolean).join("\n\n"),
    }),
    [project, page?.url, page?.title, quote, into, pageText],
  );

  /**
   * The recording the words in the box came out of, waiting to be kept.
   *
   * Voice fills the box and does not send, so the audio sits on the Host
   * until the person decides. When they do, the Source carries it — what was
   * said can be played back beside what it became.
   */
  const spoken = useRef<string>(undefined);

  /** Send: keep what is in the box, with whatever is quoted above it. */
  const submit = useCallback(
    async (text: string) => {
      setBusy(true);
      const options = await sending();
      const kept = await entries.submit(text, { ...options, captureId: spoken.current });
      setBusy(false);
      // Only what was kept is cleared away. A send that failed leaves the
      // words in the box and the passage above it, because there is nowhere
      // else for either of them to be.
      if (!kept) return false;
      spoken.current = undefined;
      setQuote(undefined);
      return true;
    },
    [entries, sending],
  );

  /** Stop the recording, put the words in the box, and leave them there. */
  const insert = useCallback(async () => {
    const heard = await entries.hear(await sending());
    if (!heard) return;
    composer.current?.insert(heard.text);
    spoken.current = heard.captureId;
  }, [entries, sending]);

  /** Insert and send, in one act — ⌘↵, or the arrow on the recorder. */
  const insertAndSend = useCallback(async () => {
    const heard = await entries.hear(await sending());
    // Nothing heard: the box keeps whatever was already in it, and the entry
    // that failed carries the recording.
    if (!heard) return false;
    const typed = composer.current?.text() ?? "";
    spoken.current = heard.captureId;
    const kept = await submit([typed, heard.text].filter(Boolean).join(typed && !/\s$/.test(typed) ? " " : ""));
    // Kept: the box is empty. Not kept: the words the microphone heard are put
    // in it, so nothing said is only in a failed row.
    if (kept) composer.current?.clear();
    else composer.current?.insert(heard.text);
    return kept;
  }, [entries, sending, submit]);

  const keepPage = useCallback(async () => {
    setBusy(true);
    const options = await sending();
    await entries.keepPage(await pageText(), options);
    setBusy(false);
  }, [entries, sending, pageText]);

  // ⌘⇧K: the panel opens and starts listening in the same act. The flag is
  // consumed on read so re-opening the panel later does not start a recording
  // nobody asked for.
  const listen = voice.start;
  useEffect(() => {
    const begin = () => {
      void chrome.storage.local.get(LISTEN).then((stored) => {
        if (!stored[LISTEN]) return;
        void chrome.storage.local.remove(LISTEN);
        // Already listening: pressing the shortcut again — because the panel
        // did not look focused — used to start a second recording, and
        // starting one cancels the one running. Nobody chose to throw that
        // away.
        if (recording.current) return;
        void listen();
      });
    };
    begin();
    const onMessage = (message: unknown) => {
      if (tagOf(message) === "logue:listen") begin();
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [listen]);

  // What the Host holds changes when a recording of ours fails, and nothing
  // else would say so until the panel was opened again.
  const finished = entries.items.filter((one) => one.state !== "working").length;
  useEffect(() => {
    if (finished > 0) readWaiting();
  }, [finished, readWaiting]);

  /**
   * The one list: what this session did, then what the Host holds for this
   * page, then what has not become words yet — all in the order it happened.
   */
  const shown = useMemo(() => merge(entries.items, entriesOf(saved)), [entries.items, saved]);
  const mine = new Set(entries.items.map((one) => one.captureId).filter(Boolean));
  const elsewhere = stuck.filter((one) => !mine.has(one.captureId));

  /**
   * All three kinds of row, in the order they happened.
   *
   * They used to be three blocks stacked above each other, so yesterday's
   * unfinished recording sat permanently above everything written today. A
   * recording waiting for Logue is a thing that happened at a time, like the
   * rest of the list.
   */
  const rows = useMemo(() => {
    const all = [
      ...shown.map((one) => ({ what: "entry" as const, key: one.id, at: one.at, one })),
      ...waiting.map((one) => ({ what: "waiting" as const, key: one.id, at: one.at, one })),
      ...elsewhere.map((one) => ({ what: "held" as const, key: one.captureId, at: one.createdAt, one })),
    ];
    return all.toSorted((a, b) => (a.at < b.at ? 1 : -1));
    // `elsewhere` is derived from `stuck` on every render; its identity is not
    // the thing that changed when it did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, waiting, stuck]);

  const empty = rows.length === 0;

  return (
    <div className="flex h-screen flex-col bg-panel">
      <header className="shrink-0 border-b border-line bg-panel">
        <div className="flex min-w-0 items-center gap-2 px-2.5 py-1.5">
          <Mark />
          <span className="shrink-0 text-[12.5px] font-[650] text-ink">Logue</span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted" title={page?.title}>
            {page?.title || "This page"}
          </span>
          <Menu
            label="Panel menu"
            align="end"
            trigger={(props) => (
              <IconButton label="More" {...props}>
                <MoreHorizontal size={14} />
              </IconButton>
            )}
          >
            <MenuItem icon={<ExternalLink size={12} />} onClick={() => window.open(server, "_blank", "noreferrer")}>
              Open Logue
            </MenuItem>
            <MenuItem onClick={() => setShortcuts(true)}>
              <Keys>⌘⇧K</Keys> Keyboard shortcuts
            </MenuItem>
            <MenuItem icon={<Settings2 size={12} />} onClick={() => setChangingServer((was) => !was)}>
              Server address…
            </MenuItem>
          </Menu>
        </div>
        {changingServer && <WhereLogueIs server={server} onConnected={() => setChangingServer(false)} />}
      </header>

      <h1 className="sr-only">Logue</h1>

      {/* Everything that stands between the person and using the panel, above
          the list rather than inside it. */}
      {(error || !modelReady) && (
        <div className="grid shrink-0 gap-1.5 border-b border-line bg-surface px-2 py-2">
          {/* Logue not running is not an error the person made, and nothing is
              lost when it happens — the recordings stay in this browser until
              it is back. A red box with the fetch's own words said neither. */}
          {error && (
            <Notice tone={unreachable ? "warning" : "danger"}>
              {unreachable ? "Logue is not running. Recordings are kept here." : error}
            </Notice>
          )}
          {!modelReady && !error && (
            <a
              href={`${server}/settings`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2 py-1.5 text-xs text-warning hover:text-ink"
            >
              <Settings2 size={12} />
              No model connected. Open Settings.
            </a>
          )}
        </div>
      )}

      <div className="logue-scroll min-h-0 flex-1 bg-surface">
        {empty ? (
          <Empty>
            <b className="font-[600] text-ink-soft">Nothing said about this page yet.</b>
            {/* The bookmark that does this sits forty pixels below, in the
                composer's own row. Two controls for one act, and the empty
                state was the one that had to go. */}
            <span className="mt-1 block">Select a passage, or type below.</span>
          </Empty>
        ) : (
          <>
            {rows.map((row) =>
              row.what === "waiting" ? (
                <WaitingRow key={row.key} one={row.one} onChanged={readWaiting} />
              ) : row.what === "held" ? (
                <HeldRow key={row.key} one={row.one} server={server} onChanged={readWaiting} />
              ) : (
                <EntryRow
                  key={row.key}
                  entry={row.one}
                  server={server}
                  skills={context?.skills}
                  onApply={(takeId, skill) =>
                    void entries.apply(row.one.id, takeId, skill, {
                      project,
                      page: { url: page?.url, title: page?.title },
                    })
                  }
                  onRetry={() =>
                    void entries
                      .again(row.one.id, { project, page: { url: page?.url, title: page?.title } })
                      .then((words) => {
                        if (words) composer.current?.insert(words);
                      })
                  }
                  onAsk={() => {
                    void pageText().then((text) =>
                      entries.ask(row.one.id, {
                        project,
                        page: { url: page?.url, title: page?.title },
                        pageText: text,
                      }),
                    );
                  }}
                  onAccept={() => void entries.carryOut(row.one.id, { url: page?.url, title: page?.title })}
                  onLeave={() => entries.leaveIt(row.one.id)}
                />
              ),
            )}
          </>
        )}
      </div>

      <Composer
        handle={composer}
        quote={quote}
        source={[page?.title, domainOf(page?.url)].filter(Boolean).join(" · ")}
        onDropQuote={() => setQuote(undefined)}
        project={project}
        projects={context?.projects ?? []}
        onProject={setProject}
        into={into}
        documents={documents}
        onInto={(next) => {
          setInto(next);
          void chrome.storage.local.set({ "logue:dictation-into": next ?? null });
        }}
        phase={voice.phase}
        seconds={voice.seconds}
        busy={busy}
        onRecord={() => void voice.start()}
        onDiscard={() => voice.cancel()}
        onInsert={() => void insert()}
        onSend={() =>
          voice.phase === "recording" || voice.phase === "starting"
            ? insertAndSend()
            : submit(composer.current?.text() ?? "")
        }
        onKeepPage={() => void keepPage()}
        notice={
          voice.error ? (
            <Notice
              tone="warning"
              className="mt-1.5"
              action={
                voice.needsMicrophone ? (
                  <Button onClick={() => void send({ type: "logue:open-microphone-settings" })}>
                    Open Chrome settings
                  </Button>
                ) : undefined
              }
            >
              {voice.error}
            </Notice>
          ) : voice.pending > 0 ? (
            <Notice tone="quiet" className="mt-1.5">
              <span className="flex items-center gap-2">
                <Spinner size={12} /> {voice.pending} still transcribing
              </span>
            </Notice>
          ) : undefined
        }
      />

      <Dialog open={shortcuts} onClose={() => setShortcuts(false)} title="Keyboard shortcuts">
        <div className="grid gap-1.5 text-[13px]">
          {[
            ["⌘⇧K", "Open this panel and start talking"],
            ["↵", "Send"],
            ["⇧↵", "New line"],
            ["esc", "Drop the quote"],
            ["↵", "While recording: insert"],
            ["⌘↵", "While recording: insert and send"],
            ["esc", "While recording: discard"],
          ].map(([key, what]) => (
            <p key={`${key}${what}`} className="flex items-baseline gap-3">
              <span className="w-14 shrink-0">
                <Keys>{key}</Keys>
              </span>
              <span className="text-ink-soft">{what}</span>
            </p>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

/** The host name a quote came from, when the address is one. */
function domainOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Written by ⌘⇧K before the panel opens; read here on arrival. */
const LISTEN = "logue:listen-at";

/** Logue's own mark, so the panel says whose it is. */
function Mark() {
  return (
    <span
      aria-hidden
      className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-accent text-white"
    >
      <svg viewBox="0 0 24 24" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="2.1">
        <rect x="9.5" y="3.5" width="5" height="9" rx="2.5" />
        <path d="M6.5 10a5.5 5.5 0 0 0 11 0" strokeLinecap="round" />
        <path d="M12 15.5V20" strokeLinecap="round" />
      </svg>
    </span>
  );
}
