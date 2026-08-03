import { ArrowLeft, Mic, Sparkles, Square } from "lucide-react";
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getCaptureContext,
  getExtensionAgents,
  getExtensionSettings,
  getPageMaterials,
  createExtensionAgentRun,
  adoptExtensionAgentRun,
  saveMaterial,
  saveSelection,
  transcribeAudio,
  type AppliedContext,
  type CaptureContext,
  type ExtensionAgent,
  type PageMaterial,
} from "./api";
import {
  friendlyLocalError,
  type LocalError,
  type PanelCaptureState,
} from "./capturePrimitives";
import {
  audioBlobFromEvent,
  type RecordingControlAction,
  type RecordingPanelEvent,
} from "./recordingBridge";
import { createRequestId } from "./requestId";
import { capturePhasePresentation, type CapturePhase } from "./sidePanelPresentation";
import { saveThenRefreshPageHistory, shouldLoadPageHistory, shouldShowPageHistory } from "./sidePanelPageHistory";
import { canInsertGeneratedText, generationTargetKey } from "./sidePanelGeneration";
import { sidePanelShortcutAction } from "./sidePanelShortcuts";
import "./sidePanel.css";

type Phase = CapturePhase;

interface RuntimeResponse<T> { ok: boolean; value?: T; }
interface RecordingSession { id: string; tabId: number; }

function sourceLabel(state: PanelCaptureState) {
  if (state.intent === "selection") return "Selection";
  if (state.intent === "input") return "Current editor";
  if (state.intent === "generate") return "Generate";
  return "Current page";
}

