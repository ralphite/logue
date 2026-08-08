import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { host, type Context, type Material } from "./api";
import { caretRect } from "./caret";
import * as googleDocs from "./googleDocs";
import { activeEditable, insertAtCaret, isOurs, pageSelection, pageSource, type Editable, type SelectionSnapshot } from "./editable";
import { isFromBackground } from "./messages";
import { aboveSelection, besideCaret, BAR } from "./position";
import { NO_OVERRIDES, type VoiceOverrides } from "./overrides";
import { useVoice } from "./useVoice";
import { Candidate } from "./surfaces/Candidate";
import { CommandBox } from "./surfaces/CommandBox";
import { SelectionBar, type SelectionPhase } from "./surfaces/SelectionBar";
import { VoiceBar } from "./surfaces/VoiceBar";
import styles from "./surface.css?inline";

const CANDIDATE = { width: 340, height: 160 };
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

function Surfaces() {
  const [context, setContext] = useState<Context>();
  const [overrides, setOverrides] = useState<VoiceOverrides>(NO_OVERRIDES);

  // -- the caret-following bar -------------------------------------------
  const target = useRef<Editable | null>(null);
  const [caret, setCaret] = useState<{ left: number; top: number; bottom: number }>();
  const [moved, setMoved] = useState<{ left: number; top: number }>();

  // -- what each surface is doing ----------------------------------------
  const voice = useVoice();
  const [candidate, setCandidate] = useState<{ text: string; material: Material }>();
  const [inserted, setInserted] = useState<{ undo: () => void }>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [command, setCommand] = useState<{ busy: boolean; answer?: string; sources: Material[]; error?: string }>({
    busy: false,
    sources: [],
  });
  const [selection, setSelection] = useState<SelectionSnapshot>();
  const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>("idle");
  const [selectionError, setSelectionError] = useState<string>();
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");
  const selectionVoice = useVoice();

  const project = overrides.project ?? context?.voice_profile.project_name ?? "";

  useEffect(() => {
    void host.context(project).then(setContext, () => undefined);
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
      if (writing || selectionPhase === "recording") return;
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
    const listener = (message: unknown) => {
      if (!isFromBackground(message)) return;
      if (message.type === "logue:start-voice" && target.current) void voice.start();
      if (message.type === "logue:start-command") setCommandOpen(true);
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
    const result = await voice.stop({ project, overrides, source: pageSource() });
    if (result) setCandidate(result);
  };

  const insert = () => {
    if (!candidate) return;
    if (googleDocs.isGoogleDocs()) {
      // Docs owns its undo stack; ours would fight it, so offer none.
      if (googleDocs.insert(candidate.text)) setInserted({ undo: () => undefined });
      return;
    }
    if (!target.current) return;
    const done = insertAtCaret(target.current, candidate.text);
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
        const { material } = await host.saveMaterial({
          kind: "selection",
          content: selection.text,
          source: pageSource(),
          projects: chosen ? [chosen] : [],
        });
        sourceIds = [material.id];
      } else if (scope === "page") {
        const { materials } = await host.pageMaterials(location.href);
        sourceIds = materials.map((item) => item.id);
      }
      const result = await host.run({ skill_id: skillId, instruction, project: chosen, source_ids: sourceIds });
      if (result.run.status !== "complete") {
        setCommand({ busy: false, sources: [], error: result.run.error ?? "The model did not answer." });
        return;
      }
      setCommand({ busy: false, answer: result.run.original_output ?? "", sources: result.sources });
    } catch (cause) {
      setCommand({ busy: false, sources: [], error: cause instanceof Error ? cause.message : "Could not run that." });
    }
  };

  const saveSelection = async (extra?: { note?: string }) => {
    if (!selection) return;
    setSelectionPhase("saving");
    setSelectionError(undefined);
    try {
      const { material } = await host.saveMaterial({
        kind: "selection",
        content: selection.text,
        source: pageSource(),
        projects: project ? [project] : [],
      });
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
    const { material } = await host.saveMaterial({
      kind: "selection",
      content: selection.text,
      source: pageSource(),
      projects: project ? [project] : [],
    });
    const spoken = await selectionVoice.stop({
      project,
      overrides,
      source: pageSource(),
      parentIds: [material.id],
    });
    setSelectionPhase(spoken ? "saved" : "idle");
    if (spoken) window.setTimeout(() => setSelectionPhase("idle"), 1400);
  };

  // -- placement ---------------------------------------------------------
  const barSize = voice.phase === "idle" || voice.phase === "error" ? BAR.idle : BAR.busy;
  const barAt = moved
    ? moved
    : caret
      ? besideCaret(caret, viewport(), barSize.width, barSize.height)
      : undefined;
  const candidateAt = caret ? besideCaret(caret, viewport(), CANDIDATE.width, CANDIDATE.height) : undefined;
  const commandAt = caret
    ? besideCaret(caret, viewport(), COMMAND.width, COMMAND.height)
    : { left: 16, top: 16 };
  const selectionAt = selection
    ? aboveSelection(selection.rect, viewport(), writing ? 320 : SELECTION.width, writing ? 140 : SELECTION.height)
    : undefined;

  const selectionSkills = (context?.skills ?? []).filter(
    (skill) => skill.enabled && skill.contexts.includes("selection"),
  );

  return (
    <>
      {barAt && !candidate && !commandOpen && (
        <VoiceBar
          phase={voice.phase}
          style={{ left: barAt.left, top: barAt.top }}
          error={voice.error}
          context={context}
          overrides={overrides}
          onOverrides={setOverrides}
          onStart={() => void voice.start()}
          onCommand={() => setCommandOpen(true)}
          onStop={() => void finishVoice()}
          onCancel={voice.cancel}
          onMove={setMoved}
          onResetPosition={() => setMoved(undefined)}
          moved={Boolean(moved)}
        />
      )}

      {candidate && candidateAt && (
        <Candidate
          text={candidate.text}
          style={{ left: candidateAt.left, top: candidateAt.top }}
          inserted={Boolean(inserted)}
          onChange={(text) => setCandidate({ ...candidate, text })}
          onInsert={insert}
          onUndo={() => {
            inserted?.undo();
            setInserted(undefined);
            setCandidate(undefined);
          }}
          onDismiss={() => {
            setInserted(undefined);
            setCandidate(undefined);
          }}
        />
      )}

      {commandOpen && (
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
            setCommandOpen(false);
            setCommand({ busy: false, sources: [] });
          }}
          onClose={() => {
            setCommandOpen(false);
            setCommand({ busy: false, sources: [] });
          }}
        />
      )}

      {selection && selectionAt && !commandOpen && (
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
          onSkill={(skillId) =>
            void runCommand({ instruction: selection.text, skillId, project, scope: "selection" }).then(() =>
              setCommandOpen(true),
            )
          }
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
function mount() {
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
  new MutationObserver(place).observe(document.documentElement, { childList: true });

  // A content script's errors are invisible from the page, so record failure on
  // the host element. `document.getElementById("logue-host").dataset.logueError`
  // is then the first thing to check when a surface does not appear.
  const report = (cause: unknown) => {
    element.dataset.logueError = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    console.error("Logue could not start on this page:", cause);
  };

  createRoot(root, { onUncaughtError: report, onCaughtError: report }).render(
    <StrictMode>
      <Surfaces />
    </StrictMode>,
  );
  element.dataset.logueReady = "1";
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
