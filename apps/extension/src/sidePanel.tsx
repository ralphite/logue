import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getCaptureContext,
  getExtensionSkills,
  getExtensionSettings,
  getPageMaterials,
  getProjectSources,
  getPendingVoices,
  getPendingVoiceQueueStatus,
  createExtensionProject,
  createExtensionSkillRun,
  retryExtensionSkillRun,
  adoptExtensionSkillRun,
  adoptVoiceMaterial,
  linkVoiceComment,
  deleteMaterial,
  saveExtensionSkillRunAsDocument,
  completePendingVoice,
  connectServer,
  defaultServerURL,
  getServerURL,
  getServiceStatus,
  markPendingVoiceTranscribed,
  queuePendingVoice,
  retranscribeMaterial,
  retryPendingVoice,
  exportPendingVoice,
  deletePendingVoice,
  deleteProjectAssociation,
  saveProjectAssociation,
  saveMaterial,
  saveSelection,
  transcribeAudio,
  updateCommentBundle,
  updateSourceAnchor,
  type AppliedContext,
  type CaptureContext,
  type ExtensionSkill,
  type ExtensionSkillRun,
  ExtensionApiError,
  type PageMaterial,
  type PendingVoicePlan,
  type PendingVoiceSummary,
  type VoiceProfileOverrides,
} from "./api";
import {
  captureOrganization,
  explicitProjects,
  friendlyLocalError,
  type CommandResult,
  type LocalError,
  type PageCaptureContext,
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
import { V2SidePanelSurface } from "./v2-real/V2SidePanelSurface";
import type { VoiceCandidateRetranscribeInput, VoiceCandidateState } from "./v2-real/V2VoiceCandidateSurface";
import type { PageMaterialChanges } from "./sidePanelModels";
import "./v2-real/v2SidePanel.css";

type Phase = CapturePhase;

interface RuntimeResponse<T> { ok: boolean; value?: T; }
interface RecordingSession extends ActivePanelCaptureScope { id: string; contextPromise: Promise<CaptureContext>; overrides: VoiceProfileOverrides; }
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
  url?: string;
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

function failedSkillRun(cause: unknown) {
  return cause instanceof ExtensionApiError ? cause.run : undefined;
}

function commandSources(run: ExtensionSkillRun): CommandResult["sources"] {
  return (run.sources ?? []).map((source) => ({
    id: source.id,
    kind: source.kind,
    actor: source.actor,
    content: source.content,
    projects: source.projects ?? [],
    tags: source.tags ?? [],
    createdAt: source.created_at,
    source: source.source ?? undefined,
  }));
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
  const [voiceProfileOverrides, setVoiceProfileOverrides] = useState<VoiceProfileOverrides>({});
  const [voiceProfilePickerOpen, setVoiceProfilePickerOpen] = useState(false);
  const [voiceCandidate, setVoiceCandidate] = useState<VoiceCandidateState>();
  const [pendingVoices, setPendingVoices] = useState<PendingVoiceSummary[]>([]);
  const [retryingPendingVoiceId, setRetryingPendingVoiceId] = useState<string>();
  const [pageMaterials, setPageMaterials] = useState<PageMaterial[]>([]);
  const [generationSources, setGenerationSources] = useState<CommandResult["sources"]>([]);
  const [error, setError] = useState<LocalError>();
  const [failedPageSkillId, setFailedPageSkillId] = useState<string>();
  const [failedRun, setFailedRun] = useState<ExtensionSkillRun>();
  const [failedRunTargetKey, setFailedRunTargetKey] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const [skills, setSkills] = useState<ExtensionSkill[]>([]);
  const [skillId, setSkillId] = useState("");
  const [commandResult, setCommandResult] = useState<CommandResult>();
  const [generating, setGenerating] = useState(false);
  const [insertingGenerated, setInsertingGenerated] = useState(false);
  const [savingGeneratedDocument, setSavingGeneratedDocument] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<PendingInsert>();
  const [insertingPending, setInsertingPending] = useState(false);
  const [serverURL, setServerURL] = useState(defaultServerURL);
  const [serverURLDraft, setServerURLDraft] = useState(defaultServerURL);
  const [serverPairingCodeDraft, setServerPairingCodeDraft] = useState("");
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverConnecting, setServerConnecting] = useState(false);
  const [serverSettingsError, setServerSettingsError] = useState<string>();
  const timerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(createRequestId());
  const generationSourcesTouchedRef = useRef(false);
  const stateRef = useRef<PanelCaptureState | undefined>(undefined);
  const draftRef = useRef("");
  const transcriptRef = useRef("");
  const transcribeAndSaveRef = useRef<(blob: Blob, session?: RecordingSession) => Promise<void>>(async () => undefined);
  const lastVoiceContextRef = useRef<{ context: CaptureContext; overrides: VoiceProfileOverrides } | undefined>(undefined);
  const startRecordingRef = useRef<() => void>(() => undefined);
  const recordingSessionRef = useRef<RecordingSession | undefined>(undefined);
  const recorderRef = useRef<AudioRecorderController | undefined>(undefined);
  const stopRequestedRef = useRef(false);
  const microphonePermissionRequestRef = useRef<PendingMicrophonePermission | undefined>(undefined);
  // This remains set through transcription so a harmless panel-state refresh
  // cannot collapse the active UI.
  const activeCaptureScopeRef = useRef<ActivePanelCaptureScope | undefined>(undefined);
  const phaseRef = useRef<Phase>("idle");
  const commandResultRef = useRef<CommandResult | undefined>(undefined);
  const failedRunRef = useRef<ExtensionSkillRun | undefined>(undefined);
  const pendingInsertInFlightRef = useRef(false);
  const voiceCandidateUndoTokenRef = useRef<string | undefined>(undefined);
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
  commandResultRef.current = commandResult;
  failedRunRef.current = failedRun;

  const persistDraft = useCallback((patch: Record<string, unknown>) => {
    if (typeof panelTabId !== "number") return;
    void chrome.runtime.sendMessage({ type: "logue:update-panel-state", tabId: panelTabId, patch });
  }, []);

  const resolveActiveProject = useCallback(async (expected = stateRef.current) => {
    if (!expected || typeof panelTabId !== "number") return expected;
    const response = await chrome.runtime.sendMessage({
      type: "logue:resolve-tab-projects",
      tabId: panelTabId,
    }) as RuntimeResponse<PanelCaptureState>;
    const next = response.value;
    if (!next || next.tabId !== expected.tabId) return stateRef.current;
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const commitCommandResult = useCallback((result?: CommandResult) => {
    commandResultRef.current = result;
    setCommandResult(result);
    const current = stateRef.current;
    if (current) {
      const { commandResult: _previous, ...base } = current;
      const next = result ? { ...base, commandResult: result } : base;
      stateRef.current = next;
      setState(next);
    }
    persistDraft({ commandResult: result ?? null });
  }, [persistDraft]);

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

  const appliedContext = useCallback((captureContext: CaptureContext, overrides: VoiceProfileOverrides = {}): AppliedContext => {
    const referenceProject = explicitProjects(stateRef.current)[0];
    const profile = captureContext.resolved_voice_profile;
    return {
      page_url: stateRef.current?.source.url ?? "",
      page_title: stateRef.current?.source.title ?? "",
      reference_project: referenceProject,
      profile_project: profile.project_name || undefined,
      personal_context: profile.personal_context || undefined,
      project_overview: profile.project_overview || undefined,
      glossary: profile.vocabulary,
      voice_profile_label: profile.label,
      project_profile_mode: profile.project_mode,
      primary_language: profile.primary_language,
      mixed_languages: profile.mixed_languages,
      custom_instructions: profile.custom_instructions || undefined,
      phrases: profile.phrases,
      avoid_terms: profile.avoid_terms,
      formatting_preference: profile.formatting_preference || undefined,
      transcription_skill_id: profile.skill_id,
      transcription_skill_name: profile.skill_name,
      transcription_skill_revision: profile.skill_revision,
      transcription_skill_instructions: profile.skill_instructions,
      disable_project_profile: Boolean(overrides.disable_project_profile),
      use_default_profile: Boolean(overrides.use_default_profile),
      language_override: overrides.primary_language || undefined,
      topic_vocabulary_id: profile.topic_vocabulary_id || undefined,
      topic_vocabulary_name: profile.topic_vocabulary_name || undefined,
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

  const applySuggestedProject = useCallback(async (current: PanelCaptureState, captureContext: CaptureContext) => {
    const live = stateRef.current;
    const requestedProject = explicitProjects(current)[0] ?? "";
    if (
      !live ||
      live.tabId !== current.tabId ||
      live.source.url !== current.source.url ||
      live.updatedAt !== current.updatedAt ||
      (explicitProjects(live)[0] ?? "") !== requestedProject ||
      Boolean(live.projectExplicit) !== Boolean(current.projectExplicit)
    ) return { state: live ?? current, context: captureContext, stale: true };

    let base = current;
    if (requestedProject && !captureContext.projects.some((project) => project.name === requestedProject)) {
      base = {
        ...current,
        projects: current.projectExplicit ? [] : undefined,
        projectAssociationId: undefined,
        projectAssociationScope: undefined,
        updatedAt: Date.now(),
      };
      stateRef.current = base;
      setState(base);
      persistDraft({
        projects: current.projectExplicit ? [] : null,
        projectExplicit: Boolean(current.projectExplicit),
        projectAssociationId: null,
        projectAssociationScope: null,
      });
    }
    if (base.projectExplicit || base.projects !== undefined) return { state: base, context: captureContext, stale: false };
    const association = captureContext.project_associations?.[0];
    if (!association) return { state: base, context: captureContext, stale: false };
    const next: PanelCaptureState = {
      ...base,
      projects: [association.project_name],
      projectExplicit: false,
      projectAssociationId: association.id,
      projectAssociationScope: association.scope,
      updatedAt: Date.now(),
    };
    stateRef.current = next;
    setState(next);
    persistDraft({
      projects: next.projects,
      projectExplicit: false,
      projectAssociationId: association.id,
      projectAssociationScope: association.scope,
    });
    const resolved = await getCaptureContext(next.source.url, association.project_name, voiceProfileOverrides);
    const latest = stateRef.current;
    const stale = !latest || latest.tabId !== next.tabId || latest.source.url !== next.source.url || latest.updatedAt !== next.updatedAt || explicitProjects(latest)[0] !== association.project_name || Boolean(latest.projectExplicit);
    return { state: latest ?? next, context: resolved, stale };
  }, [persistDraft, voiceProfileOverrides]);

  const refreshServerConnection = useCallback(async (current = stateRef.current) => {
    if (!current) return;
    setServerConnecting(true);
    try {
      await getServiceStatus();
      if (stateRef.current?.tabId !== current.tabId) return;
      const resolvedState = await resolveActiveProject(current);
      if (!resolvedState || resolvedState.tabId !== current.tabId || resolvedState.source.url !== current.source.url) return;
      current = resolvedState;
      setError((active) => active?.kind === "service" ? undefined : active);
      const initialContext = await getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "", voiceProfileOverrides);
      const accepted = await applySuggestedProject(current, initialContext);
      if (accepted.stale) return;
      const activeState = accepted.state;
      const captureContext = accepted.context;
      if (stateRef.current?.tabId === activeState.tabId) setContext(captureContext);
      if (shouldLoadPageHistory(current.intent)) await refreshPageMaterials(current.source.url);
      if (activeState.intent === "generate") {
        const [available, settings] = await Promise.all([getExtensionSkills(), getExtensionSettings()]);
        if (stateRef.current?.tabId !== current.tabId) return;
        setSkills(available);
        const projectName = explicitProjects(activeState)[0];
        const projectSkill = projectName
          ? captureContext.projects.find((item) => item.name === projectName)?.skill_bindings?.command
          : undefined;
        setSkillId(available.find((item) => item.id === (projectSkill || settings.default_extension_skill))?.id ?? available[0]?.id ?? "");
      }
    } catch (cause) {
      if (stateRef.current?.tabId === current.tabId && !current.pendingInsert) {
        setError(friendlyLocalError(cause, "service"));
      }
    } finally {
      setServerConnecting(false);
    }
  }, [applySuggestedProject, refreshPageMaterials, resolveActiveProject, voiceProfileOverrides]);

  const openServerSettings = useCallback(() => {
    setServerURLDraft(serverURL);
    setServerPairingCodeDraft("");
    setServerSettingsError(undefined);
    setServerSettingsOpen(true);
  }, [serverURL]);

  const closeServerSettings = useCallback(() => {
    if (serverConnecting) return;
    setServerURLDraft(serverURL);
    setServerPairingCodeDraft("");
    setServerSettingsError(undefined);
    setServerSettingsOpen(false);
  }, [serverConnecting, serverURL]);

  const connectConfiguredServer = useCallback(() => {
    if (serverConnecting) return;
    setServerConnecting(true);
    setServerSettingsError(undefined);
    void connectServer(serverURLDraft, serverPairingCodeDraft).then(async (connected) => {
      setServerURL(connected.url);
      setServerURLDraft(connected.url);
      setServerPairingCodeDraft("");
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
  }, [pendingInsert, refreshServerConnection, serverConnecting, serverPairingCodeDraft, serverURLDraft]);

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

  const saveContent = useCallback(async (content: string, captureId?: string, rawTranscript?: string, transformedTranscript?: string, appliedContextOverride?: AppliedContext, deferFinalization = false, requestId = requestIdRef.current) => {
    const expected = stateRef.current;
    const current = await resolveActiveProject(expected);
    if (!current || !expected || current.source.url !== expected.source.url || current.intent !== expected.intent) throw new Error("The page changed before this input was saved.");
    const currentContext = appliedContextOverride
      ? undefined
      : context ?? await getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "");
    const provenance = appliedContextOverride ?? appliedContext(currentContext!);
    const organization = captureOrganization(current);
    const selectionText = current.selectionText;
    let savedId = "";
    if (selectionText) {
      const saved = await saveThenRefreshPageHistory(
        () => saveSelection({
          requestId,
          sourceContent: selectionText,
          annotation: content.trim() || undefined,
          rawTranscript: captureId ? rawTranscript : undefined,
          transcript: captureId ? transformedTranscript : undefined,
          source: { ...current.source, selection: selectionText },
          ...organization,
          captureId,
          appliedContext: provenance,
        }),
        () => refreshPageMaterials(current.source.url),
      );
      savedId = saved.annotation?.id ?? saved.source.id;
    } else {
      const voiceWrite = Boolean(captureId && current.intent === "input");
      const saved = await saveThenRefreshPageHistory(
        () => saveMaterial({
          requestId,
          kind: captureId ? "voice" : "text",
          content,
          rawTranscript: captureId ? rawTranscript : undefined,
          transcript: captureId ? transformedTranscript : undefined,
          source: current.source,
          projects: voiceWrite ? [] : organization.projects,
          suggestedProjects: voiceWrite ? organization.projects : [],
          tags: organization.tags,
          captureId,
          appliedContext: provenance,
        }),
        () => refreshPageMaterials(current.source.url),
      );
      savedId = saved.id;
      if (current.intent === "input" && !deferFinalization) {
        const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:insert-text", text: content, expectedTargetSessionId: current.targetSessionId }) as { ok?: boolean } | undefined;
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
    if (deferFinalization) return savedId;
    setPendingInsert(undefined);
    setDraft("");
    setTranscript("");
    setError(undefined);
    requestIdRef.current = createRequestId();
    persistDraft({ draft: "", transcript: "", pendingInsert: null });
    return savedId;
  }, [appliedContext, context, persistDraft, refreshPageMaterials, resolveActiveProject]);

  const transcribeAndSave = useCallback(async (blob: Blob, session?: RecordingSession) => {
    const current = stateRef.current;
    if (!current) return;
    const pendingId = session?.id ?? requestIdRef.current;
    setPhase("processing");
    setError(undefined);
    try {
      await queuePendingVoice({
        id: pendingId,
        audio: blob,
        tabId: current.tabId,
        pageUrl: current.source.url,
        pageTitle: current.source.title,
      });
      const referenceProject = explicitProjects(current)[0];
      const overrides = session?.overrides ?? voiceProfileOverrides;
      const organization = captureOrganization(current);
      const instructions = current.intent === "generate"
        ? "Transcribe this as a direct instruction for Logue. Preserve the user's requested action and output intent."
        : current.selectionText
        ? "Transcribe this as an annotation to the selected source."
        : "Transcribe this as concise text linked to the current page.";
      const commentSource = current.selectionText ? { ...current.source, selection: current.selectionText } : current.source;
      const savePlan = {
        kind: "voice",
        source: commentSource,
        projects: [],
        suggested_projects: current.intent === "input" || (current.intent !== "generate" && organization.projects.length) ? organization.projects : [],
        tags: organization.tags,
        ...(current.intent !== "input" && current.intent !== "generate" ? { comment_state: "unlinked" } : {}),
        ...(current.intent === "generate" ? { projects: [], suggested_projects: [], activity_type: "voice-command" } : {}),
      };
      await queuePendingVoice({
        id: pendingId,
        tabId: current.tabId,
        pageUrl: current.source.url,
        pageTitle: current.source.title,
        plan: {
          kind: "material",
          transcription: {
            pageUrl: current.source.url,
            pageTitle: current.source.title,
            targetText: current.intent === "input" ? current.targetText : undefined,
            selectedText: current.selectionText,
            instructions,
            profileRequest: { project: referenceProject ?? "", ...overrides },
          },
          save: savePlan,
        },
      });
      const frozen = session
        ? { context: await session.contextPromise, overrides: session.overrides }
        : lastVoiceContextRef.current ?? { context: context ?? await getCaptureContext(current.source.url, referenceProject ?? "", voiceProfileOverrides), overrides: voiceProfileOverrides };
      lastVoiceContextRef.current = frozen;
      const currentContext = frozen.context;
      const profile = currentContext.resolved_voice_profile;
      let provenance = appliedContext(currentContext, frozen.overrides);
      const plan: PendingVoicePlan = {
        kind: "material",
        transcription: {
          pageUrl: current.source.url,
          pageTitle: current.source.title,
          targetText: current.intent === "input" ? current.targetText : undefined,
          selectedText: current.selectionText,
          projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
          glossary: profile.vocabulary.join("\n"),
          instructions,
          appliedContext: provenance,
        },
        save: savePlan,
      };
      await queuePendingVoice({
        id: pendingId,
        tabId: current.tabId,
        pageUrl: current.source.url,
        pageTitle: current.source.title,
        plan,
      });
      const result = await transcribeAudio({
        requestId: pendingId,
        audio: blob,
        source: current.source,
        targetText: current.intent === "input" ? current.targetText : undefined,
        selectedText: current.selectionText,
        projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
        glossary: profile.vocabulary.join("\n"),
        instructions,
        appliedContext: provenance,
      });
      provenance = result.applied_context;
      await markPendingVoiceTranscribed({
        id: pendingId,
        captureId: result.capture_id,
        rawTranscript: result.raw_transcript,
        text: result.text,
        appliedContext: provenance,
      });
      if (current.intent === "generate") {
        const activity = await saveMaterial({
          requestId: pendingId,
          kind: "voice",
          content: result.text,
          rawTranscript: result.raw_transcript,
          transcript: result.text,
          source: current.source,
          projects: [],
          tags: [],
          captureId: result.capture_id,
          appliedContext: provenance,
          activityType: "voice-command",
        });
        await completePendingVoice(pendingId);
        setPendingVoices((items) => items.filter((item) => item.id !== pendingId));
        setTranscript(result.text);
        setDraft(result.text);
        persistDraft({ draft: result.text, transcript: result.text });
        setVoiceProfilePickerOpen(false);
        setPhase("idle");
        const project = explicitProjects(current)[0];
        if (!project) {
          setError({ kind: "save", message: "Choose a Project to use for this command.", action: "retry" });
          return;
        }
        try {
          setGenerating(true);
          const targetKey = generationTargetKey(current);
          const [projectSources, availableSkills, extensionSettings] = await Promise.all([
            getProjectSources(project, result.text),
            getExtensionSkills(),
            getExtensionSettings(),
          ]);
          if (!projectSources.length) throw new Error("This Project has no Sources yet.");
          const binding = currentContext.projects.find((item) => item.name === project)?.skill_bindings?.command;
          const resolvedSkill = availableSkills.find((item) => item.id === (binding || extensionSettings.default_extension_skill))
            || availableSkills.find((item) => item.output === "insert");
          if (!resolvedSkill) throw new Error("No Voice Command Skill is available.");
          const nextState = { ...current, generationSourceIds: projectSources.map((source) => source.id), pinnedSourceIds: [], updatedAt: Date.now() };
          stateRef.current = nextState;
          setState(nextState);
          setSkillId(resolvedSkill.id);
          persistDraft({ generationSourceIds: nextState.generationSourceIds, pinnedSourceIds: [] });
          const run = await createExtensionSkillRun({
            skillId: resolvedSkill.id,
            instruction: result.text,
            project,
            pageTitle: current.source.title,
            pageUrl: current.source.url,
            targetText: current.targetText,
            selection: current.selectionText,
            sourceIds: projectSources.map((source) => source.id),
            autoSearch: false,
            activitySourceId: activity.id,
          });
          if (run.status !== "complete" || !run.original_output?.trim()) throw new Error(run.error || "No result returned.");
          commitCommandResult({
            runId: run.id,
            originalText: run.original_output,
            text: run.original_output,
            targetKey,
            sourceURL: current.source.url,
            allowInsert: true,
            sources: (run.sources ?? []).map((source) => ({
              id: source.id,
              kind: source.kind,
              actor: source.actor,
              content: source.content,
              projects: source.projects ?? [],
              tags: source.tags ?? [],
              createdAt: source.created_at,
              source: source.source ?? undefined,
            })),
          });
          setDraft("");
          persistDraft({ draft: "" });
          setFailedRun(undefined);
          setFailedRunTargetKey(undefined);
          setError(undefined);
        } catch (cause) {
          setFailedPageSkillId(undefined);
          setFailedRun(failedSkillRun(cause));
          setFailedRunTargetKey(generationTargetKey(current));
          setError(friendlyLocalError(cause, "model"));
        } finally {
          setGenerating(false);
        }
        return;
      }
      setTranscript(result.text);
      setDraft(result.text);
      persistDraft({ draft: result.text, transcript: result.text });
      const materialId = current.intent === "input"
        ? await saveContent(result.text, result.capture_id, result.raw_transcript, result.text, provenance, true, pendingId)
        : (await saveMaterial({
            requestId: pendingId,
            kind: "voice",
            content: result.text,
            rawTranscript: result.raw_transcript,
            transcript: result.text,
            source: commentSource,
            projects: [],
            suggestedProjects: organization.projects,
            tags: organization.tags,
            captureId: result.capture_id,
            appliedContext: provenance,
            actor: "user",
            commentState: "unlinked",
          })).id;
      if (!materialId) throw new Error("The recording was transcribed but could not be saved.");
      if (current.intent !== "input") await refreshPageMaterials(current.source.url);
      await completePendingVoice(pendingId);
      setPendingVoices((items) => items.filter((item) => item.id !== pendingId));
      setVoiceCandidate({ materialId, text: result.text, revision: 1, profileLabel: provenance.voice_profile_label || profile.label, referenceProject, purpose: current.intent === "input" ? "write" : "comment" });
      setVoiceProfilePickerOpen(false);
      setPhase("idle");
    } catch {
      setError({ kind: "transcription", message: "Recording saved locally. Retry when Logue is available.", action: "retry" });
      void getPendingVoices().then(setPendingVoices).catch(() => undefined);
      setPhase("error");
    }
  }, [appliedContext, commitCommandResult, context, persistDraft, refreshPageMaterials, saveContent, voiceProfileOverrides]);

  const dismissVoiceCandidate = useCallback(() => {
    setVoiceCandidate(undefined);
    voiceCandidateUndoTokenRef.current = undefined;
    setVoiceProfileOverrides({});
    setVoiceProfilePickerOpen(false);
    setDraft("");
    setTranscript("");
    setError(undefined);
    requestIdRef.current = createRequestId();
    persistDraft({ draft: "", transcript: "" });
  }, [persistDraft]);

  const finishVoiceComment = useCallback(async () => {
    const current = stateRef.current;
    const candidate = voiceCandidate;
    const sourceContent = current?.selectionText?.trim() || current?.pageText?.trim() || current?.source.title.trim();
    if (!current || !candidate || candidate.purpose !== "comment" || !candidate.text.trim() || !sourceContent || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      const organization = captureOrganization(current);
      await linkVoiceComment(candidate.materialId, {
        content: candidate.text.trim(),
        sourceContent,
        source: current.selectionText ? { ...current.source, selection: current.selectionText } : current.source,
        projects: organization.projects,
        tags: organization.tags,
      });
      await refreshPageMaterials(current.source.url);
      dismissVoiceCandidate();
    } catch (cause) {
      setVoiceCandidate((value) => value ? { ...value, busy: false, error: cause instanceof Error ? cause.message : "Could not finish this comment." } : value);
    }
  }, [dismissVoiceCandidate, refreshPageMaterials, voiceCandidate]);

  const deleteVoiceComment = useCallback(async () => {
    const current = stateRef.current;
    const candidate = voiceCandidate;
    if (!current || !candidate || candidate.purpose !== "comment" || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      await deleteMaterial(candidate.materialId);
      await refreshPageMaterials(current.source.url);
      dismissVoiceCandidate();
    } catch (cause) {
      setVoiceCandidate((value) => value ? { ...value, busy: false, error: cause instanceof Error ? cause.message : "Could not delete this comment." } : value);
    }
  }, [dismissVoiceCandidate, refreshPageMaterials, voiceCandidate]);

  const insertVoiceCandidate = useCallback(async () => {
    const current = stateRef.current;
    const candidate = voiceCandidate;
    const text = candidate?.text.trim() ?? "";
    if (!current || !candidate || !text || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:insert-text", text, expectedTargetSessionId: current.targetSessionId }) as { ok?: boolean; undoToken?: string } | undefined;
      if (!response?.ok || !response.undoToken) throw new Error("The original input is no longer available. Copy the saved text instead.");
      voiceCandidateUndoTokenRef.current = response.undoToken;
      const adoptionId = createRequestId();
      const adoptionTarget = { surface: "side-panel-voice", url: current.source.url, target_key: generationTargetKey(current) };
      setVoiceCandidate((value) => value ? { ...value, text, busy: true, inserted: true, copied: false, canUndo: true, adoptionId, adoptionPending: "insert", adoptionTarget, undoNeedsInsert: false, error: undefined } : value);
      try {
        await adoptVoiceMaterial(candidate.materialId, { adoptionId, action: "insert", content: text, target: adoptionTarget });
        setVoiceCandidate((value) => value && value.adoptionId === adoptionId ? { ...value, busy: false, adoptionPending: undefined, error: undefined } : value);
      } catch (cause) {
        setVoiceCandidate((value) => value && value.adoptionId === adoptionId ? { ...value, busy: false, adoptionPending: "insert", error: cause instanceof Error ? `Inserted, but Logue could not record it: ${cause.message}` : "Inserted, but Logue could not record it." } : value);
      }
    } catch (cause) {
      setVoiceCandidate((value) => value ? { ...value, busy: false, error: cause instanceof Error ? cause.message : "Could not insert this text." } : value);
    }
  }, [voiceCandidate]);

  const copyVoiceCandidate = useCallback(async () => {
    const current = stateRef.current;
    const candidate = voiceCandidate;
    if (!current || !candidate || !candidate.text.trim() || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      await navigator.clipboard.writeText(candidate.text);
      const adoptionId = createRequestId();
      const adoptionTarget = { surface: "clipboard", url: current.source.url, target_key: generationTargetKey(current) };
      setVoiceCandidate((value) => value ? { ...value, copied: true, inserted: false, canUndo: false, adoptionId, adoptionPending: "copy", adoptionTarget, undoNeedsInsert: false, error: undefined } : value);
      try {
        await adoptVoiceMaterial(candidate.materialId, { adoptionId, action: "copy", content: candidate.text, target: adoptionTarget });
        setVoiceCandidate((value) => value && value.adoptionId === adoptionId ? { ...value, busy: false, adoptionPending: undefined, error: undefined } : value);
      } catch (cause) {
        setVoiceCandidate((value) => value && value.adoptionId === adoptionId ? { ...value, busy: false, adoptionPending: "copy", error: cause instanceof Error ? `Copied, but Logue could not record it: ${cause.message}` : "Copied, but Logue could not record it." } : value);
      }
    } catch (cause) {
      setVoiceCandidate((value) => value ? { ...value, busy: false, error: cause instanceof Error ? cause.message : "Could not copy this text." } : value);
    }
  }, [voiceCandidate]);

  const undoVoiceCandidate = useCallback(async () => {
    const current = stateRef.current;
    const token = voiceCandidateUndoTokenRef.current;
    const candidate = voiceCandidate;
    if (!current || !token || !candidate?.adoptionId || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:undo-insert", token }) as { ok?: boolean } | undefined;
      if (!response?.ok) throw new Error("The page changed, so this insert can’t be undone.");
      voiceCandidateUndoTokenRef.current = undefined;
      const undoNeedsInsert = candidate.adoptionPending === "insert";
      setVoiceCandidate((value) => value ? { ...value, inserted: false, canUndo: false, adoptionPending: "undo", undoNeedsInsert, error: undefined } : value);
      try {
        if (undoNeedsInsert) {
          await adoptVoiceMaterial(candidate.materialId, { adoptionId: candidate.adoptionId, action: "insert", content: candidate.text, target: candidate.adoptionTarget });
        }
        await adoptVoiceMaterial(candidate.materialId, { adoptionId: candidate.adoptionId, undone: true });
        setVoiceCandidate((value) => value && value.adoptionId === candidate.adoptionId ? { ...value, busy: false, adoptionPending: undefined, undoNeedsInsert: false, error: undefined } : value);
      } catch (cause) {
        setVoiceCandidate((value) => value && value.adoptionId === candidate.adoptionId ? { ...value, busy: false, adoptionPending: "undo", error: cause instanceof Error ? `Text was removed, but Logue could not record Undo: ${cause.message}` : "Text was removed, but Logue could not record Undo." } : value);
      }
    } catch (cause) {
      setVoiceCandidate((value) => value ? { ...value, busy: false, canUndo: false, error: cause instanceof Error ? cause.message : "Could not undo this insert." } : value);
    }
  }, [voiceCandidate]);

  const retryVoiceCandidateAdoption = useCallback(async () => {
    const current = stateRef.current;
    const candidate = voiceCandidate;
    if (!current || !candidate?.adoptionId || !candidate.adoptionPending || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      if (candidate.adoptionPending === "undo") {
        if (candidate.undoNeedsInsert) {
          await adoptVoiceMaterial(candidate.materialId, { adoptionId: candidate.adoptionId, action: "insert", content: candidate.text, target: candidate.adoptionTarget });
        }
        await adoptVoiceMaterial(candidate.materialId, { adoptionId: candidate.adoptionId, undone: true });
      } else {
        await adoptVoiceMaterial(candidate.materialId, { adoptionId: candidate.adoptionId, action: candidate.adoptionPending === "copy" ? "copy" : "insert", content: candidate.text, target: candidate.adoptionTarget });
      }
      setVoiceCandidate((value) => value && value.adoptionId === candidate.adoptionId ? { ...value, busy: false, adoptionPending: undefined, undoNeedsInsert: false, error: undefined } : value);
    } catch (cause) {
      setVoiceCandidate((value) => value && value.adoptionId === candidate.adoptionId ? { ...value, busy: false, error: cause instanceof Error ? cause.message : "Could not record this adoption." } : value);
    }
  }, [voiceCandidate]);

  const retranscribeVoiceCandidate = useCallback(async (input: VoiceCandidateRetranscribeInput) => {
    const current = stateRef.current;
    const candidate = voiceCandidate;
    if (!current || !candidate || candidate.busy) return;
    setVoiceCandidate((value) => value ? { ...value, busy: true, error: undefined } : value);
    try {
      const [result, nextContext] = await Promise.all([
        retranscribeMaterial(candidate.materialId, { referenceProject: explicitProjects(current)[0] ?? "", profileOverrides: voiceProfileOverrides, correction: input.correction }),
        getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "", voiceProfileOverrides),
      ]);
      setContext(nextContext);
      setDraft(result.revision.transcript);
      setTranscript(result.revision.transcript);
      persistDraft({ draft: result.revision.transcript, transcript: result.revision.transcript });
      voiceCandidateUndoTokenRef.current = undefined;
      setVoiceCandidate((value) => value ? { ...value, text: result.revision.transcript, revision: result.revision.revision, profileLabel: result.revision.applied_context.voice_profile_label || value.profileLabel, busy: false, inserted: false, copied: false, canUndo: false, adoptionId: undefined, adoptionPending: undefined, adoptionTarget: undefined, undoNeedsInsert: false, error: undefined } : value);
    } catch (cause) {
      setVoiceCandidate((value) => value ? { ...value, busy: false, error: cause instanceof Error ? cause.message : "Could not re-transcribe this recording." } : value);
    }
  }, [persistDraft, voiceCandidate, voiceProfileOverrides]);

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
        void transcribeAndSaveRef.current(blob, session).finally(() => {
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
    if ((voiceCandidate && stateRef.current?.intent !== "generate") || phaseRef.current === "starting" || phaseRef.current === "recording" || phaseRef.current === "processing") return;
    phaseRef.current = "starting";
    setPhase("starting");
    setError(undefined);
    setPendingInsert(undefined);
    setVoiceProfilePickerOpen(false);
    void getPendingVoiceQueueStatus().then((status) => {
      if (!status.writable) throw new Error(status.reason || "Clear a saved recording before recording again.");
      return resolveActiveProject();
    }).then((current) => {
      if (!current || phaseRef.current !== "starting") return;
      const overrides = { ...voiceProfileOverrides };
      const contextPromise = getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "", overrides);
      const session = { id: createRequestId(), tabId: current.tabId, intent: current.intent, contextPromise, overrides };
      recordingSessionRef.current = session;
      activeCaptureScopeRef.current = session;
      stopRequestedRef.current = false;
      void contextPromise.then((captureContext) => {
        if (recordingSessionRef.current?.id === session.id) setContext(captureContext);
      }).catch(() => undefined);
      void recorder().start();
    }).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : "Could not start recording.";
      setError(/saved recordings|clear a saved recording|cannot save another recording/i.test(message)
        ? { kind: "save", message, action: "retry" }
        : friendlyLocalError(cause, "service"));
      setPhase("error");
    });
  }, [recorder, resolveActiveProject, voiceCandidate, voiceProfileOverrides]);

  startRecordingRef.current = startRecording;

  const runGeneration = useCallback(async () => {
    const snapshot = stateRef.current;
    if (!snapshot || !skillId || !draft.trim()) return;
    setGenerating(true);
    setError(undefined);
    let targetKey = generationTargetKey(snapshot);
    try {
      const current = await resolveActiveProject(snapshot);
      if (!current || current.source.url !== snapshot.source.url) throw new Error("The page changed before this Draft started.");
      targetKey = generationTargetKey(current);
      const activity = await saveMaterial({
        requestId: createRequestId(),
        kind: "text",
        content: draft.trim(),
        source: current.source,
        projects: [],
        tags: [],
        activityType: "text-command",
      });
      const run = await createExtensionSkillRun({
        skillId,
        instruction: draft.trim(),
        project: explicitProjects(current)[0],
        pageTitle: current.source.title,
        pageUrl: current.source.url,
        targetText: current.targetText,
        selection: current.selectionText,
        sourceIds: [
          ...(current.pinnedSourceIds ?? []).filter((id) => current.generationSourceIds?.includes(id)),
          ...(current.generationSourceIds ?? []).filter((id) => !(current.pinnedSourceIds ?? []).includes(id)),
        ],
        autoSearch: false,
        activitySourceId: activity.id,
      });
      if (run.status !== "complete" || !run.original_output?.trim()) throw new Error(run.error || "No result returned");
      commitCommandResult({
        runId: run.id,
        originalText: run.original_output,
        text: run.original_output,
        targetKey,
        sourceURL: current.source.url,
        allowInsert: true,
        sources: (run.sources ?? []).map((source) => ({
          id: source.id,
          kind: source.kind,
          actor: source.actor,
          content: source.content,
          projects: source.projects ?? [],
          tags: source.tags ?? [],
          createdAt: source.created_at,
          source: source.source ?? undefined,
        })),
      });
      setFailedPageSkillId(undefined);
      setFailedRun(undefined);
      setFailedRunTargetKey(undefined);
    } catch (cause) {
      setFailedPageSkillId(undefined);
      setFailedRun(failedSkillRun(cause));
      setFailedRunTargetKey(targetKey);
      setError(friendlyLocalError(cause, "model"));
    } finally {
      setGenerating(false);
    }
  }, [commitCommandResult, draft, resolveActiveProject, skillId]);

  const runPageSkill = useCallback(async (requestedSkillId: string) => {
    const snapshot = stateRef.current;
    const skill = skills.find((item) => item.id === requestedSkillId);
    const input = snapshot?.selectionText?.trim() || snapshot?.pageText?.trim();
    if (!snapshot || !skill || !input || generating) return;
    setGenerating(true);
    setError(undefined);
    try {
      const current = await resolveActiveProject(snapshot);
      if (!current || current.source.url !== snapshot.source.url) throw new Error("The page changed before this action started.");
      const organization = captureOrganization(current);
      const sourceId = current.selectionText?.trim()
        ? (await saveSelection({
          requestId: createRequestId(),
          sourceContent: current.selectionText.trim(),
          source: { ...current.source, selection: current.selectionText.trim() },
          projects: organization.projects,
          tags: organization.tags,
        })).source.id
        : (await saveMaterial({
          requestId: createRequestId(),
          kind: "selection",
          content: input,
          source: current.source,
          projects: organization.projects,
          tags: organization.tags,
          actor: "web",
        })).id;
      const run = await createExtensionSkillRun({
        skillId: skill.id,
        instruction: `Apply ${skill.name} to the current ${current.selectionText ? "selection" : "page"}.`,
        project: explicitProjects(current)[0],
        pageTitle: current.source.title,
        pageUrl: current.source.url,
        selection: current.selectionText,
        sourceIds: [sourceId],
        autoSearch: false,
      });
      if (run.status !== "complete" || !run.original_output?.trim()) throw new Error(run.error || "No result returned.");
      commitCommandResult({
        runId: run.id,
        originalText: run.original_output,
        text: run.original_output,
        targetKey: `page-action:${current.source.url}`,
        sourceURL: current.source.url,
        allowInsert: false,
        sources: (run.sources ?? []).map((source) => ({
          id: source.id,
          kind: source.kind,
          actor: source.actor,
          content: source.content,
          projects: source.projects ?? [],
          tags: source.tags ?? [],
          createdAt: source.created_at,
          source: source.source ?? undefined,
        })),
      });
      setFailedPageSkillId(undefined);
      setFailedRun(undefined);
      setFailedRunTargetKey(undefined);
    } catch (cause) {
      setFailedPageSkillId(requestedSkillId);
      setFailedRun(failedSkillRun(cause));
      setFailedRunTargetKey(`page-action:${snapshot.source.url}`);
      setError(friendlyLocalError(cause, "model"));
    } finally {
      setGenerating(false);
    }
  }, [commitCommandResult, generating, resolveActiveProject, skills]);

  const retryFailedSkillRun = useCallback(async () => {
    const snapshot = stateRef.current;
    if (!snapshot || !failedRun) return;
    setGenerating(true);
    setError(undefined);
    try {
      const current = (await resolveActiveProject(snapshot)) ?? snapshot;
      const run = await retryExtensionSkillRun(failedRun);
      if (run.status !== "complete" || !run.original_output?.trim()) {
        throw new Error(run.error || "No result returned.");
      }
      const isPageAction = Boolean(failedPageSkillId);
      const targetMatches = Boolean(failedRunTargetKey) && canInsertGeneratedText(current, failedRunTargetKey);
      commitCommandResult({
        runId: run.id,
        originalText: run.original_output,
        text: run.original_output,
        targetKey: failedRunTargetKey ?? (isPageAction ? `page-action:${failedRun.page_url || current.source.url}` : generationTargetKey(current)),
        sourceURL: failedRun.page_url || current.source.url,
        allowInsert: !isPageAction && targetMatches,
        sources: commandSources(run),
      });
      setFailedRun(undefined);
      setFailedPageSkillId(undefined);
      setFailedRunTargetKey(undefined);
    } catch (cause) {
      setFailedRun(failedSkillRun(cause) ?? failedRun);
      setError(friendlyLocalError(cause, "model"));
    } finally {
      setGenerating(false);
    }
  }, [commitCommandResult, failedPageSkillId, failedRun, failedRunTargetKey, resolveActiveProject]);

  const captureCurrentPage = useCallback(async () => {
    const snapshot = stateRef.current;
    const content = snapshot?.selectionText?.trim() || snapshot?.pageText?.trim();
    if (!snapshot || !content) return;
    setGenerating(true); setError(undefined);
    try {
      const current = await resolveActiveProject(snapshot);
      if (!current || current.source.url !== snapshot.source.url) throw new Error("The page changed before it was saved.");
      const organization = captureOrganization(current);
      if (current.selectionText?.trim()) await saveSelection({ requestId: createRequestId(), sourceContent: current.selectionText.trim(), source: { ...current.source, selection: current.selectionText.trim() }, projects: organization.projects, tags: organization.tags });
      else await saveMaterial({ requestId: createRequestId(), kind: "selection", content, source: current.source, projects: organization.projects, tags: organization.tags, actor: "web" });
      await refreshPageMaterials(current.source.url);
    } catch (cause) { setError(friendlyLocalError(cause, "save")); }
    finally { setGenerating(false); }
  }, [refreshPageMaterials, resolveActiveProject]);

  const selectGenerationSources = useCallback((ids: string[]) => {
    const current = stateRef.current;
    if (!current) return;
    generationSourcesTouchedRef.current = true;
    const generationSourceIds = Array.from(new Set(ids));
    const pinnedSourceIds = (current.pinnedSourceIds ?? []).filter((id) => generationSourceIds.includes(id));
    const next = { ...current, generationSourceIds, pinnedSourceIds, updatedAt: Date.now() };
    stateRef.current = next;
    setState(next);
    persistDraft({ generationSourceIds, pinnedSourceIds });
  }, [persistDraft]);

  const pinGenerationSource = useCallback((id: string) => {
    const current = stateRef.current;
    if (!current) return;
    generationSourcesTouchedRef.current = true;
    const selected = Array.from(new Set([...(current.generationSourceIds ?? []), id]));
    const pinned = current.pinnedSourceIds?.includes(id)
      ? current.pinnedSourceIds.filter((value) => value !== id)
      : [id, ...(current.pinnedSourceIds ?? [])];
    const next = { ...current, generationSourceIds: selected, pinnedSourceIds: pinned, updatedAt: Date.now() };
    stateRef.current = next;
    setState(next);
    persistDraft({ generationSourceIds: selected, pinnedSourceIds: pinned });
  }, [persistDraft]);

  const useGeneratedText = useCallback(async () => {
    const current = stateRef.current;
    const result = commandResultRef.current;
    if (!current || !result?.text.trim() || result.allowInsert === false || result.adoptionPending || insertingGenerated) return;
    setInsertingGenerated(true);
    setError(undefined);
    try {
      const pageResponse = await chrome.tabs.sendMessage(current.tabId, {
        type: "logue:get-page-context",
      }) as { ok?: boolean; value?: PageCaptureContext } | undefined;
      const pageContext = pageResponse?.value;
      const liveTarget = pageResponse?.ok && pageContext ? {
        ...current,
        source: pageContext.source,
        selectionText: pageContext.selectionText,
        targetText: pageContext.targetText,
        targetSessionId: pageContext.targetSessionId,
        targetAvailable: pageContext.targetAvailable,
      } : undefined;
      if (!liveTarget || !canInsertGeneratedText(liveTarget, result.targetKey)) {
        throw new Error("target unavailable");
      }
      const response = await chrome.tabs.sendMessage(current.tabId, {
        type: "logue:insert-text",
        text: result.text.trim(),
        expectedTargetSessionId: liveTarget.targetSessionId,
      }) as { ok?: boolean; undoToken?: string } | undefined;
      if (!response?.ok || !response.undoToken) throw new Error("target unavailable");
      const inserted = { ...result, undoToken: response.undoToken, adoptionId: response.undoToken, adoptionPending: "insert" as const, undoNeedsInsert: false };
      commitCommandResult(inserted);
      try {
        const adoptedRun = await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "insert", adoptionId: inserted.adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
        const adopted = { ...inserted, materialId: adoptedRun.material_id, adopted: true, adoptionPending: undefined };
        commitCommandResult(adopted);
      } catch (cause) {
        setError(friendlyLocalError(cause, "save"));
      }
      setDraft("");
    } catch (cause) {
      setError(/target unavailable/i.test(String(cause))
        ? { kind: "target", message: "The original editor is unavailable. Your draft is still saved here.", action: "copy" }
        : friendlyLocalError(cause, "save"));
    } finally {
      setInsertingGenerated(false);
    }
  }, [commitCommandResult, insertingGenerated]);

  const retryGeneratedAdoption = useCallback(async () => {
    const current = stateRef.current;
    const result = commandResultRef.current;
    if (!current || !result?.adoptionPending || !result.adoptionId || insertingGenerated) return;
    if (result.adoptionPending === "insert" && !result.undoToken) return;
    setInsertingGenerated(true);
    setError(undefined);
    try {
      let adoptedRun;
      if (result.adoptionPending === "undo") {
        if (result.undoNeedsInsert) {
          adoptedRun = await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "insert", adoptionId: result.adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
        }
        adoptedRun = await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "undo", adoptionId: result.adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
      } else {
        adoptedRun = await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "insert", adoptionId: result.adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
      }
      commitCommandResult({ ...result, materialId: adoptedRun.material_id, adopted: true, adoptionPending: undefined, undoNeedsInsert: false });
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
    } finally {
      setInsertingGenerated(false);
    }
  }, [commitCommandResult, insertingGenerated]);

  const keepGeneratedText = useCallback(async () => {
    const current = stateRef.current;
    const result = commandResultRef.current;
    if (!current || !result?.text.trim() || result.adoptionPending) return;
    setError(undefined);
    const content = result.text.trim();
    const previousAttempt = result.adoptionAttempts?.keep;
    const adoptionId = previousAttempt?.content === content ? previousAttempt.id : createRequestId();
    const pendingResult = { ...result, adoptionAttempts: { ...result.adoptionAttempts, keep: { id: adoptionId, content } } };
    commitCommandResult(pendingResult);
    try {
      const adoptedRun = await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "keep", adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
      commitCommandResult({ ...pendingResult, materialId: adoptedRun.material_id, adopted: true, adoptionAttempts: { ...pendingResult.adoptionAttempts, keep: undefined } });
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
    }
  }, [commitCommandResult]);

  const undoGeneratedText = useCallback(async () => {
    const current = stateRef.current;
    const result = commandResultRef.current;
    if (!current || !result?.undoToken || !result.adoptionId) return;
    const adoptionId = result.adoptionId;
    try {
      const response = await chrome.tabs.sendMessage(current.tabId, {
        type: "logue:undo-insert",
        token: result.undoToken,
      }) as { ok?: boolean } | undefined;
      if (!response?.ok) {
        const { undoToken: _expired, ...withoutUndo } = result;
        commitCommandResult(withoutUndo);
        throw new Error("target unavailable");
      }
      const undoNeedsInsert = result.adoptionPending === "insert";
      const { undoToken: _consumed, adoptionPending: _pending, ...restored } = result;
      const pendingUndo = { ...restored, adoptionPending: "undo" as const, undoNeedsInsert };
      commitCommandResult(pendingUndo);
      if (undoNeedsInsert) {
        await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "insert", adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
      }
      await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "undo", adoptionId, target: { surface: "side-panel", url: result.sourceURL, target_key: result.targetKey } });
      commitCommandResult({ ...pendingUndo, adoptionPending: undefined, undoNeedsInsert: false });
      setError(undefined);
    } catch (cause) {
      setError(/target unavailable/i.test(String(cause)) ? { kind: "target", message: "The editor changed, so Logue didn’t undo it. Your draft is still saved here.", action: "copy" } : friendlyLocalError(cause, "save"));
    }
  }, [commitCommandResult]);

  const copyGeneratedText = useCallback(async () => {
    const result = commandResultRef.current;
    if (!result?.text.trim() || result.adoptionPending) return;
    try {
      await navigator.clipboard.writeText(result.text.trim());
      const current = stateRef.current;
      if (!current) return;
      const content = result.text.trim();
      const previousAttempt = result.adoptionAttempts?.copy;
      const adoptionId = previousAttempt?.content === content ? previousAttempt.id : createRequestId();
      const pendingResult = { ...result, adoptionAttempts: { ...result.adoptionAttempts, copy: { id: adoptionId, content } } };
      commitCommandResult(pendingResult);
      const adoptedRun = await adoptExtensionSkillRun(result.runId, result.text.trim(), { action: "copy", adoptionId, target: { surface: "clipboard", url: result.sourceURL, target_key: result.targetKey } });
      commitCommandResult({ ...pendingResult, materialId: adoptedRun.material_id, adopted: true, adoptionAttempts: { ...pendingResult.adoptionAttempts, copy: undefined } });
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
    }
  }, [commitCommandResult]);

  const saveGeneratedDocument = useCallback(async () => {
    const current = stateRef.current;
    const result = commandResultRef.current;
    if (!current || !result?.text.trim() || result.adoptionPending || savingGeneratedDocument) return;
    setSavingGeneratedDocument(true);
    setError(undefined);
    const content = result.text.trim();
    const previousAttempt = result.adoptionAttempts?.document;
    const adoptionId = previousAttempt?.content === content ? previousAttempt.id : createRequestId();
    const pendingResult = { ...result, adoptionAttempts: { ...result.adoptionAttempts, document: { id: adoptionId, content } } };
    commitCommandResult(pendingResult);
    try {
      const created = await saveExtensionSkillRunAsDocument(result.runId, {
        title: draft.trim().split("\n")[0]?.slice(0, 72) || `${current.source.title || "Logue"} draft`,
        content: result.text.trim(),
        adoptionId,
      });
      if (!created.document.id) throw new Error("Could not save this Document.");
      commitCommandResult({ ...pendingResult, adopted: true, adoptionAttempts: { ...pendingResult.adoptionAttempts, document: undefined } });
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
    } finally {
      setSavingGeneratedDocument(false);
    }
  }, [commitCommandResult, draft, savingGeneratedDocument]);

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
    phaseRef.current = "idle";
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
        expectedTargetSessionId: current.targetSessionId,
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
    commitCommandResult(undefined);
    if (typeof panelTabId !== "number") return;
    void chrome.runtime.sendMessage({ type: "logue:request-panel-generate", tabId: panelTabId })
      .then((response: { ok?: boolean; error?: string } | undefined) => {
        if (!response?.ok) {
          setError({
            kind: "target",
            message: response?.error || "Could not open Actions for this page.",
            action: "retry",
          });
        }
      })
      .catch((cause: unknown) => setError(friendlyLocalError(cause, "target")));
  }, [commitCommandResult]);

  const selectProjects = useCallback((values: string[]) => {
    const current = stateRef.current;
    if (!current) return;
    const projects = Array.from(new Set(values.filter(Boolean)));
    const project = projects[0] ?? "";
    const next: PanelCaptureState = {
      ...current,
      projects,
      projectExplicit: true,
      projectAssociationId: undefined,
      projectAssociationScope: undefined,
      generationSourceIds: undefined,
      pinnedSourceIds: undefined,
      updatedAt: Date.now(),
    };
    stateRef.current = next;
    setState(next);
    persistDraft({ projects, projectExplicit: true, projectAssociationId: null, projectAssociationScope: null, generationSourceIds: undefined, pinnedSourceIds: undefined });
    void getCaptureContext(next.source.url, project, voiceProfileOverrides).then((captureContext) => {
      if (
        stateRef.current?.tabId === next.tabId &&
        stateRef.current.source.url === next.source.url &&
        stateRef.current.updatedAt === next.updatedAt &&
        explicitProjects(stateRef.current)[0] === (project || undefined)
      ) {
        setContext(captureContext);
        if (next.intent === "generate") {
          void getExtensionSettings().then((settings) => {
            const binding = captureContext.projects.find((item) => item.name === project)?.skill_bindings?.command;
            setSkillId((currentSkill) => skills.some((item) => item.id === (binding || settings.default_extension_skill))
              ? (binding || settings.default_extension_skill)
              : currentSkill);
          });
        }
      }
    }).catch((cause: unknown) => {
      if (stateRef.current?.tabId === next.tabId) setError(friendlyLocalError(cause, "service"));
    });
  }, [persistDraft, skills, voiceProfileOverrides]);

  const createProject = useCallback(async (name: string, overview: string) => {
    try {
      const project = await createExtensionProject(name.trim(), overview.trim());
      selectProjects([project.name]);
      setError(undefined);
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
      throw cause;
    }
  }, [selectProjects]);

  const rememberProject = useCallback(async (scope: "page" | "site") => {
    const current = stateRef.current;
    const project = explicitProjects(current)[0];
    if (!current || !project) return;
    try {
      await saveProjectAssociation({ scope, pageUrl: current.source.url, project });
      const live = stateRef.current;
      if (!live || live.tabId !== current.tabId || live.source.url !== current.source.url || live.updatedAt !== current.updatedAt || explicitProjects(live)[0] !== project) return;
      const captureContext = await getCaptureContext(current.source.url, project, voiceProfileOverrides);
      if (stateRef.current?.tabId === current.tabId && stateRef.current.source.url === current.source.url && stateRef.current.updatedAt === current.updatedAt && explicitProjects(stateRef.current)[0] === project) {
        setContext(captureContext);
        setError(undefined);
      }
    } catch (cause) {
      if (stateRef.current?.tabId === current.tabId) setError(friendlyLocalError(cause, "save"));
    }
  }, [voiceProfileOverrides]);

  const removeProjectAssociation = useCallback(async (id: string) => {
    const current = stateRef.current;
    if (!current) return;
    try {
      await deleteProjectAssociation(id);
      const live = stateRef.current;
      if (!live || live.tabId !== current.tabId || live.source.url !== current.source.url || live.updatedAt !== current.updatedAt || live.projectAssociationId !== current.projectAssociationId) return;
      const removedActiveInheritance = !current.projectExplicit && current.projectAssociationId === id;
      if (!removedActiveInheritance) {
        const captureContext = await getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "", voiceProfileOverrides);
        if (stateRef.current?.tabId === current.tabId && stateRef.current.source.url === current.source.url && stateRef.current.updatedAt === current.updatedAt) setContext(captureContext);
        return;
      }
      const base: PanelCaptureState = {
        ...current,
        projects: undefined,
        projectExplicit: false,
        projectAssociationId: undefined,
        projectAssociationScope: undefined,
        updatedAt: Date.now(),
      };
      stateRef.current = base;
      setState(base);
      persistDraft({ projects: null, projectExplicit: false, projectAssociationId: null, projectAssociationScope: null });
      const initialContext = await getCaptureContext(base.source.url, "", voiceProfileOverrides);
      const accepted = await applySuggestedProject(base, initialContext);
      if (!accepted.stale && stateRef.current?.tabId === accepted.state.tabId && stateRef.current.source.url === accepted.state.source.url) setContext(accepted.context);
    } catch (cause) {
      if (stateRef.current?.tabId === current.tabId) setError(friendlyLocalError(cause, "save"));
    }
  }, [applySuggestedProject, persistDraft, voiceProfileOverrides]);

  const updateDraftTags = useCallback((tags: string[]) => {
    const current = stateRef.current;
    if (!current) return;
    const nextTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
    const next = { ...current, tags: nextTags, updatedAt: Date.now() };
    stateRef.current = next;
    setState(next);
    persistDraft({ tags: nextTags });
  }, [persistDraft]);

  const updatePageMaterial = useCallback(async (id: string, changes: PageMaterialChanges) => {
    try {
      await updateCommentBundle(id, changes);
      const current = stateRef.current;
      if (current) await refreshPageMaterials(current.source.url);
      setError(undefined);
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
      throw cause;
    }
  }, [refreshPageMaterials]);

  const finishUnlinkedVoiceComment = useCallback(async (item: PageMaterial) => {
    const snapshot = stateRef.current;
    if (!snapshot || item.commentState !== "unlinked") return;
    const sourceContent = item.source?.selection?.trim() || snapshot.pageText?.trim() || snapshot.source.title.trim();
    if (!sourceContent) return;
    try {
      const current = await resolveActiveProject(snapshot);
      if (!current || current.source.url !== snapshot.source.url) throw new Error("The page changed before this comment was linked.");
      const organization = captureOrganization(current);
      await linkVoiceComment(item.id, { content: item.content, sourceContent, source: item.source ?? current.source, projects: organization.projects, tags: organization.tags });
      await refreshPageMaterials(current.source.url);
      setError(undefined);
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
    }
  }, [refreshPageMaterials, resolveActiveProject]);

  const deleteUnlinkedVoiceComment = useCallback(async (item: PageMaterial) => {
    const current = stateRef.current;
    if (!current || item.commentState !== "unlinked") return;
    try {
      await deleteMaterial(item.id);
      await refreshPageMaterials(current.source.url);
      setError(undefined);
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
    }
  }, [refreshPageMaterials]);

  const locatePageAnchor = useCallback(async (item: PageMaterial) => {
    const current = stateRef.current;
    if (!current || !item.source) return;
    const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:locate-page-anchor", source: item.source }) as { ok?: boolean } | undefined;
    if (!response?.ok) {
      await updateSourceAnchor(item.id, { action: "resolve", status: "page_changed", expectedRevision: item.source.anchor?.revision ?? 1 });
      await refreshPageMaterials(current.source.url);
      setError({ kind: "target", message: "The page changed. Select the new passage to re-anchor, or keep the saved snapshot.", action: "retry" });
    } else {
      setError(undefined);
    }
  }, [refreshPageMaterials]);

  const reanchorPageMaterial = useCallback(async (item: PageMaterial) => {
    const current = stateRef.current;
    if (!current) return;
    try {
      const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:get-current-selection-anchor" }) as { ok?: boolean; value?: { selection?: string; context_before?: string; context_after?: string } } | undefined;
      const quote = response?.value?.selection?.trim();
      if (!response?.ok || !quote) throw new Error("Select the matching passage on the page first.");
      await updateSourceAnchor(item.id, { action: "reanchor", expectedRevision: item.source?.anchor?.revision ?? 1, quote, contextBefore: response.value?.context_before, contextAfter: response.value?.context_after });
      await refreshPageMaterials(current.source.url);
      setError(undefined);
    } catch (cause) {
      setError({ kind: "target", message: cause instanceof Error ? cause.message : "Could not re-anchor this Source.", action: "retry" });
    }
  }, [refreshPageMaterials]);

  const keepSnapshotAnchor = useCallback(async (item: PageMaterial) => {
    const current = stateRef.current;
    if (!current) return;
    try {
      await updateSourceAnchor(item.id, { action: "snapshot_only", expectedRevision: item.source?.anchor?.revision ?? 1 });
      await refreshPageMaterials(current.source.url);
      setError(undefined);
    } catch (cause) {
      setError(friendlyLocalError(cause, "save"));
    }
  }, [refreshPageMaterials]);

  const refreshPendingVoices = useCallback(() => {
    return getPendingVoices().then(setPendingVoices).catch(() => undefined);
  }, []);

  const retrySavedRecording = useCallback(async (id: string) => {
    if (retryingPendingVoiceId) return;
    setRetryingPendingVoiceId(id);
    try {
      await retryPendingVoice(id);
      const current = stateRef.current;
      if (current) await refreshPageMaterials(current.source.url);
      setError(undefined);
    } catch {
      setError({
        kind: "transcription",
        message: "This recording is still saved locally. Reconnect Logue and retry.",
        action: "retry",
      });
    } finally {
      setRetryingPendingVoiceId(undefined);
      await refreshPendingVoices();
    }
  }, [refreshPageMaterials, refreshPendingVoices, retryingPendingVoiceId]);

  const exportSavedRecording = useCallback(async (id: string) => {
    try {
      const record = await exportPendingVoice(id);
      const bytes = Uint8Array.from(atob(record.audioBase64), (value) => value.charCodeAt(0));
      const href = URL.createObjectURL(new Blob([bytes], { type: record.mimeType }));
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `logue-recording-${new Date(record.createdAt).toISOString().replace(/[:.]/g, "-")}.webm`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
    } catch (cause) { setError(friendlyLocalError(cause, "save")); }
  }, []);

  const removeSavedRecording = useCallback(async (id: string) => {
    try { await deletePendingVoice(id); await refreshPendingVoices(); }
    catch (cause) { setError(friendlyLocalError(cause, "save")); }
  }, [refreshPendingVoices]);

  const returnToPage = useCallback(() => {
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
    const current = state;
    if (!current || current.intent !== "generate") {
      setGenerationSources([]);
      generationSourcesTouchedRef.current = false;
      return;
    }
    const project = explicitProjects(current)[0];
    if (!project) {
      setGenerationSources([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getProjectSources(project, draft.trim()).then((sources) => {
        if (cancelled || stateRef.current?.intent !== "generate" || explicitProjects(stateRef.current)[0] !== project) return;
        setGenerationSources(sources);
        if (!generationSourcesTouchedRef.current) {
          const ids = sources.map((source) => source.id);
          const next = { ...stateRef.current, generationSourceIds: ids, pinnedSourceIds: [], updatedAt: Date.now() } as PanelCaptureState;
          stateRef.current = next;
          setState(next);
          persistDraft({ generationSourceIds: ids, pinnedSourceIds: [] });
        }
      }).catch((cause: unknown) => {
        if (!cancelled) setError(friendlyLocalError(cause, "service"));
      });
    }, 240);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draft, persistDraft, state?.intent, state?.projects]);

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
      setState(next);
      generationSourcesTouchedRef.current = next.generationSourceIds !== undefined;
      setDraft(next.draft ?? "");
      setTranscript(next.transcript ?? "");
      setPendingInsert(next.pendingInsert);
      commandResultRef.current = next.commandResult;
      setCommandResult(next.commandResult);
      setContext(undefined);
      setPageMaterials([]);
      if (next.intent === "generate") {
        setVoiceCandidate(undefined);
        setSkills([]);
        setSkillId("");
      }
      if (!preserveActiveCapture) {
        setPhase("idle");
        setError((currentError) => next.pendingInsert ? {
          kind: "target",
          message: "The original editor is no longer available. Your text is saved in Logue.",
          action: "copy",
        } : failedRunRef.current ? currentError ?? {
          kind: "model",
          message: "This Run failed. Retry keeps its original Sources and activity.",
          action: "retry",
        } : next.commandResult && !canInsertGeneratedText(next, next.commandResult.targetKey) ? {
          kind: "target",
          message: "The original editor is unavailable. Your draft is still saved here.",
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
      if (panelMessage.type === "logue:pending-voices-changed") {
        void refreshPendingVoices();
      }
      if (panelMessage.type === "logue:page-anchors-changed" && panelMessage.url && panelMessage.url === stateRef.current?.source.url) {
        void refreshPageMaterials(panelMessage.url);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [cancelRecording, refreshPendingVoices, refreshServerConnection, stopTimer]);

  useEffect(() => {
    void refreshPendingVoices();
  }, [refreshPendingVoices]);

  useEffect(() => {
    void getServerURL().then((value) => {
      setServerURL(value);
      setServerURLDraft(value);
    });
  }, []);

  useEffect(() => {
    const current = stateRef.current;
    if (!current || phaseRef.current === "starting" || phaseRef.current === "recording" || phaseRef.current === "processing") return;
    void getCaptureContext(current.source.url, explicitProjects(current)[0] ?? "", voiceProfileOverrides)
      .then((value) => { if (stateRef.current?.tabId === current.tabId) setContext(value); })
      .catch(() => undefined);
  }, [voiceProfileOverrides]);

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
    <V2SidePanelSurface
      state={state}
      phase={phase}
      draft={draft}
      generatedText={commandResult?.text ?? ""}
      commandSources={commandResult?.sources}
      generationSources={generationSources}
      generationSourceIds={state?.generationSourceIds ?? []}
      pinnedSourceIds={state?.pinnedSourceIds ?? []}
      generatedUndoAvailable={Boolean(commandResult?.undoToken)}
      generatedInsertAvailable={Boolean(commandResult?.allowInsert && state && canInsertGeneratedText(state, commandResult.targetKey))}
      generatedAdoptionPending={Boolean(commandResult?.adoptionPending)}
      insertingGenerated={insertingGenerated}
      savingGeneratedDocument={savingGeneratedDocument}
      skills={skills}
      skillId={skillId}
      projects={context?.projects ?? []}
      projectAssociations={context?.project_associations ?? []}
      pageMaterials={pageMaterials}
      error={error}
      elapsed={elapsed}
      pendingInsert={pendingInsert}
      insertingPending={insertingPending}
      generating={generating}
      canRetry={false}
      pendingVoices={pendingVoices}
      retryingPendingVoiceId={retryingPendingVoiceId}
      serverURLDraft={serverURLDraft}
      serverPairingCodeDraft={serverPairingCodeDraft}
      serverCandidateURL={state?.candidateServerURL && state.candidateServerURL !== serverURL ? state.candidateServerURL : undefined}
      serverSettingsOpen={serverSettingsOpen}
      serverConnecting={serverConnecting}
      serverSettingsError={serverSettingsError}
      voiceProfileContext={context}
      voiceProfileOverrides={voiceProfileOverrides}
      voiceProfilePickerOpen={voiceProfilePickerOpen}
      voiceCandidate={voiceCandidate}
      panelRef={panelMainRef}
      onDraftChange={(value) => { setDraft(value); persistDraft({ draft: value }); }}
      onGeneratedTextChange={(text) => {
        const current = commandResultRef.current;
        if (current && !current.adoptionPending) commitCommandResult({ ...current, text, adopted: false });
      }}
      onCopyGenerated={() => void copyGeneratedText()}
      onKeepGenerated={() => void keepGeneratedText()}
      onSaveGeneratedDocument={() => void saveGeneratedDocument()}
      onUndoGenerated={() => void undoGeneratedText()}
      onRetryGeneratedAdoption={() => void retryGeneratedAdoption()}
      onSkillIdChange={setSkillId}
      onGenerationSourceIdsChange={selectGenerationSources}
      onPinGenerationSource={pinGenerationSource}
      onProjectsChange={selectProjects}
      onCreateProject={createProject}
      onRememberProject={(scope) => void rememberProject(scope)}
      onDeleteProjectAssociation={(id) => void removeProjectAssociation(id)}
      onTagsChange={updateDraftTags}
      onUpdatePageMaterial={updatePageMaterial}
      onFinishUnlinkedVoiceComment={(item) => void finishUnlinkedVoiceComment(item)}
      onDeleteUnlinkedVoiceComment={(item) => void deleteUnlinkedVoiceComment(item)}
      onLocatePageAnchor={(item) => void locatePageAnchor(item)}
      onReanchorPageMaterial={(item) => void reanchorPageMaterial(item)}
      onKeepSnapshotAnchor={(item) => void keepSnapshotAnchor(item)}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onCancelRecording={cancelRecording}
      onRetryTranscription={() => undefined}
      onRetryPendingVoice={(id) => void retrySavedRecording(id)}
      onExportPendingVoice={(id) => void exportSavedRecording(id)}
      onDeletePendingVoice={(id) => void removeSavedRecording(id)}
      onSave={() => void saveContent(draft.trim()).catch((cause) => { setError(friendlyLocalError(cause, "save")); setPhase("error"); })}
      onRequestGeneration={requestGeneration}
      onReturnToPage={returnToPage}
      onGenerate={() => void runGeneration()}
      onRunPageSkill={(id) => void runPageSkill(id)}
      onCapturePage={() => void captureCurrentPage()}
      onInsertGenerated={() => void useGeneratedText()}
      onRetryInsert={() => void retryInsert()}
      onCopyPendingInsert={() => void copyPendingInsert()}
      onServerURLDraftChange={setServerURLDraft}
      onServerPairingCodeDraftChange={setServerPairingCodeDraft}
      onOpenServerSettings={openServerSettings}
      onCloseServerSettings={closeServerSettings}
      onConnectServer={connectConfiguredServer}
      onConnectCandidateServer={connectCandidateServer}
      onRetryServer={() => void refreshServerConnection()}
      onRetryModel={() => {
        if (failedRun) void retryFailedSkillRun();
        else if (failedPageSkillId) void runPageSkill(failedPageSkillId);
        else void runGeneration();
      }}
      onOpenModelSettings={() => {
        void getServerURL().then((serverURL) =>
          chrome.tabs.create({
            url: `${serverURL.replace(/\/$/, "")}/?view=settings&section=models`,
          }),
        );
      }}
      onVoiceProfileOverridesChange={setVoiceProfileOverrides}
      onVoiceProfilePickerOpenChange={setVoiceProfilePickerOpen}
      onVoiceCandidateTextChange={(text) => {
        setVoiceCandidate((value) => value ? { ...value, text } : value);
        setDraft(text);
        persistDraft({ draft: text });
      }}
      onVoiceCandidateRetranscribe={(input) => void retranscribeVoiceCandidate(input)}
      onVoiceCandidateInsert={() => void (voiceCandidate?.purpose === "comment" ? finishVoiceComment() : insertVoiceCandidate())}
      onVoiceCandidateCopy={() => void copyVoiceCandidate()}
      onVoiceCandidateUndo={() => void undoVoiceCandidate()}
      onVoiceCandidateRetryAdoption={() => void retryVoiceCandidateAdoption()}
      onVoiceCandidateDelete={() => void deleteVoiceComment()}
      onVoiceCandidateDismiss={dismissVoiceCandidate}
    />
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><SidePanelApp /></StrictMode>);
