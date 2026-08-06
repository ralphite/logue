import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getCaptureContext,
  getExtensionSkills,
  getExtensionSettings,
  getPageMaterials,
  createExtensionSkillRun,
  adoptExtensionSkillRun,
  connectServer,
  defaultServerURL,
  getServerURL,
  getServiceStatus,
  saveMaterial,
  saveSelection,
  transcribeAudio,
  type AppliedContext,
  type CaptureContext,
  type ExtensionSkill,
  type PageMaterial,
} from "./api";
import {
  captureOrganization,
  explicitProjects,
  friendlyLocalError,
  type LocalError,
  type PendingInsert,
  type PanelCaptureState,
} from "./capturePrimitives";
import {
  createAudioRecorder,
  type AudioRecorderController,
} from "./recorder";
import { createRequestId } from "./requestId";
import { type CapturePhase } from "./sidePanelPresentation";
import { saveThenRefreshPageHistory, shouldLoadPageHistory } from "./sidePanelPageHistory";
import { panelMessageTargetsTab, sidePanelTabId, siblingExtensionDocumentPath } from "./sidePanelController";
import { canInsertGeneratedText, generationTargetKey } from "./sidePanelGeneration";
import { handleSidePanelShortcut } from "./sidePanelShortcuts";
import { createSidePanelFocusController, type SidePanelFocusController } from "./sidePanelFocus";
import {
  shouldInterruptPanelCapture,
  shouldPreservePanelCapturePresentation,
  type ActivePanelCaptureScope,
} from "./sidePanelRecordingState";
import { SidePanelView } from "./sidePanelView";
import "./sidePanel.css";

type Phase = CapturePhase;

interface RuntimeResponse<T> { ok: boolean; value?: T; }
interface RecordingSession extends ActivePanelCaptureScope { id: string; }
interface MicrophonePermissionResult {
  type: "logue:microphone-permission-result";
  token: string;
  ok: boolean;
  error?: string;
}
interface PendingMicrophonePermission {
  token: string;
  promise: Promise<void>;
  resolve: () => void;
  reject: (cause: Error) => void;
}
interface PanelRuntimeMessage {
  type?: string;
  state?: PanelCaptureState;
  tabId?: number;
}

function isMicrophonePermissionResult(message: unknown): message is MicrophonePermissionResult {
  return Boolean(
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === "logue:microphone-permission-result" &&
    typeof (message as { token?: unknown }).token === "string" &&
    typeof (message as { ok?: unknown }).ok === "boolean",
  );
}