function SidePanelApp() {
  const [state, setState] = useState<PanelCaptureState>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState<CaptureContext>();
  const [pageMaterials, setPageMaterials] = useState<PageMaterial[]>([]);
  const [error, setError] = useState<LocalError>();
  const [elapsed, setElapsed] = useState(0);
  const [skills, setSkills] = useState<ExtensionAgent[]>([]);
  const [skillId, setSkillId] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [generationRunId, setGenerationRunId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [pendingInsertText, setPendingInsertText] = useState("");
  const timerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(createRequestId());
  const lastBlobRef = useRef<Blob | undefined>(undefined);
  const stateRef = useRef<PanelCaptureState | undefined>(undefined);
  const draftRef = useRef("");
  const transcriptRef = useRef("");
  const transcribeAndSaveRef = useRef<(blob: Blob) => Promise<void>>(async () => undefined);
  const startRecordingRef = useRef<() => void>(() => undefined);
  const recordingEventRef = useRef<(event: RecordingPanelEvent) => void>(() => undefined);
  const recordingSessionRef = useRef<RecordingSession | undefined>(undefined);
  const recordingPortRef = useRef<chrome.runtime.Port | undefined>(undefined);
  const phaseRef = useRef<Phase>("idle");
  const generatedForTargetRef = useRef<string | undefined>(undefined);
  const panelMainRef = useRef<HTMLElement>(null);
  const focusPanelOnHydrationRef = useRef(false);

  stateRef.current = state;
  draftRef.current = draft;
  transcriptRef.current = transcript;
  phaseRef.current = phase;

  const persistDraft = useCallback((patch: Record<string, unknown>) => {
    void chrome.runtime.sendMessage({ type: "logue:update-panel-state", patch });
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== undefined) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const sendRecordingControl = useCallback((session: RecordingSession, action: RecordingControlAction) => {
    return chrome.tabs.sendMessage(session.tabId, {
      type: "logue:recording-control",
      action,
      sessionId: session.id,
    }) as Promise<{ ok?: boolean } | undefined>;
  }, []);

  const appliedContext = useCallback((captureContext: CaptureContext): AppliedContext => {
    return {
      page_url: stateRef.current?.source.url ?? "",
      page_title: stateRef.current?.source.title ?? "",
      personal_context: captureContext.personal_context || undefined,
      glossary: captureContext.personal_glossary,
      recent_adopted_ids: captureContext.recent_adopted_refs?.map((item) => item.id) ?? [],
      recent_adopted_texts: captureContext.recent_adopted_refs?.map((item) => item.text) ?? captureContext.recent_adopted,
    };
  }, []);

  const refreshPageMaterials = useCallback(async (pageUrl: string) => {
    try {
      const materials = await getPageMaterials(pageUrl);
      if (stateRef.current?.source.url === pageUrl) setPageMaterials(materials);
    } catch {
      // Page material history is quiet context, so a failed refresh must not obscure capture.
    }
  }, []);

  const saveContent = useCallback(async (content: string, captureId?: string, rawTranscript?: string) => {
    const current = stateRef.current;
    if (!current) return;
    const currentContext = context ?? await getCaptureContext(current.source.url);
    const provenance = appliedContext(currentContext);
    const selectionText = current.selectionText;
    if (selectionText) {
      await saveThenRefreshPageHistory(
        () => saveSelection({
          requestId: requestIdRef.current,
          sourceContent: selectionText,
          annotation: content.trim() || undefined,
          transcript: captureId ? rawTranscript : undefined,
          source: { ...current.source, selection: selectionText },
          projects: [],
          tags: [],
          captureId,
          appliedContext: provenance,
        }),
        () => refreshPageMaterials(current.source.url),
      );
    } else {
      const saved = await saveThenRefreshPageHistory(
        () => saveMaterial({
          requestId: requestIdRef.current,
          kind: captureId ? "voice" : "text",
          content,
          transcript: captureId ? rawTranscript : undefined,
          source: current.source,
          projects: [],
          tags: [],
          captureId,
          appliedContext: provenance,
        }),
        () => refreshPageMaterials(current.source.url),
      );
      if (current.intent === "input") {
        const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:insert-text", text: content }) as { ok?: boolean } | undefined;
        if (!response?.ok) {
          setPendingInsertText(content);
          throw new Error(`target unavailable:${saved.id}`);
        }
      }
    }
    setPendingInsertText("");
    setDraft("");
    setTranscript("");
    setError(undefined);
    requestIdRef.current = createRequestId();
    persistDraft({ draft: "", transcript: "" });
  }, [appliedContext, context, persistDraft, refreshPageMaterials]);

  const transcribeAndSave = useCallback(async (blob: Blob) => {
    const current = stateRef.current;
    if (!current) return;
    setPhase("processing");
    setError(undefined);
    try {
      const currentContext = context ?? await getCaptureContext(current.source.url);
      const result = await transcribeAudio({
        audio: blob,
        source: current.source,
        targetText: current.intent === "input" ? current.targetText : undefined,
        selectedText: current.selectionText,
        projectContext: currentContext.personal_context,
        glossary: currentContext.personal_glossary.join("\n"),
        instructions: current.selectionText
          ? "Transcribe this as an annotation to the selected source."
          : "Transcribe this as concise text linked to the current page.",
        appliedContext: appliedContext(currentContext),
      });
      setTranscript(result.text);
      setDraft(result.text);
      persistDraft({ draft: result.text, transcript: result.text });
      await saveContent(result.text, result.capture_id, result.text);
      setPhase("idle");
    } catch (cause) {
      setError(friendlyLocalError(cause, /target unavailable/i.test(String(cause)) ? "target" : "transcription"));
      setPhase("error");
    }
  }, [appliedContext, context, persistDraft, saveContent]);

  transcribeAndSaveRef.current = transcribeAndSave;

  const startRecording = useCallback(() => {
    if (phaseRef.current === "starting" || phaseRef.current === "recording" || phaseRef.current === "processing") return;
    const current = stateRef.current;
    if (!current) return;
    const session = { id: createRequestId(), tabId: current.tabId };
    recordingPortRef.current?.disconnect();
    try {
      const port = chrome.tabs.connect(current.tabId, { name: "logue:recording-lifecycle" });
      port.onDisconnect.addListener(() => {
        if (recordingSessionRef.current?.id !== session.id) return;
        recordingSessionRef.current = undefined;
        recordingPortRef.current = undefined;
        stopTimer();
        setError({
          kind: "target",
          message: "The page changed. Recording stopped.",
          action: "retry",
        });
        setPhase("error");
      });
      recordingPortRef.current = port;
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
      setPhase("error");
      return;
    }
    recordingSessionRef.current = session;
    setPhase("starting");
    setError(undefined);
    setPendingInsertText("");
    void sendRecordingControl(session, "start").then((response) => {
      if (!response?.ok) throw new Error("The page could not start voice capture.");
    }).catch((cause: unknown) => {
      if (recordingSessionRef.current?.id !== session.id) return;
      recordingSessionRef.current = undefined;
      recordingPortRef.current?.disconnect();
      recordingPortRef.current = undefined;
      setError({
        kind: "microphone",
        message: cause instanceof Error ? cause.message : "Voice capture is not available on this page.",
        action: "retry",
      });
      setPhase("error");
    });
  }, [sendRecordingControl, stopTimer]);

  startRecordingRef.current = startRecording;

  recordingEventRef.current = (event) => {
    const session = recordingSessionRef.current;
    if (!session || session.id !== event.sessionId || session.tabId !== event.tabId) return;
    if (event.event === "started") {
      stopTimer();
      setPhase("recording");
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
      return;
    }
    recordingSessionRef.current = undefined;
    recordingPortRef.current?.disconnect();
    recordingPortRef.current = undefined;
    stopTimer();
    if (event.event === "cancelled") {
      setPhase("idle");
      setElapsed(0);
      return;
    }
    if (event.event === "error") {
      setError(friendlyLocalError(new Error(event.error || "Could not start recording."), "microphone"));
      setPhase("error");
      return;
    }
    try {
      const blob = audioBlobFromEvent(event);
      lastBlobRef.current = blob;
      void transcribeAndSaveRef.current(blob);
    } catch (cause) {
      setError(friendlyLocalError(cause, "transcription"));
      setPhase("error");
    }
  };

  const runGeneration = useCallback(async () => {
    const current = stateRef.current;
    if (!current || !skillId || !draft.trim()) return;
    const targetKey = generationTargetKey(current);
    setGenerating(true);
    setError(undefined);
    try {
      const run = await createExtensionAgentRun({
        agentId: skillId,
        instruction: draft.trim(),
        pageTitle: current.source.title,
        pageUrl: current.source.url,
        targetText: current.targetText,
        selection: current.selectionText,
      });
      if (run.status !== "complete" || !run.original_output?.trim()) throw new Error(run.error || "No result returned");
      generatedForTargetRef.current = targetKey;
      setGenerationRunId(run.id);
      setGeneratedText(run.original_output);
    } catch (cause) {
      setError(friendlyLocalError(cause, "service"));
    } finally {
      setGenerating(false);
    }
  }, [draft, skillId]);

  const useGeneratedText = useCallback(async () => {
    const current = stateRef.current;
    if (!current || !generatedText.trim() || !generationRunId) return;
    if (!canInsertGeneratedText(current, generatedForTargetRef.current)) {
      generatedForTargetRef.current = undefined;
      setGeneratedText("");
      setGenerationRunId(undefined);
      setError({ kind: "target", message: "The original editor changed. Generate again.", action: "retry" });
      return;
    }
    try {
      await adoptExtensionAgentRun(generationRunId, generatedText.trim());
      const response = await chrome.tabs.sendMessage(current.tabId, {
        type: "logue:insert-text",
        text: generatedText.trim(),
      }) as { ok?: boolean } | undefined;
      if (!response?.ok) {
        await navigator.clipboard.writeText(generatedText.trim());
        setError({ kind: "target", message: "The original editor is unavailable. The reply was copied.", action: "copy" });
        return;
      }
      setDraft("");
      setGeneratedText("");
      setGenerationRunId(undefined);
      generatedForTargetRef.current = undefined;
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
    }
  }, [generatedText, generationRunId]);

  const stopRecording = useCallback(() => {
    const session = recordingSessionRef.current;
    if (!session) return;
    setPhase("processing");
    stopTimer();
    void sendRecordingControl(session, "stop").then((response) => {
      if (!response?.ok) throw new Error("The recording is no longer active.");
    }).catch((cause: unknown) => {
      if (recordingSessionRef.current?.id !== session.id) return;
      recordingSessionRef.current = undefined;
      recordingPortRef.current?.disconnect();
      recordingPortRef.current = undefined;
      setError(friendlyLocalError(cause, "transcription"));
      setPhase("error");
    });
  }, [sendRecordingControl, stopTimer]);

  const cancelRecording = useCallback(() => {
    const session = recordingSessionRef.current;
    recordingSessionRef.current = undefined;
    if (session) void sendRecordingControl(session, "cancel").catch(() => undefined);
    recordingPortRef.current?.disconnect();
    recordingPortRef.current = undefined;
    stopTimer();
    setPhase("idle");
    setElapsed(0);
  }, [sendRecordingControl, stopTimer]);

  const retryInsert = useCallback(async () => {
    const current = stateRef.current;
    if (!current || !pendingInsertText) return;
    try {
      const response = await chrome.tabs.sendMessage(current.tabId, {
        type: "logue:insert-text",
        text: pendingInsertText,
      }) as { ok?: boolean } | undefined;
      if (!response?.ok) throw new Error("The original editor is still unavailable.");
      setPendingInsertText("");
      setDraft("");
      setTranscript("");
      setError(undefined);
      setPhase("idle");
      persistDraft({ draft: "", transcript: "" });
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
    }
  }, [pendingInsertText, persistDraft]);

  const copyPendingInsert = useCallback(async () => {
    if (!pendingInsertText) return;
    await navigator.clipboard.writeText(pendingInsertText);
  }, [pendingInsertText]);

  const requestGeneration = useCallback(() => {
    generatedForTargetRef.current = undefined;
    setGeneratedText("");
    setGenerationRunId(undefined);
    void chrome.runtime.sendMessage({ type: "logue:request-panel-generate" })
      .then((response: { ok?: boolean; error?: string } | undefined) => {
        if (!response?.ok) {
          setError({
            kind: "target",
            message: response?.error || "Focus a writable editor, then try again.",
            action: "retry",
          });
        }
      })
      .catch((cause: unknown) => setError(friendlyLocalError(cause, "target")));
  }, []);

  const returnToPage = useCallback(() => {
    generatedForTargetRef.current = undefined;
    setGeneratedText("");
    setGenerationRunId(undefined);
    void chrome.runtime.sendMessage({ type: "logue:return-panel-to-page" })
      .then((response: { ok?: boolean; error?: string } | undefined) => {
        if (!response?.ok) {
          setError({
            kind: "target",
            message: response?.error || "Could not return to this page.",
            action: "retry",
          });
        }
      })
      .catch((cause: unknown) => setError(friendlyLocalError(cause, "target")));
  }, []);

  useEffect(() => {
    const hydrate = (next?: PanelCaptureState) => {
      if (!next) return;
      const previous = stateRef.current;
      if (!previous) focusPanelOnHydrationRef.current = true;
      const activeSession = recordingSessionRef.current;
      if (activeSession && previous && (
        activeSession.tabId !== next.tabId ||
        previous.intent !== next.intent ||
        previous.source.url !== next.source.url
      )) {
        recordingSessionRef.current = undefined;
        void sendRecordingControl(activeSession, "cancel").catch(() => undefined);
        recordingPortRef.current?.disconnect();
        recordingPortRef.current = undefined;
        stopTimer();
      }
      if (!canInsertGeneratedText(next, generatedForTargetRef.current)) {
        generatedForTargetRef.current = undefined;
        setGeneratedText("");
        setGenerationRunId(undefined);
      }
      setState(next);
      setDraft(next.draft ?? "");
      setTranscript(next.transcript ?? "");
      setPendingInsertText("");
      setPageMaterials([]);
      setPhase("idle");
      setError(undefined);
      requestIdRef.current = createRequestId();
      void getCaptureContext(next.source.url)
        .then(setContext)
        .catch(() => setContext(undefined));
      if (shouldLoadPageHistory(next.intent)) void refreshPageMaterials(next.source.url);
      if (next.intent === "generate") {
        void Promise.all([getExtensionAgents(), getExtensionSettings()]).then(([available, settings]) => {
          setSkills(available);
          setSkillId(available.find((item) => item.id === settings.default_extension_agent)?.id ?? available[0]?.id ?? "");
        }).catch((cause) => setError(friendlyLocalError(cause, "service")));
      }
      if (next.autoStartToken) {
        void chrome.runtime.sendMessage({
          type: "logue:consume-panel-autostart",
          token: next.autoStartToken,
        }).then((response: { consumed?: boolean } | undefined) => {
          if (response?.consumed) startRecordingRef.current();
        });
      }
    };
    void chrome.runtime.sendMessage({ type: "logue:get-panel-state" })
      .then((response: RuntimeResponse<PanelCaptureState>) => {
        hydrate(response.value);
      });
    const listener = (message: { type?: string; state?: PanelCaptureState } | RecordingPanelEvent) => {
      if (message.type === "logue:panel-state-changed") hydrate(message.state);
      if (message.type === "logue:recording-event" && "tabId" in message) recordingEventRef.current(message);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refreshPageMaterials, sendRecordingControl, stopTimer]);

  useEffect(() => {
    if (!state || !focusPanelOnHydrationRef.current) return;
    focusPanelOnHydrationRef.current = false;
    window.requestAnimationFrame(() => panelMainRef.current?.focus({ preventScroll: true }));
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = sidePanelShortcutAction({
        key: event.key,
        phase,
        target: event.target,
        isComposing: event.isComposing,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      });
      if (!action) return;
      event.preventDefault();
      if (action === "record") startRecording();
      if (action === "stop") stopRecording();
      if (action === "cancel") cancelRecording();
      if (action === "close") void chrome.runtime.sendMessage({ type: "logue:close-side-panel" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelRecording, phase, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      const activeSession = recordingSessionRef.current;
      recordingSessionRef.current = undefined;
      if (activeSession) void sendRecordingControl(activeSession, "cancel").catch(() => undefined);
      recordingPortRef.current?.disconnect();
      recordingPortRef.current = undefined;
      stopTimer();
      persistDraft({
        draft: draftRef.current,
        transcript: transcriptRef.current,
      });
    };
  }, [persistDraft, sendRecordingControl, stopTimer]);

  const sourceHref = useMemo(() => state?.source.url || undefined, [state]);
  const presentation = capturePhasePresentation(phase);

  if (!state) return <div className="empty">Open Logue from a page to begin.</div>;

  return (
    <main ref={panelMainRef} className="panel" tabIndex={-1}>
      <div className="panel-main">
        {presentation.showSource && <>
          <p className="eyebrow">{sourceLabel(state)}</p>
          <h1 className="page-title">
            {sourceHref ? <a className="source-link" href={sourceHref} target="_blank" rel="noreferrer" title={state.source.title}>{state.source.title}</a> : state.source.title}
          </h1>
          {state.selectionText && <blockquote className="selection">{state.selectionText}</blockquote>}
        </>}

        {presentation.status && <div className="processing" role="status"><span className="spinner" />{presentation.status}</div>}

        {presentation.showEditor && (state.intent === "generate" && generatedText ? (
          <textarea className="text-area" value={generatedText} onChange={(event) => setGeneratedText(event.target.value)} aria-label="Generated reply" />
        ) : (
          <textarea
            className="text-area"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); persistDraft({ draft: event.target.value }); }}
            placeholder={state.intent === "generate" ? "What should Logue write?" : state.selectionText ? "Add a note…" : state.intent === "input" ? "Write or record…" : "Add a note to this page…"}
            aria-label={state.intent === "generate" ? "Generation instruction" : state.selectionText ? "Annotation" : "Note"}
          />
        ))}

        {presentation.showEditor && state.intent === "generate" && !generatedText && (
          <label className="field-label generation-skill">Skill
            <select className="field" value={skillId} onChange={(event) => setSkillId(event.target.value)}>
              {skills.length ? skills.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No extension skills</option>}
            </select>
          </label>
        )}

        {presentation.showErrors && error && <div className="error" role="alert">{error.message}</div>}

        {presentation.showActions && <div className="actions">
          {phase === "starting" ? (
            <button type="button" className="button secondary" onClick={cancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
          ) : phase === "recording" ? (
            <>
              <button type="button" className="button secondary" onClick={cancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
              <button type="button" className="record-button recording" onClick={stopRecording} aria-keyshortcuts="Enter" title="Stop and save (Enter)"><Square size={14} fill="currentColor" /> Stop <span className="shortcut">{elapsed}s</span></button>
            </>
          ) : state.intent === "generate" ? (
            <button type="button" className="icon-button" onClick={returnToPage} aria-label="Back to page capture" title="Back to page capture"><ArrowLeft size={17} /></button>
          ) : pendingInsertText ? null : (
            <>
              <button type="button" className="record-button" onClick={startRecording} aria-keyshortcuts="R" title="Record — R when this sidebar is focused"><Mic size={17} /> Record</button>
              {state.targetAvailable && <button type="button" className="icon-button" onClick={requestGeneration} aria-label="Generate reply" title="Generate reply"><Sparkles size={17} /></button>}
            </>
          )}
          {!presentation.captureActive && <>
            <span className="spacer" />
            {state.intent !== "generate" && error && lastBlobRef.current && !pendingInsertText && <button type="button" className="button secondary" onClick={() => void transcribeAndSave(lastBlobRef.current!)}>Retry</button>}
            {state.intent !== "generate" && pendingInsertText && <>
              <button type="button" className="button secondary" onClick={() => void copyPendingInsert()}>Copy</button>
              <button type="button" className="button" onClick={() => void retryInsert()}>Insert again</button>
            </>}
            {state.intent === "generate" ? <button
              type="button"
              className="button"
              disabled={generatedText ? false : !draft.trim() || !skillId || generating}
              onClick={() => generatedText ? void useGeneratedText() : void runGeneration()}
            >{generating ? "Generating…" : generatedText ? "Insert" : "Generate"}</button> : draft.trim() && !pendingInsertText ? <button
              type="button"
              className="button"
              onClick={() => void saveContent(draft.trim()).catch((cause) => { setError(friendlyLocalError(cause, "save")); setPhase("error"); })}
            >Save</button> : null}
          </>}
        </div>}

        {shouldShowPageHistory(presentation.showSavedMaterials, state.intent, pageMaterials.length) && (
          <section className="page-materials" aria-label="Notes from this page">
            <h2 className="page-materials-heading">On this page</h2>
            <ol className="page-materials-list">
              {pageMaterials.map((material) => <li key={material.id} className="page-material">
                <p className="page-material-text">{material.annotation?.trim() || material.content}</p>
              </li>)}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><SidePanelApp /></StrictMode>);
