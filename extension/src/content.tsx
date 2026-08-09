import { StrictMode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { host, type Context, type Material } from "./api";
import { caretRect } from "./caret";
import * as googleDocs from "./googleDocs";
import { readablePageText } from "./readable";
import { activeEditable, insertAtCaret, isOurs, nearbyText, pageSelection, pageSource, readCaret, restoreCaret, type CaretPosition, type Editable, type SelectionSnapshot } from "./editable";
import { isFromBackground, send, watchForOrphaning, whenOrphaned } from "./messages";
import { aboveSelection, besideCaret, BAR } from "./position";
import { NO_OVERRIDES, type VoiceOverrides } from "./overrides";
import { useVoice } from "./useVoice";
import { visibleSurface } from "./visible";
import { CommandBox } from "./surfaces/CommandBox";
import { SelectionBar, type SelectionPhase } from "./surfaces/SelectionBar";
import { VoiceBar } from "./surfaces/VoiceBar";
import styles from "./surface.css?inline";

const COMMAND = { width: 360, height: 190 };
const SELECTION = { width: 220, height: 32 };

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Collapses a burst of events into one call on the next frame.
 *
 * A hidden tab never paints, so requestAnimationFrame never fires there —
 * relying on it alone means the surfaces stay frozen until the tab is looked
 * at, which is wrong for a background tab the user is about to switch to.
 */
function coalesce(run: () => void) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    const go = () => {
      queued = false;
      run();
    };
    if (document.visibilityState === "hidden") setTimeout(go, 0);
    else requestAnimationFrame(go);
  };
}

/**
 * Records what the tracker last saw on the host element. A surface that fails to
 * appear is otherwise silent, and the page cannot read a content script's
 * variables — this attribute is the one thing a test or a bug report can look at.
 */
function recordTarget(state: string) {
  const element = document.getElementById("logue-host");
  if (element) element.dataset.logueTarget = state;
}

/**
 * One way to keep a quote, so every path stores the same evidence — the passage
 * included. Three copies of this had drifted apart.
 */
async function keepSelection(snapshot: SelectionSnapshot, into: string) {
  const { material } = await host.saveMaterial({
    kind: "selection",
    content: snapshot.text,
    context: snapshot.context,
    source: pageSource(),
    projects: into ? [into] : [],
  });
  return material;
}

