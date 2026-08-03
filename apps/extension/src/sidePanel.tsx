import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getCaptureContext,
  getExtensionSkills,
  getExtensionSettings,
  getPageMaterials,
  createExtensionSkillRun,
  adoptExtensionSkillRun,
  saveMaterial,
  saveSelection,
  transcribeAudio,
  type AppliedContext,
  type CaptureContext,
  type ExtensionSkill,
  type PageMaterial,
} from "./api";
import {
  friendlyLocalError,
  type LocalError,
  type PendingInsert,
  type PanelCaptureState,
} from "./capturePrimitives";
import {
  audioBlobFromEvent,
  type RecordingControlAction,
  type RecordingPanelEvent,
} from "./recordingBridge";
import { createRequestId } from "./requestId";
import { type CapturePhase } from "./sidePanelPresentation";
import { saveThenRefreshPageHistory, shouldLoadPageHistory } from "./sidePanelPageHistory";
import { canInsertGeneratedText, generationTargetKey } from "./sidePanelGeneration";
import { handleSidePanelShortcut } from "./sidePanelShortcuts";
import { SidePanelView } from "./sidePanelView";
import "./sidePanel.css";

type Phase = CapturePhase;

interface RuntimeResponse<T> { ok: boolean; value?: T; }
interface RecordingSession { id: string; tabId: number; }

function SidePanelApp() {
  const [state, setState] = useState<PanelCaptureState>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState<CaptureContext>();
  const [pageMaterials, setPageMaterials] = useState<PageMaterial[]>([]);
  const [error, setError] = useState<LocalError>();
  const [elapsed, setElapsed] = useState(0);
  const [skills, setSkills] = useState<ExtensionSkill[]>([]);
  const [skillId, setSkillId] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [generationRunId, setGenerationRunId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<PendingInsert>();
  const [insertingPending, setInsertingPending] = useState(false);
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
  const pendingInsertInFlightRef = useRef(false);
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
          const pending: PendingInsert = {
            text: content,
            materialId: saved.id,
            sourceURL: current.source.url,
          };
          setPendingInsert(pending);
          persistDraft({ pendingInsert: pending });
          requestIdRef.current = createRequestId();
          throw new Error(`target unavailable:${saved.id}`);
        }
      }
    }
    setPendingInsert(undefined);
    setDraft("");
    setTranscript("");
    setError(undefined);
    requestIdRef.current = createRequestId();
    persistDraft({ draft: "", transcript: "", pendingInsert: null });
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
    setPendingInsert(undefined);
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
      const run = await createExtensionSkillRun({
        skillId,
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
      await adoptExtensionSkillRun(generationRunId, generatedText.trim());
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
    if (!current || !pendingInsert) return;
    if (pendingInsertInFlightRef.current) return;
    if (!current.targetAvailable || current.source.url !== pendingInsert.sourceURL) {
      setError({ kind: "target", message: "Return to the original page and focus a writable editor, or copy the saved text.", action: "copy" });
      return;
    }
    pendingInsertInFlightRef.current = true;
    setInsertingPending(true);
    try {
      const response = await chrome.tabs.sendMessage(current.tabId, {
        type: "logue:insert-text",
        text: pendingInsert.text,
      }) as { ok?: boolean } | undefined;
      if (!response?.ok) throw new Error("The original editor is still unavailable.");
      setPendingInsert(undefined);
      setDraft("");
      setTranscript("");
      setError(undefined);
      setPhase("idle");
      requestIdRef.current = createRequestId();
      persistDraft({ draft: "", transcript: "", pendingInsert: null });
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
    } finally {
      pendingInsertInFlightRef.current = false;
      setInsertingPending(false);
    }
  }, [pendingInsert, persistDraft]);

  const copyPendingInsert = useCallback(async () => {
    if (!pendingInsert) return;
    try {
      await navigator.clipboard.writeText(pendingInsert.text);
      setPendingInsert(undefined);
      setDraft("");
      setTranscript("");
      setError(undefined);
      setPhase("idle");
      requestIdRef.current = createRequestId();
      persistDraft({ draft: "", transcript: "", pendingInsert: null });
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
    }
  }, [pendingInsert, persistDraft]);

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
      setPendingInsert(next.pendingInsert);
      setPageMaterials([]);
      setPhase("idle");
      setError(next.pendingInsert ? {
        kind: "target",
        message: "The original editor is no longer available. Your text is saved in Logue.",
        action: "copy",
      } : undefined);
      requestIdRef.current = createRequestId();
      void getCaptureContext(next.source.url)
        .then(setContext)
        .catch(() => setContext(undefined));
      if (shouldLoadPageHistory(next.intent)) void refreshPageMaterials(next.source.url);
      if (next.intent === "generate") {
        void Promise.all([getExtensionSkills(), getExtensionSettings()]).then(([available, settings]) => {
          setSkills(available);
          setSkillId(available.find((item) => item.id === settings.default_extension_skill)?.id ?? available[0]?.id ?? "");
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
      handleSidePanelShortcut(event, phase, {
        pendingInsert: Boolean(pendingInsert),
        onRecord: startRecording,
        onStop: stopRecording,
        onCancel: cancelRecording,
        onClose: () => { void chrome.runtime.sendMessage({ type: "logue:close-side-panel" }); },
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelRecording, pendingInsert, phase, startRecording, stopRecording]);

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

  return (
    <SidePanelView
      state={state}
      phase={phase}
      draft={draft}
      generatedText={generatedText}
      skills={skills}
      skillId={skillId}
      pageMaterials={pageMaterials}
      error={error}
      elapsed={elapsed}
      pendingInsert={pendingInsert}
      insertingPending={insertingPending}
      generating={generating}
      canRetry={Boolean(lastBlobRef.current)}
      panelRef={panelMainRef}
      onDraftChange={(value) => { setDraft(value); persistDraft({ draft: value }); }}
      onGeneratedTextChange={setGeneratedText}
      onSkillIdChange={setSkillId}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onCancelRecording={cancelRecording}
      onRetryTranscription={() => { if (lastBlobRef.current) void transcribeAndSave(lastBlobRef.current); }}
      onSave={() => void saveContent(draft.trim()).catch((cause) => { setError(friendlyLocalError(cause, "save")); setPhase("error"); })}
      onRequestGeneration={requestGeneration}
      onReturnToPage={returnToPage}
      onGenerate={() => void runGeneration()}
      onInsertGenerated={() => void useGeneratedText()}
      onRetryInsert={() => void retryInsert()}
      onCopyPendingInsert={() => void copyPendingInsert()}
    />
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><SidePanelApp /></StrictMode>);