const panelTabId = sidePanelTabId(window.location.search);
const microphonePermissionPath = siblingExtensionDocumentPath(
  chrome.runtime.getManifest().side_panel!.default_path,
  "microphone.html",
);

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
  const [serverURL, setServerURL] = useState(defaultServerURL);
  const [serverURLDraft, setServerURLDraft] = useState(defaultServerURL);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverConnecting, setServerConnecting] = useState(false);
  const [serverSettingsError, setServerSettingsError] = useState<string>();
  const timerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(createRequestId());
  const lastBlobRef = useRef<Blob | undefined>(undefined);
  const stateRef = useRef<PanelCaptureState | undefined>(undefined);
  const draftRef = useRef("");
  const transcriptRef = useRef("");
  const transcribeAndSaveRef = useRef<(blob: Blob) => Promise<void>>(async () => undefined);
  const startRecordingRef = useRef<() => void>(() => undefined);
  const recordingSessionRef = useRef<RecordingSession | undefined>(undefined);
  const recorderRef = useRef<AudioRecorderController | undefined>(undefined);
  const stopRequestedRef = useRef(false);
  const microphonePermissionRequestRef = useRef<PendingMicrophonePermission | undefined>(undefined);
  // This remains set through transcription so a harmless panel-state refresh
  // cannot collapse the active UI.
  const activeCaptureScopeRef = useRef<ActivePanelCaptureScope | undefined>(undefined);
  const phaseRef = useRef<Phase>("idle");
  const generatedForTargetRef = useRef<string | undefined>(undefined);
  const pendingInsertInFlightRef = useRef(false);
  const panelMainRef = useRef<HTMLElement>(null);
  const focusPanelOnHydrationRef = useRef(false);
  const panelFocusControllerRef = useRef<SidePanelFocusController | undefined>(undefined);

  if (!panelFocusControllerRef.current) {
    panelFocusControllerRef.current = createSidePanelFocusController({
      visibility: () => document.visibilityState,
      requestFrame: (callback) => { window.requestAnimationFrame(callback); },
      hasFocus: () => document.hasFocus(),
      focusWindow: () => { window.focus(); },
      activeElement: () => document.activeElement,
      serverInput: () => document.getElementById("logue-server-url"),
      panel: () => panelMainRef.current,
    });
  }

  stateRef.current = state;
  draftRef.current = draft;
  transcriptRef.current = transcript;
  phaseRef.current = phase;

  const persistDraft = useCallback((patch: Record<string, unknown>) => {
    if (typeof panelTabId !== "number") return;
    void chrome.runtime.sendMessage({ type: "logue:update-panel-state", tabId: panelTabId, patch });
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== undefined) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const requestMicrophonePermission = useCallback(() => {
    const existing = microphonePermissionRequestRef.current;
    if (existing) return existing.promise;
    const token = createRequestId();
    let resolvePermission!: () => void;
    let rejectPermission!: (cause: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePermission = resolve;
      rejectPermission = reject;
    });
    microphonePermissionRequestRef.current = {
      token,
      promise,
      resolve: resolvePermission,
      reject: rejectPermission,
    };
    void chrome.windows.create({
      url: chrome.runtime.getURL(`${microphonePermissionPath}?mode=permission&token=${encodeURIComponent(token)}`),
      type: "popup",
      width: 360,
      height: 180,
      focused: true,
    }).catch((cause: unknown) => {
      if (microphonePermissionRequestRef.current?.token !== token) return;
      microphonePermissionRequestRef.current = undefined;
      rejectPermission(cause instanceof Error ? cause : new Error("Could not request microphone access."));
    });
    return promise;
  }, []);

  const appliedContext = useCallback((captureContext: CaptureContext): AppliedContext => {
    const referenceProject = explicitProjects(stateRef.current)[0];
    const project = referenceProject
      ? captureContext.projects.find((item) => item.name === referenceProject)
      : undefined;
    return {
      page_url: stateRef.current?.source.url ?? "",
      page_title: stateRef.current?.source.title ?? "",
      reference_project: referenceProject,
      personal_context: captureContext.personal_context || undefined,
      project_overview: project?.overview,
      glossary: Array.from(new Set([...captureContext.personal_glossary, ...(project?.glossary ?? [])])),
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

  const refreshServerConnection = useCallback(async (current = stateRef.current) => {
    if (!current) return;
    setServerConnecting(true);
    try {
      await getServiceStatus();
      if (stateRef.current?.tabId !== current.tabId) return;
      setError((active) => active?.kind === "service" ? undefined : active);
      const captureContext = await getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "");
      if (stateRef.current?.tabId === current.tabId) setContext(captureContext);
      if (shouldLoadPageHistory(current.intent)) await refreshPageMaterials(current.source.url);
      if (current.intent === "generate") {
        const [available, settings] = await Promise.all([getExtensionSkills(), getExtensionSettings()]);
        if (stateRef.current?.tabId !== current.tabId) return;
        setSkills(available);
        setSkillId(available.find((item) => item.id === settings.default_extension_skill)?.id ?? available[0]?.id ?? "");
      }
    } catch (cause) {
      if (stateRef.current?.tabId === current.tabId && !current.pendingInsert) {
        setError(friendlyLocalError(cause, "service"));
      }
    } finally {
      setServerConnecting(false);
    }
  }, [refreshPageMaterials]);

  const openServerSettings = useCallback(() => {
    setServerURLDraft(serverURL);
    setServerSettingsError(undefined);
    setServerSettingsOpen(true);
  }, [serverURL]);

  const closeServerSettings = useCallback(() => {
    if (serverConnecting) return;
    setServerURLDraft(serverURL);
    setServerSettingsError(undefined);
    setServerSettingsOpen(false);
  }, [serverConnecting, serverURL]);

  const connectConfiguredServer = useCallback(() => {
    if (serverConnecting) return;
    setServerConnecting(true);
    setServerSettingsError(undefined);
    void connectServer(serverURLDraft).then(async (connected) => {
      setServerURL(connected.url);
      setServerURLDraft(connected.url);
      setServerSettingsOpen(false);
      setContext(undefined);
      setPageMaterials([]);
      setSkills([]);
      setSkillId("");
      setError((active) => pendingInsert ? active : undefined);
      await refreshServerConnection();
    }).catch((cause: unknown) => {
      setServerSettingsError(cause instanceof Error ? cause.message : "Could not connect to this server.");
    }).finally(() => setServerConnecting(false));
  }, [pendingInsert, refreshServerConnection, serverConnecting, serverURLDraft]);

  const connectCandidateServer = useCallback(() => {
    const current = stateRef.current;
    const candidate = current?.candidateServerURL;
    if (serverConnecting || !current || !candidate) return;
    let currentPageOrigin: string | undefined;
    try {
      currentPageOrigin = new URL(current.source.url).origin;
    } catch {
      // A navigation can invalidate the candidate before the click is handled.
    }
    if (currentPageOrigin !== candidate) {
      setServerSettingsError("This page is no longer using that Logue server.");
      return;
    }
    setServerConnecting(true);
    setServerSettingsError(undefined);
    void connectServer(candidate).then(async (connected) => {
      setServerURL(connected.url);
      setServerURLDraft(connected.url);
      setContext(undefined);
      setPageMaterials([]);
      setSkills([]);
      setSkillId("");
      setError((active) => pendingInsert ? active : undefined);
      await refreshServerConnection();
    }).catch(() => {
      setServerSettingsError("Couldn’t verify this Logue server.");
    }).finally(() => setServerConnecting(false));
  }, [pendingInsert, refreshServerConnection, serverConnecting]);

  const saveContent = useCallback(async (content: string, captureId?: string, rawTranscript?: string) => {
    const current = stateRef.current;
    if (!current) return;
    const currentContext = context ?? await getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "");
    const provenance = appliedContext(currentContext);
    const organization = captureOrganization(current);
    const selectionText = current.selectionText;
    if (selectionText) {
      await saveThenRefreshPageHistory(
        () => saveSelection({
          requestId: requestIdRef.current,
          sourceContent: selectionText,
          annotation: content.trim() || undefined,
          transcript: captureId ? rawTranscript : undefined,
          source: { ...current.source, selection: selectionText },
          ...organization,
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
          ...organization,
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
      const referenceProject = explicitProjects(current)[0];
      const currentContext = context ?? await getCaptureContext(current.source.url, referenceProject ?? "");
      const project = referenceProject
        ? currentContext.projects.find((item) => item.name === referenceProject)
        : undefined;
      const result = await transcribeAudio({
        audio: blob,
        source: current.source,
        targetText: current.intent === "input" ? current.targetText : undefined,
        selectedText: current.selectionText,
        projectContext: [currentContext.personal_context, project?.overview].filter(Boolean).join("\n\n"),
        glossary: Array.from(new Set([...currentContext.personal_glossary, ...(project?.glossary ?? [])])).join("\n"),
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

  const recorder = useCallback(() => {
    if (recorderRef.current) return recorderRef.current;
    recorderRef.current = createAudioRecorder({
      // A Side Panel is an extension page. Recording here keeps the user
      // gesture and requests permission for Logue itself, so capture works on
      // every normal page instead of relying on each site's media policy.
      getStream: async () => {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (cause) {
          // Chrome currently suppresses the permission prompt from a native
          // Side Panel. Ask once from a tiny extension-owned window, then
          // continue recording here with the newly granted Logue permission.
          if (!/permission|notallowed|dismissed|denied/i.test(String(cause))) throw cause;
          await requestMicrophonePermission();
          return navigator.mediaDevices.getUserMedia({ audio: true });
        }
      },
      onStart: () => {
        if (!recordingSessionRef.current) return;
        setPhase("recording");
        setElapsed(0);
        timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
      },
      onStop: (blob) => {
        const session = recordingSessionRef.current;
        recordingSessionRef.current = undefined;
        stopRequestedRef.current = false;
        stopTimer();
        if (!session) return;
        lastBlobRef.current = blob;
        void transcribeAndSaveRef.current(blob).finally(() => {
          activeCaptureScopeRef.current = undefined;
        });
      },
      onError: (cause) => {
        if (!recordingSessionRef.current) return;
        recordingSessionRef.current = undefined;
        stopRequestedRef.current = false;
        activeCaptureScopeRef.current = undefined;
        stopTimer();
        setError(friendlyLocalError(cause, "microphone"));
        setPhase("error");
      },
    });
    return recorderRef.current;
  }, [requestMicrophonePermission, stopTimer]);

  const startRecording = useCallback(() => {
    if (phaseRef.current === "starting" || phaseRef.current === "recording" || phaseRef.current === "processing") return;
    const current = stateRef.current;
    if (!current) return;
    const session = { id: createRequestId(), tabId: current.tabId, intent: current.intent };
    recordingSessionRef.current = session;
    activeCaptureScopeRef.current = session;
    stopRequestedRef.current = false;
    setPhase("starting");
    setError(undefined);
    setPendingInsert(undefined);
    void recorder().start();
  }, [recorder]);

  startRecordingRef.current = startRecording;

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
        project: explicitProjects(current)[0],
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
    stopRequestedRef.current = true;
    setPhase("processing");
    stopTimer();
    recorderRef.current?.stop();
  }, [stopTimer]);

  const cancelRecording = useCallback(() => {
    // Stop has already been accepted: let its final blob complete and save.
    // Cancelling it here would lose a user-visible recording on tab switch.
    if (stopRequestedRef.current) return;
    recordingSessionRef.current = undefined;
    recorderRef.current?.cancel();
    stopTimer();
    setPhase("idle");
    setElapsed(0);
  }, [stopTimer]);

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
    if (typeof panelTabId !== "number") return;
    void chrome.runtime.sendMessage({ type: "logue:request-panel-generate", tabId: panelTabId })
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

  const selectProject = useCallback((project: string) => {
    const current = stateRef.current;
    if (!current) return;
    const projects = project ? [project] : [];
    const next = { ...current, projects, updatedAt: Date.now() };
    stateRef.current = next;
    setState(next);
    persistDraft({ projects });
    void getCaptureContext(next.source.url, project).then((captureContext) => {
      if (
        stateRef.current?.tabId === next.tabId &&
        explicitProjects(stateRef.current)[0] === (project || undefined)
      ) setContext(captureContext);
    }).catch((cause: unknown) => {
      if (stateRef.current?.tabId === next.tabId) setError(friendlyLocalError(cause, "service"));
    });
  }, [persistDraft]);

  const returnToPage = useCallback(() => {
    generatedForTargetRef.current = undefined;
    setGeneratedText("");
    setGenerationRunId(undefined);
    if (typeof panelTabId !== "number") return;
    void chrome.runtime.sendMessage({ type: "logue:return-panel-to-page", tabId: panelTabId })
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
      if (!next || next.tabId !== panelTabId) return;
      const previous = stateRef.current;
      if (!previous) focusPanelOnHydrationRef.current = true;
      const activeSession = recordingSessionRef.current;
      const preserveActiveCapture = shouldPreservePanelCapturePresentation(
        phaseRef.current,
        activeCaptureScopeRef.current,
        next,
      );
      if (activeSession && shouldInterruptPanelCapture(activeSession, next)) {
        recordingSessionRef.current = undefined;
        activeCaptureScopeRef.current = undefined;
        stopRequestedRef.current = false;
        recorderRef.current?.cancel();
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
      setContext(undefined);
      setPageMaterials([]);
      if (next.intent === "generate") {
        setSkills([]);
        setSkillId("");
      }
      if (!preserveActiveCapture) {
        setPhase("idle");
        setError(next.pendingInsert ? {
          kind: "target",
          message: "The original editor is no longer available. Your text is saved in Logue.",
          action: "copy",
        } : undefined);
      }
      requestIdRef.current = createRequestId();
      void refreshServerConnection(next);
      if (next.autoStartToken) {
        void chrome.runtime.sendMessage({
          type: "logue:consume-panel-autostart",
          tabId: panelTabId,
          token: next.autoStartToken,
        }).then((response: { consumed?: boolean } | undefined) => {
          if (response?.consumed) startRecordingRef.current();
        });
      }
    };
    if (typeof panelTabId !== "number") return;
    void chrome.runtime.sendMessage({ type: "logue:get-panel-state", tabId: panelTabId })
      .then((response: RuntimeResponse<PanelCaptureState>) => {
        hydrate(response.value);
      });
    const requestPanelFocus = () => {
      if (!stateRef.current) {
        focusPanelOnHydrationRef.current = true;
        return;
      }
      panelFocusControllerRef.current?.request();
    };
    const listener = (message: unknown) => {
      if (isMicrophonePermissionResult(message)) {
        const request = microphonePermissionRequestRef.current;
        if (request?.token === message.token) {
          microphonePermissionRequestRef.current = undefined;
          if (message.ok) request.resolve();
          else request.reject(new Error(message.error || "Microphone access was not granted."));
        }
        return;
      }
      const panelMessage = message as PanelRuntimeMessage;
      if (panelMessage.type === "logue:panel-state-changed" && panelMessageTargetsTab(panelTabId, panelMessage)) {
        hydrate(panelMessage.state);
      }
      if (panelMessage.type === "logue:side-panel-opened" && panelMessage.tabId === panelTabId) {
        requestPanelFocus();
      }
      if (panelMessage.type === "logue:side-panel-hidden" && panelMessage.tabId === panelTabId) {
        cancelRecording();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [cancelRecording, refreshServerConnection, stopTimer]);

  useEffect(() => {
    void getServerURL().then((value) => {
      setServerURL(value);
      setServerURLDraft(value);
    });
  }, []);

  useEffect(() => {
    if (!state || !focusPanelOnHydrationRef.current) return;
    focusPanelOnHydrationRef.current = false;
    panelFocusControllerRef.current?.request();
  }, [state]);

  useEffect(() => {
    const focusWhenShown = () => {
      panelFocusControllerRef.current?.visibilityChanged();
    };
    document.addEventListener("visibilitychange", focusWhenShown);
    return () => document.removeEventListener("visibilitychange", focusWhenShown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (serverSettingsOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeServerSettings();
        }
        return;
      }
      handleSidePanelShortcut(event, phase, {
        pendingInsert: Boolean(pendingInsert),
        onRecord: startRecording,
        onStop: stopRecording,
        onCancel: cancelRecording,
        onClose: () => {
          if (typeof panelTabId === "number") {
            void chrome.runtime.sendMessage({ type: "logue:close-side-panel", tabId: panelTabId });
          }
        },
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelRecording, closeServerSettings, pendingInsert, phase, serverSettingsOpen, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      recordingSessionRef.current = undefined;
      stopRequestedRef.current = false;
      recorderRef.current?.dispose();
      stopTimer();
      persistDraft({
        draft: draftRef.current,
        transcript: transcriptRef.current,
      });
    };
  }, [persistDraft, stopTimer]);

  return (
    <SidePanelView
      state={state}
      phase={phase}
      draft={draft}
      generatedText={generatedText}
      skills={skills}
      skillId={skillId}
      projects={context?.projects ?? []}
      pageMaterials={pageMaterials}
      error={error}
      elapsed={elapsed}
      pendingInsert={pendingInsert}
      insertingPending={insertingPending}
      generating={generating}
      canRetry={Boolean(lastBlobRef.current)}
      serverURLDraft={serverURLDraft}
      serverCandidateURL={state?.candidateServerURL && state.candidateServerURL !== serverURL ? state.candidateServerURL : undefined}
      serverSettingsOpen={serverSettingsOpen}
      serverConnecting={serverConnecting}
      serverSettingsError={serverSettingsError}
      panelRef={panelMainRef}
      onDraftChange={(value) => { setDraft(value); persistDraft({ draft: value }); }}
      onGeneratedTextChange={setGeneratedText}
      onSkillIdChange={setSkillId}
      onProjectChange={selectProject}
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
      onServerURLDraftChange={setServerURLDraft}
      onOpenServerSettings={openServerSettings}
      onCloseServerSettings={closeServerSettings}
      onConnectServer={connectConfiguredServer}
      onConnectCandidateServer={connectCandidateServer}
      onRetryServer={() => void refreshServerConnection()}
    />
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><SidePanelApp /></StrictMode>);