function Surfaces() {
  const [context, setContext] = useState<Context>();
  const [overrides, setOverrides] = useState<VoiceOverrides>(NO_OVERRIDES);

  // -- the caret-following bar -------------------------------------------
  const target = useRef<Editable | null>(null);
  /** The editor and caret the transcript belongs to, held across a focus change. */
  const destination = useRef<{ editor: Editable; caret: CaretPosition | undefined } | null>(null);
  const [caret, setCaret] = useState<{ left: number; top: number; bottom: number }>();
  const [moved, setMoved] = useState<{ left: number; top: number }>();

  // -- what each surface is doing ----------------------------------------
  const voice = useVoice();
  // Where the candidate belongs, frozen when it arrives. Focus often moves the
  // moment recording stops, and a transcript that vanishes with the caret is a
  // transcript the person cannot use.
  const [inserted, setInserted] = useState<{ undo: () => void }>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [command, setCommand] = useState<{
    busy: boolean;
    answer?: string;
    sources: Material[];
    error?: string;
    runId?: string;
  }>({ busy: false, sources: [] });
  const [selection, setSelection] = useState<SelectionSnapshot>();
  const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>("idle");
  const [selectionError, setSelectionError] = useState<string>();
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");
  const selectionVoice = useVoice();

  const project = overrides.project ?? context?.voice_profile.project_name ?? "";

  const [hostError, setHostError] = useState<string>();

  useEffect(() => {
    void host.context(project).then(
      (loaded) => {
        setContext(loaded);
        setHostError(undefined);
      },
      // Without this the bar appears with no Skills and no explanation, which
      // reads as the product being broken rather than the Host being off.
      (cause: unknown) => setHostError(cause instanceof Error ? cause.message : "Logue is not running on this Mac."),
    );
  }, [project]);

  // -- track the editor and the caret ------------------------------------
  const track = useCallback(() => {
    // Docs has no focusable editable in the top document; its own sink stands in.
    if (googleDocs.isGoogleDocs()) {
      const box = googleDocs.anchorRect();
      target.current = googleDocs.editorTarget() ?? null;
      setCaret(box ? { left: box.left + 24, top: box.top + 24, bottom: box.top + 44 } : undefined);
      return;
    }
    const editable = activeEditable();
    target.current = editable ?? null;
    if (!editable) {
      recordTarget("none");
      setCaret(undefined);
      return;
    }
    const rect = caretRect(editable);
    if (rect) {
      recordTarget(`caret ${Math.round(rect.left)},${Math.round(rect.bottom)}`);
      setCaret({ left: rect.left, top: rect.top, bottom: rect.bottom });
      return;
    }
    const box = editable.getBoundingClientRect();
    recordTarget(`field ${Math.round(box.left)},${Math.round(box.bottom)}`);
    setCaret({ left: box.left, top: box.top, bottom: box.bottom });
  }, []);

  useEffect(() => {
    const schedule = coalesce(track);
    const events = ["focusin", "focusout", "keyup", "click", "scroll", "resize", "selectionchange", "visibilitychange"];
    for (const event of events) window.addEventListener(event, schedule, true);
    schedule();
    return () => {
      for (const event of events) window.removeEventListener(event, schedule, true);
    };
  }, [track]);

  // -- track the page selection ------------------------------------------
  useEffect(() => {
    const update = () => {
      // Hold the toolbar through anything it started. Saving collapses the
      // selection on some pages, and dropping the bar there loses both the
      // spinner and the confirmation that the quote was kept.
      if (writing || selectionPhase !== "idle") return;
      const found = pageSelection();
      setSelection(found);
      if (!found) {
        setSelectionPhase("idle");
        setSelectionError(undefined);
      }
    };
    const schedule = coalesce(update);
    document.addEventListener("selectionchange", schedule, true);
    window.addEventListener("scroll", schedule, true);
    return () => {
      document.removeEventListener("selectionchange", schedule, true);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [writing, selectionPhase]);

  // -- keyboard shortcuts from the background ----------------------------
  useEffect(() => {
    const listener = (message: unknown, _sender: unknown, respond: (reply: unknown) => void) => {
      if (!isFromBackground(message)) return undefined;
      if (message.type === "logue:start-voice" && target.current) void voice.start();
      if (message.type === "logue:start-command") setCommandOpen(true);
      if (message.type === "logue:read-page") {
        // The worker cannot read a page; only something on it can. This is
        // the same text the Side Panel already saves, so a Skill run from the
        // menu stands on exactly what a capture would have.
        respond({ text: readablePageText(), title: document.title, url: location.href });
        return true;
      }
      return undefined;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [voice]);

  // -- Enter accepts, Escape cancels, while recording --------------------
  useEffect(() => {
    if (voice.phase !== "recording") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Node && isOurs(event.target)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void finishVoice();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        voice.cancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.phase]);

  const finishVoice = async () => {
    destination.current = target.current ? { editor: target.current, caret: readCaret(target.current) } : null;
    const result = await voice.stop({
      project,
      overrides,
      source: pageSource(),
      // Read before the model is asked: what is on screen right now is what
      // the person means, and they may click away while it transcribes.
      nearby: nearbyText(target.current),
    });
    if (result) {
      place(result.text);
    }
  };

  /**
   * The words failed; the recording did not. Ask again on the audio the Host
   * kept, and land the transcript where the first attempt would have.
   */
  const retryVoice = async () => {
    const result = await voice.retry({
      project,
      overrides,
      source: pageSource(),
      nearby: nearbyText(target.current),
    });
    if (result) {
      place(result.text);
    }
  };

  /**
   * Spoken words go where the caret is. No step in between.
   *
   * They used to arrive in a panel with the text in a box and an Insert button
   * under it — a second decision about something the person had already
   * decided by speaking. Getting it wrong is fixed the way any typing is
   * fixed: in the editor it landed in, which is where they are already
   * looking. Undo is still offered, on the bar that is already there.
   */
  const place = (text: string) => {
    if (googleDocs.isGoogleDocs()) {
      // Docs owns its undo stack; ours would fight it, so offer none.
      if (googleDocs.insert(text)) setInserted({ undo: () => undefined });
      return;
    }
    const held = destination.current;
    const editor = held?.editor ?? target.current;
    if (!editor) return;
    // Focus may have moved while the model was answering. Focusing an element
    // puts the caret at its start, so put the caret back too — otherwise the
    // transcript lands at the top of what the person was writing.
    restoreCaret(editor, held?.caret);
    const done = insertAtCaret(editor, text);
    if (done) setInserted(done);
  };

  const runCommand = async ({
    instruction,
    skillId,
    project: chosen,
    scope,
  }: {
    instruction: string;
    skillId: string;
    project: string;
    scope: string;
  }) => {
    setCommand({ busy: true, sources: [] });
    try {
      let sourceIds: string[] | undefined;
      if (scope === "selection" && selection) {
        sourceIds = [(await keepSelection(selection, chosen)).id];
      } else if (scope === "page") {
        const { materials } = await host.pageMaterials(location.href);
        sourceIds = materials.map((item) => item.id);
      }
      const result = await host.run({ skill_id: skillId, instruction, project: chosen, source_ids: sourceIds });
      if (result.run.status !== "complete") {
        setCommand({ busy: false, sources: [], error: result.run.error ?? "The model did not answer." });
        return;
      }
      setCommand({
        busy: false,
        answer: result.run.original_output ?? "",
        sources: result.sources,
        runId: result.run.id,
      });
    } catch (cause) {
      setCommand({ busy: false, sources: [], error: cause instanceof Error ? cause.message : "Could not run that." });
    }
  };

  const saveSelection = async (extra?: { note?: string }) => {
    if (!selection) return;
    setSelectionPhase("saving");
    setSelectionError(undefined);
    try {
      const material = await keepSelection(selection, project);
      if (extra?.note) {
        await host.saveMaterial({
          kind: "derived",
          content: extra.note,
          source: pageSource(),
          projects: project ? [project] : [],
          parent_ids: [material.id],
        });
      }
      setSelectionPhase("saved");
      setWriting(false);
      setNote("");
      window.setTimeout(() => setSelectionPhase("idle"), 1400);
    } catch (cause) {
      setSelectionPhase("idle");
      setSelectionError(cause instanceof Error ? cause.message : "Could not save.");
    }
  };

  const startSelectionVoice = async () => {
    if (!selection) return;
    setSelectionPhase("starting");
    await selectionVoice.start();
    setSelectionPhase("recording");
  };

  const finishSelectionVoice = async () => {
    if (!selection) return;
    setSelectionPhase("saving");
    setSelectionError(undefined);
    try {
      const material = await keepSelection(selection, project);
      const spoken = await selectionVoice.stop({
        project,
        overrides,
        source: pageSource(),
        parentIds: [material.id],
      });
      setSelectionPhase(spoken ? "saved" : "idle");
      if (spoken) window.setTimeout(() => setSelectionPhase("idle"), 1400);
    } catch (cause) {
      // Without this the toolbar sits on "Saving…" with no way out.
      setSelectionPhase("idle");
      setSelectionError(cause instanceof Error ? cause.message : "Could not save.");
    }
  };

  // -- placement ---------------------------------------------------------
  // "error" is deliberately not busy: it stays until the next attempt, so
  // treating it as busy would hold every other surface off the page for good.
  const voiceBusy = voice.phase !== "idle" && voice.phase !== "error";

  /**
   * An error belongs to the moment it happened.
   *
   * It used to hang on the bar until the next recording, which meant a failure
   * in one field followed you into the next one and sat there while you typed.
   * Anything that changes what the bar is about clears it: leaving the field,
   * moving the bar, choosing a different voice.
   */
  const forget = useCallback(() => {
    voice.setError(undefined);
    voice.setPhase((was) => (was === "error" ? "idle" : was));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!caret) forget();
  }, [caret, forget]);
  const barSize = voiceBusy ? BAR.busy : BAR.idle;
  const barAt = moved
    ? moved
    : caret
      ? besideCaret(caret, viewport(), barSize.width, barSize.height)
      : undefined;
  const commandAt = caret
    ? besideCaret(caret, viewport(), COMMAND.width, COMMAND.height)
    : { left: 16, top: 16 };
  const selectionAt = selection
    ? aboveSelection(selection.rect, viewport(), writing ? 320 : SELECTION.width, writing ? 140 : SELECTION.height)
    : undefined;

  // The toolbar shows the first two without opening a menu, so the Skill chosen
  // in Settings has to be one of them — otherwise choosing it changed nothing.
  const preferred = context?.defaults?.extension;
  const selectionSkills = (context?.skills ?? [])
    .filter((skill) => skill.enabled && skill.contexts.includes("selection"))
    .toSorted((a, b) => Number(b.id === preferred) - Number(a.id === preferred));

  const showing = visibleSurface({
    command: commandOpen,
    selection: Boolean(selection && selectionAt),
    voice: Boolean(barAt),
    voiceBusy,
  });

  // The page cannot read a content script's variables, so the decision goes on
  // the host element — it is what a test reads to prove only one is on screen.
  // Written on commit rather than after paint: an attribute that disagrees with
  // what is on screen, even for a frame, is worse than no attribute at all.
  useLayoutEffect(() => {
    const element = document.getElementById("logue-host");
    if (element) element.dataset.logueSurface = showing;
  }, [showing]);

  return (
    <>
      {showing === "voice" && barAt && (
        <VoiceBar
          phase={voice.phase}
          style={{ left: barAt.left, top: barAt.top }}
          error={voice.error ?? hostError}
          context={context}
          seconds={voice.seconds}
          long={voice.long}
          keptCapture={voice.keptCapture}
          onRetry={() => void retryVoice()}
          inserted={Boolean(inserted)}
          onUndo={() => {
            inserted?.undo();
            setInserted(undefined);
          }}
          onDismissInserted={() => {
            setInserted(undefined);
          }}
          overrides={overrides}
          onOverrides={(next) => {
            forget();
            setOverrides(next);
          }}
          onStart={() => void voice.start()}
          onCommand={() => setCommandOpen(true)}
          onStop={() => void finishVoice()}
          onCancel={voice.cancel}
          onMove={(at) => {
            forget();
            setMoved(at);
          }}
          onResetPosition={() => setMoved(undefined)}
          moved={Boolean(moved)}
        />
      )}

      {showing === "command" && (
        <CommandBox
          style={{ left: commandAt.left, top: commandAt.top }}
          context={context}
          busy={command.busy}
          error={command.error}
          answer={command.answer}
          sources={command.sources}
          hasSelection={Boolean(selection)}
          onRun={(input) => void runCommand(input)}
          onInsert={(text) => {
            if (target.current) insertAtCaret(target.current, text);
            // Which Skills actually get used was unanswerable from the
            // extension, where most of them are run.
            if (command.runId) void host.adopt(command.runId, text, "insert");
            setCommandOpen(false);
            setCommand({ busy: false, sources: [] });
          }}
          onClose={() => {
            setCommandOpen(false);
            setCommand({ busy: false, sources: [] });
          }}
        />
      )}

      {showing === "selection" && selection && selectionAt && (
        <SelectionBar
          phase={selectionPhase}
          style={{ left: selectionAt.left, top: selectionAt.top }}
          error={selectionError}
          skills={selectionSkills}
          writing={writing}
          note={note}
          onNote={setNote}
          onOpenNote={() => setWriting(true)}
          onSaveNote={() => void saveSelection({ note })}
          onSave={() => void saveSelection()}
          onVoice={() => void startSelectionVoice()}
          onAccept={() => void finishSelectionVoice()}
          onCancel={() => {
            selectionVoice.cancel();
            setWriting(false);
            setNote("");
            setSelectionPhase("idle");
          }}
          onSkill={(skillId) => {
            // Open first, then run. Running first left the person looking at an
            // unchanged toolbar for the whole model call.
            setCommandOpen(true);
            void runCommand({ instruction: selection.text, skillId, project, scope: "selection" });
          }}
        />
      )}
    </>
  );
}

/**
 * Mount into a shadow root under <body>.
 *
 * Under <html> the host never paints on some apps (Notion), and at
 * document_start there is no <body> yet — so start on the root element and move
 * in the moment one appears.
 */
/**
 * Where a running instance says it is here, so the next one can take over.
 *
 * Content scripts from one extension share an isolated world, so this global
 * is the handshake between the copy already on the page and the copy an update
 * has just injected. A fixed name on purpose: the new script has to find it
 * without being told.
 */
declare global {
  /** Set by whichever copy of this script is currently on the page. */
  // oxlint-disable-next-line no-var
  var logueLive: { stop: () => void } | undefined;
}

/**
 * The one thing a previous instance has to offer: a way out.
 *
 * Checked at runtime as well as declared, because the copy that set it may be
 * older than this file — what it left behind is a promise about the past, not
 * a guarantee about its shape.
 */
function running(): (() => void) | undefined {
  const stop = globalThis.logueLive?.stop;
  return typeof stop === "function" ? stop : undefined;
}

function mount() {
  /*
   * The copy already here leaves before this one arrives.
   *
   * Today Chrome tears down an extension's content-script contexts when the
   * extension reloads, so the old copy is usually gone before this one lands —
   * measured on a real page, sampling every 0.4s across an update: never two.
   * This does not depend on that. Removing the element alone would: every
   * instance watches the DOM and re-appends its own the moment it goes
   * missing, so a copy that outlived its context by even a moment would put
   * itself straight back, and two hosts with one id would fight over one
   * recording.
   */
  running()?.();

  document.getElementById("logue-host")?.remove();
  const element = document.createElement("div");
  element.id = "logue-host";
  const shadow = element.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const root = document.createElement("div");
  shadow.append(style, root);

  const place = () => {
    const parent = document.body ?? document.documentElement;
    if (element.parentElement !== parent) parent.append(element);
  };
  place();
  const placing = new MutationObserver(place);
  placing.observe(document.documentElement, { childList: true });

  // Which build is on this page — the first question to answer when a surface
  // behaves like code that was replaced days ago. Asking also wakes the worker,
  // which is how a freshly deployed build gets noticed within a page load
  // rather than at the next five-minute check.
  void send<{ build?: string }>({ type: "logue:build" }).then((reply) => {
    element.dataset.logueBuild = reply?.build ?? "unknown";
  });

  // A content script's errors are invisible from the page, so record failure on
  // the host element. `document.getElementById("logue-host").dataset.logueError`
  // is then the first thing to check when a surface does not appear.
  const report = (cause: unknown) => {
    element.dataset.logueError = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    console.error("Logue could not start on this page:", cause);
  };

  const reactRoot = createRoot(root, { onUncaughtError: report, onCaughtError: report });
  reactRoot.render(
    <StrictMode>
      <Surfaces />
    </StrictMode>,
  );
  element.dataset.logueReady = "1";

  /**
   * Leave when the extension that injected this script is gone.
   *
   * An update replaces the extension but does not stop the scripts already on
   * open pages: they keep tracking the caret and keep drawing bars whose
   * buttons can no longer reach anything. Worse, the page then holds whatever
   * that build did wrong long after it was fixed — a bar that should have
   * yielded to the selection toolbar keeps sitting there. There is nothing
   * left to talk to, so the honest thing is to disappear and let the next
   * page load bring the new build.
   */
  const stopWatching = watchForOrphaning();
  const stop = () => {
    // The observer goes first. Removing the element while it is still watching
    // is what put the element straight back.
    placing.disconnect();
    stopWatching();
    reactRoot.unmount();
    element.remove();
    if (running() === stop) globalThis.logueLive = undefined;
  };
  whenOrphaned(stop);
  globalThis.logueLive = { stop };
}

if (window.top === window) {
  try {
    mount();
  } catch (cause) {
    // A surface that fails to mount is invisible, and an invisible failure on
    // someone else's page is the hardest kind to diagnose. Say so out loud.
    console.error("Logue could not start on this page:", cause);
  }
}
