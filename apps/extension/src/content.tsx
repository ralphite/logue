import { SelectionActionCandidate, SelectionSkillMenu, captureStableEditableSelection, normalizeSelectionSkillReplacement, replaceSelectionWithUndoIfUnchanged, saveSelectionSkillHistory, selectionSkillDismissalStillApplies, selectionSkillEligibility, type EditableSelectionSnapshot, type ExtensionInputTarget, type ExtensionTargetBridgeRequest, type ExtensionTargetBridgeResponse, type SelectionSkillApplyTransaction, type SelectionSkillReplacementTransaction, type SourceInfo } from "@logue/ui";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionApiError, adoptExtensionSkillRun, adoptVoiceMaterial, cancelMaterialSave, completePendingVoice, createExtensionSkillRun, getCaptureContext, getExtensionDocuments, getExtensionSettings, getExtensionSkills, getPageMaterials, getPendingVoiceQueueStatus, getServerURL, markPendingVoiceTranscribed, queuePendingVoice, retranscribeMaterial, retryExtensionSkillRun, saveExtensionSkillRunAsDocument, saveMaterial, saveSelection, transcribeAudio, updateMaterial, updateSourceAnchor, type AppliedContext, type CaptureContext, type ExtensionDocument, type ExtensionSkill, type ExtensionSkillRun, type PendingVoicePlan, type VoiceProfileOverrides } from "./api";
import { activeEditableElement, getEditableText, googleDocsEditableTarget, googleDocsEditorFrame, googleDocsEditorSurface, insertIntoElementWithUndo, isEditableElement, isEditableTargetAvailable, isGoogleDocsDocumentTarget, isGoogleDocsEditorFocused, type LocalInsertTransaction } from "./dom";
import { hasNativeSelectionSkillOwner, isLogueExtensionDisabledDocument, logueServerCandidate } from "./eligibility";
import {
  googleDocsLauncherActionMessage,
  googleDocsLauncherStateMessage,
  readGoogleDocsLauncherAction,
  readGoogleDocsLauncherState,
  type GoogleDocsLauncherAction,
  type GoogleDocsLauncherCommand,
  type GoogleDocsLauncherState,
} from "./googleDocsLauncherBridge";
import { clampLauncherPosition, defaultLauncherPosition, inlineVoiceControlMetrics, launcherErrorPlacement } from "./launcherPosition";
import type { CaptureSource, PageCaptureContext } from "./capturePrimitives";
import {
  audioBlobFromEvent,
  type RecordingBridgeEvent,
} from "./recordingBridge";
import { recordingShortcutAction } from "./recordingShortcuts";
import { createRequestId } from "./requestId";
import {
  completeSelectionActionKeep,
  prepareSelectionActionKeep,
  type SelectionActionKeepAdoption,
  type SelectionActionKeepAttempt,
} from "./selectionActionKeep";
import { shouldDismissSelectionSkills } from "./selectionSkillEscape";
import { completeSelectionVoiceInput } from "./transaction";
import { V2InlineVoiceSurface, type InlineVoicePhase } from "./v2-real/V2InlineVoiceSurface";
import { V2CommandLauncherSurface, type CommandLauncherPhase } from "./v2-real/V2CommandLauncherSurface";
import { V2VoiceCandidateSurface, type VoiceCandidateRetranscribeInput, type VoiceCandidateState } from "./v2-real/V2VoiceCandidateSurface";
import { V2SelectionSurface, type SelectionCommentPhase } from "./v2-real/V2SelectionSurface";
import styles from "./v2-real/v2ExtensionSurface.css?inline";

interface ContentRequestMessage {
  type: "logue:insert-text" | "logue:undo-insert" | "logue:get-page-context" | "logue:locate-page-anchor" | "logue:get-current-selection-anchor" | "logue:discover-input-target" | "logue:insert-external-document" | "logue:undo-external-document" | "logue:start-inline-voice" | "logue:start-voice-command" | "logue:resume-voice-command";
  text?: string;
  expectedTargetSessionId?: string;
  token?: string;
  sessionId?: string;
  source?: SourceInfo;
  instruction?: string;
  scope?: "auto" | CommandScope;
  project?: string;
  selection?: string;
  pageText?: string;
  targetText?: string;
  targetSessionId?: string;
  targetAvailable?: boolean;
  activitySourceId?: string;
  pendingVoiceId?: string;
  needsClarification?: boolean;
}

type InlineRecorderAction = "start" | "stop" | "cancel";

interface InlineRecorderEvent extends Omit<RecordingBridgeEvent, "type"> {
  type: "logue:inline-recorder-event";
}

function isInlineRecorderEvent(value: unknown): value is InlineRecorderEvent {
  return Boolean(
    value && typeof value === "object" &&
    ["started", "stopped", "cancelled", "error"].includes(String((value as { event?: unknown }).event)) &&
    typeof (value as { sessionId?: unknown }).sessionId === "string" &&
    ((value as { audioBase64?: unknown }).audioBase64 === undefined || typeof (value as { audioBase64?: unknown }).audioBase64 === "string") &&
    ((value as { mimeType?: unknown }).mimeType === undefined || typeof (value as { mimeType?: unknown }).mimeType === "string") &&
    ((value as { error?: unknown }).error === undefined || typeof (value as { error?: unknown }).error === "string"),
  );
}

interface RecordingDisposeMessage {
  type: "logue:recording-dispose";
}

type ContentMessage = ContentRequestMessage | InlineRecorderEvent | RecordingDisposeMessage;

interface InlineVoiceSession {
  id: string;
  target: HTMLElement;
  source: CaptureSource;
  targetText: string;
  projects: string[];
  context?: CaptureContext;
  contextPromise?: Promise<CaptureContext>;
  overrides: VoiceProfileOverrides;
  mode?: "write" | "command";
  commandProject?: string;
  commandSelection?: string;
  commandPageText?: string;
  commandEditableSnapshot?: EditableSelectionSnapshot;
  commandScope?: CommandScope;
  commandScopeExplicit?: boolean;
}

interface ExternalInputTargetSession {
  id: string;
  documentEpoch: string;
  target: HTMLElement;
  url: string;
  lastFocusedAt: number;
}

const externalTargetLifetime = 15 * 60 * 1_000;
const selectionSkillRecencyKey = "logue:selection-skill-recency";

function editableTargetLabel(target: HTMLElement) {
  const explicit = target.getAttribute("aria-label")?.trim()
    || target.getAttribute("placeholder")?.trim()
    || target.getAttribute("name")?.trim();
  if (explicit) return explicit;
  if (target instanceof HTMLTextAreaElement) return "Text area";
  if (target instanceof HTMLInputElement) return target.type === "search" ? "Search field" : "Text field";
  return "Editable area";
}

interface PageSelectionSnapshot {
  text: string;
  source: CaptureSource & {
    selection: string;
    context_before?: string;
    context_after?: string;
  };
  range: Range;
  anchor: DOMRect;
}

interface SelectionCommentSession {
  id: string;
  snapshot: PageSelectionSnapshot;
  projects: string[];
  context?: CaptureContext;
  contextPromise?: Promise<CaptureContext>;
  overrides: VoiceProfileOverrides;
  audio?: Blob;
}

interface GoogleDocsProxyState extends GoogleDocsLauncherState {
  anchor: DOMRect;
}

interface SelectionActionCandidateState {
  runId: string;
  skillName: string;
  text: string;
  originalText: string;
  source: CaptureSource & { selection?: string; context_before?: string; context_after?: string };
  projects: string[];
  anchor: { left: number; top: number };
  editableSnapshot?: EditableSelectionSnapshot;
  insertTarget?: HTMLElement;
  insertTargetText?: string;
  insertTargetSessionId?: string;
  sources: NonNullable<ExtensionSkillRun["sources"]>;
  adoptionAttempts?: {
    copy?: { id: string; content: string };
    keep?: SelectionActionKeepAttempt;
    document?: { id: string; content: string; targetKey?: string };
  };
  keepAdoption?: SelectionActionKeepAdoption;
  documentAdoption?: { id: string; documentId: string; documentRevision: number };
}

type CommandScope = "selection" | "page" | "project";

interface PendingCommandExecution {
  instruction: string;
  scope: CommandScope;
  project: string;
  source: CaptureSource & { selection?: string };
  selection?: string;
  pageText?: string;
  targetText: string;
  targetSessionId?: string;
  targetAvailable: boolean;
  targetElement?: HTMLElement;
  activitySourceId: string;
  anchor: { left: number; top: number };
  editableSnapshot?: EditableSelectionSnapshot;
  pendingVoiceId?: string;
  epoch: number;
  evidenceRequestId: string;
  runRequestId: string;
}

function inferredCommandScope(instruction: string, selectionAvailable: boolean, project: string): CommandScope | "conflict" {
  const normalized = instruction.toLowerCase();
  const saysSelection = /\b(selection|selected text|highlight(?:ed)?)\b|选中|所选/.test(normalized);
  const saysPage = /\b(this page|the page|webpage|article)\b|网页|页面|文章/.test(normalized);
  const saysProject = /\bproject\b|项目/.test(normalized) || Boolean(project && normalized.includes(project.toLowerCase()));
  const matches = [saysSelection ? "selection" : "", saysPage ? "page" : "", saysProject ? "project" : ""].filter(Boolean) as CommandScope[];
  if (new Set(matches).size > 1 || (saysSelection && !selectionAvailable)) return "conflict";
  return matches[0] ?? (selectionAvailable ? "selection" : "page");
}

function commandMentionsScope(instruction: string) {
  return /\b(selection|selected text|highlight(?:ed)?|this page|the page|webpage|article|project)\b|选中|所选|网页|页面|文章|项目/i.test(instruction);
}

function isCommandParseFailure(cause: unknown) {
  return cause instanceof ExtensionApiError && cause.run?.error_code === "intent_parse_failed";
}

function topLevelWindow() {
  try {
    // The Docs text event target is an about:blank child that inherits the
    // document origin. Use the actual document metadata whenever it is safe
    // to read, while keeping arbitrary cross-origin frames isolated.
    if (window.top && window.top !== window) {
      void window.top.location.href;
      return window.top;
    }
  } catch {
    // Cross-origin frames intentionally remain scoped to themselves.
  }
  return window;
}

function pageSource(): CaptureSource {
  const page = topLevelWindow();
  return {
    url: page.location.href,
    title: page.document.title || page.location.hostname,
    domain: page.location.hostname,
  };
}

const targetSessionIds = new WeakMap<HTMLElement, string>();

function targetSessionId(target: HTMLElement | null | undefined) {
  if (!target || !isEditableTargetAvailable(target)) return undefined;
  const existing = targetSessionIds.get(target);
  if (existing) return existing;
  const created = createRequestId();
  targetSessionIds.set(target, created);
  return created;
}

async function requireWritablePendingVoiceQueue(selectionText?: string) {
  const status = await getPendingVoiceQueueStatus();
  if (status.writable) return;
  const source = pageSource();
  void chrome.runtime.sendMessage({
    type: "logue:open-side-panel",
    intent: "capture",
    source,
    selectionText,
  });
  throw new Error(status.reason || "Open Logue and clear a saved recording before recording again.");
}

function frozenAppliedContext(source: CaptureSource, project: string, context: CaptureContext, overrides: VoiceProfileOverrides): AppliedContext {
  const profile = context.resolved_voice_profile;
  return {
    page_url: source.url,
    page_title: source.title,
    reference_project: project || undefined,
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
    recent_adopted_ids: context.recent_adopted_refs?.map((item) => item.id) ?? [],
    recent_adopted_texts: context.recent_adopted_refs?.map((item) => item.text) ?? context.recent_adopted,
  };
}

function staticPageSelection(): PageSelectionSnapshot | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return undefined;
  const text = selection.toString().trim();
  if (!text) return undefined;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  if (!element || element.closest("#logue-extension-host, input, textarea, [contenteditable]:not([contenteditable='false'])")) return undefined;
  const rects = range.getClientRects();
  const anchor = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
  if (!anchor.width && !anchor.height) return undefined;

  const surrounding = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const selectedIndex = surrounding.indexOf(text);
  const contextBefore = selectedIndex > 0 ? surrounding.slice(Math.max(0, selectedIndex - 240), selectedIndex).trim() : "";
  const contextAfter = selectedIndex >= 0
    ? surrounding.slice(selectedIndex + text.length, selectedIndex + text.length + 240).trim()
    : "";
  return {
    text,
    range: range.cloneRange(),
    anchor,
    source: {
      ...pageSource(),
      selection: text,
      ...(contextBefore ? { context_before: contextBefore } : {}),
      ...(contextAfter ? { context_after: contextAfter } : {}),
    },
  };
}

function refreshedSelectionAnchor(snapshot: PageSelectionSnapshot) {
  const node = snapshot.range.commonAncestorContainer;
  const connected = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element).isConnected
    : Boolean(node.parentElement?.isConnected);
  if (!connected) return undefined;
  const rects = snapshot.range.getClientRects();
  const anchor = rects.length ? rects[rects.length - 1] : snapshot.range.getBoundingClientRect();
  return anchor.width || anchor.height ? anchor : undefined;
}

function normalizedAnchorText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findPageAnchor(source?: SourceInfo) {
  const quote = normalizedAnchorText(source?.anchor?.quote || source?.selection || "");
  if (!quote || !document.body) return undefined;
  const text = { value: "", points: [] as Array<{ node: Text; offset: number }> };
  let whitespace = true;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const element = node.parentElement;
      if (!element || element.closest("#logue-extension-host, script, style, noscript, textarea, input, [contenteditable='true']")) return NodeFilter.FILTER_REJECT;
      return node.textContent?.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data;
    for (let offset = 0; offset < value.length; offset += 1) {
      const character = value[offset];
      if (/\s/.test(character)) {
        if (whitespace) continue;
        text.value += " ";
        text.points.push({ node, offset });
        whitespace = true;
      } else {
        text.value += character;
        text.points.push({ node, offset });
        whitespace = false;
      }
    }
  }
  const before = normalizedAnchorText(source?.anchor?.context_before || source?.context_before || "");
  const after = normalizedAnchorText(source?.anchor?.context_after || source?.context_after || "");
  const candidates: Array<{ index: number; score: number }> = [];
  for (let index = text.value.indexOf(quote); index >= 0; index = text.value.indexOf(quote, index + 1)) {
    const leading = text.value.slice(Math.max(0, index - before.length), index).trim();
    const trailing = text.value.slice(index + quote.length, index + quote.length + after.length).trim();
    candidates.push({ index, score: (before && leading.endsWith(before) ? 2 : 0) + (after && trailing.startsWith(after) ? 2 : 0) });
  }
  const best = candidates.sort((left, right) => right.score - left.score)[0];
  if (!best) return undefined;
  const start = text.points[best.index];
  const end = text.points[Math.min(text.points.length - 1, best.index + quote.length - 1)];
  if (!start || !end) return undefined;
  const range = document.createRange();
  range.setStart(start.node, Math.min(start.offset, start.node.length));
  range.setEnd(end.node, Math.min(end.node.length, end.offset + 1));
  return range;
}

function ExtensionLauncher() {
  const [targetRect, setTargetRect] = useState<DOMRect>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [voicePhase, setVoicePhase] = useState<InlineVoicePhase>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [pendingCopyText, setPendingCopyText] = useState("");
  const [googleDocsProxy, setGoogleDocsProxy] = useState<GoogleDocsProxyState>();
  const [selectionSnapshot, setSelectionSnapshot] = useState<EditableSelectionSnapshot>();
  const [pageSelectionSnapshot, setPageSelectionSnapshot] = useState<PageSelectionSnapshot>();
  const [selectionCommentPhase, setSelectionCommentPhase] = useState<SelectionCommentPhase>("ready");
  const [selectionCommentError, setSelectionCommentError] = useState("");
  const [selectionTextCommentOpen, setSelectionTextCommentOpen] = useState(false);
  const [selectionTextComment, setSelectionTextComment] = useState("");
  const [selectionTextCommentSaving, setSelectionTextCommentSaving] = useState(false);
  const [selectionSkills, setSelectionSkills] = useState<ExtensionSkill[]>([]);
  const [recentSelectionSkillIds, setRecentSelectionSkillIds] = useState<
    string[]
  >([]);
  const [selectionSkillNotice, setSelectionSkillNotice] = useState<{
    anchor: { left: number; top: number };
    message: string;
    history?: SelectionSkillApplyTransaction;
    undo?: {
      adoption: SelectionSkillApplyTransaction;
      replacement: SelectionSkillReplacementTransaction;
      localApplied?: boolean;
    };
  }>();
  const [focusSelectionSkillTrigger, setFocusSelectionSkillTrigger] = useState(false);
  const [voiceProfileContext, setVoiceProfileContext] = useState<CaptureContext>();
  const [voiceProfileOverrides, setVoiceProfileOverrides] = useState<VoiceProfileOverrides>({});
  const [voiceProfilePickerOpen, setVoiceProfilePickerOpen] = useState(false);
  const [voiceCandidate, setVoiceCandidate] = useState<VoiceCandidateState>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandInstruction, setCommandInstruction] = useState("");
  const [commandProject, setCommandProject] = useState("");
  const [commandScope, setCommandScope] = useState<CommandScope>("page");
  const [commandScopeExplicit, setCommandScopeExplicit] = useState(false);
  const [commandPhase, setCommandPhase] = useState<CommandLauncherPhase>("editing");
  const [commandError, setCommandError] = useState("");
  const [commandParseError, setCommandParseError] = useState(false);
  const [commandActivitySourceId, setCommandActivitySourceId] = useState<string>();
  const [commandPendingVoiceId, setCommandPendingVoiceId] = useState<string>();
  const [commandFailedRun, setCommandFailedRun] = useState<ExtensionSkillRun>();
  const [pendingCommandExecution, setPendingCommandExecution] = useState<PendingCommandExecution>();
  const [selectionActionCandidate, setSelectionActionCandidate] = useState<SelectionActionCandidateState>();
  const [candidateDocuments, setCandidateDocuments] = useState<ExtensionDocument[]>([]);
  const [selectionActionBusy, setSelectionActionBusy] = useState<"primary" | "copy" | "keep" | "document">();
  const [selectionActionError, setSelectionActionError] = useState("");
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const targetRef = useRef<HTMLElement | null>(null);
  const commandTargetRef = useRef<HTMLElement | null>(null);
  const commandEpochRef = useRef(0);
  const commandExecutionRef = useRef<PendingCommandExecution | undefined>(undefined);
  const googleDocsCommandInstructionRef = useRef<string | undefined>(undefined);
  const googleDocsCommandProjectRef = useRef<string | undefined>(undefined);
  const googleDocsCommandScopeRef = useRef<CommandScope | undefined>(undefined);
  const lastInsertUndoRef = useRef<{ token: string; transaction: LocalInsertTransaction } | undefined>(undefined);
  const externalTargetSessionRef = useRef<ExternalInputTargetSession | undefined>(undefined);
  const externalInsertUndoRef = useRef<{ token: string; sessionId: string; transaction: LocalInsertTransaction } | undefined>(undefined);
  const documentEpochRef = useRef("");
  if (!documentEpochRef.current) documentEpochRef.current = createRequestId();
  const targetPageHrefRef = useRef("");
  const voicePhaseRef = useRef<InlineVoicePhase>("idle");
  const voiceSessionRef = useRef<InlineVoiceSession | undefined>(undefined);
  const selectionSnapshotRef = useRef<EditableSelectionSnapshot | undefined>(undefined);
  const pageSelectionSnapshotRef = useRef<PageSelectionSnapshot | undefined>(undefined);
  const selectionCommentSessionRef = useRef<SelectionCommentSession | undefined>(undefined);
  const selectionCommentPhaseRef = useRef<SelectionCommentPhase>("ready");
  const pageSelectionRefreshFrameRef = useRef<number | undefined>(undefined);
  const dismissedSelectionSnapshotRef = useRef<EditableSelectionSnapshot | undefined>(undefined);
  const selectionRefreshFrameRef = useRef<number | undefined>(undefined);
  const selectionSkillsLoadedRef = useRef(false);
  const selectionNoticeTimerRef = useRef<number | undefined>(undefined);
  const startCommandVoiceRef = useRef<(projectOverride?: string, scopeOverride?: CommandScope, scopeExplicitOverride?: boolean) => void>(() => undefined);
  const runCommandExecutionRef = useRef<(execution: PendingCommandExecution) => Promise<void>>(async () => undefined);
  const eligibleSelectionSkills = selectionSkillEligibility(
    selectionSkills,
    "extension",
  ).sort((left, right) => {
    const pinOrder = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
    if (pinOrder) return pinOrder;
    const leftRecent = recentSelectionSkillIds.indexOf(left.id);
    const rightRecent = recentSelectionSkillIds.indexOf(right.id);
    if (leftRecent === -1 && rightRecent === -1) return 0;
    if (leftRecent === -1) return 1;
    if (rightRecent === -1) return -1;
    return leftRecent - rightRecent;
  });

  useEffect(() => {
    void chrome.storage.local
      .get(selectionSkillRecencyKey)
      .then((stored) => {
        const value = stored[selectionSkillRecencyKey];
        if (Array.isArray(value))
          setRecentSelectionSkillIds(
            value.filter((id): id is string => typeof id === "string"),
          );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if ((!targetRect && !pageSelectionSnapshot) || voiceSessionRef.current || selectionCommentSessionRef.current) return;
    let cancelled = false;
    void (async () => {
      const response = await chrome.runtime.sendMessage({ type: "logue:get-tab-projects" }) as { ok?: boolean; value?: string[] } | undefined;
      const project = response?.ok && Array.isArray(response.value) ? response.value[0] ?? "" : "";
      const next = await getCaptureContext(pageSource().url ?? "", project, voiceProfileOverrides);
      if (!cancelled) setVoiceProfileContext(next);
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [pageSelectionSnapshot, targetRect, voiceProfileOverrides]);

  const setSelectionCommentPhaseValue = useCallback((phase: SelectionCommentPhase) => {
    selectionCommentPhaseRef.current = phase;
    setSelectionCommentPhase(phase);
  }, []);

  const setInlineVoicePhase = useCallback((phase: InlineVoicePhase) => {
    voicePhaseRef.current = phase;
    setVoicePhase(phase);
  }, []);

  const rememberExternalTarget = useCallback((target: HTMLElement) => {
    const page = pageSource();
    const current = externalTargetSessionRef.current;
    if (current?.target === target && current.url === page.url) {
      current.lastFocusedAt = Date.now();
      return;
    }
    externalInsertUndoRef.current = undefined;
    externalTargetSessionRef.current = {
      id: createRequestId(),
      documentEpoch: documentEpochRef.current,
      target,
      url: page.url,
      lastFocusedAt: Date.now(),
    };
  }, []);

  const liveExternalTarget = useCallback(() => {
    const session = externalTargetSessionRef.current;
    if (
      !session || session.documentEpoch !== documentEpochRef.current ||
      session.url !== pageSource().url || Date.now() - session.lastFocusedAt > externalTargetLifetime ||
      !isEditableTargetAvailable(session.target)
    ) {
      externalTargetSessionRef.current = undefined;
      externalInsertUndoRef.current = undefined;
      return undefined;
    }
    return session;
  }, []);

  const externalTargetDescriptor = useCallback((session: ExternalInputTargetSession): ExtensionInputTarget => {
    const page = pageSource();
    return {
      id: session.id,
      label: editableTargetLabel(session.target),
      pageTitle: page.title,
      domain: page.domain,
      url: session.url,
      lastFocusedAt: session.lastFocusedAt,
    };
  }, []);

  const sendInlineRecorderControl = useCallback(async (sessionId: string, action: InlineRecorderAction) => {
    const response = await chrome.runtime.sendMessage({
      type: "logue:inline-recorder-control",
      action,
      sessionId,
    }) as { ok?: boolean; error?: string } | undefined;
    if (!response?.ok) throw new Error(response?.error || "Could not start voice input.");
  }, []);

  const restoreTargetFocus = useCallback((session?: InlineVoiceSession) => {
    if (!session) return;
    if (!isEditableTargetAvailable(session.target)) {
      if (targetRef.current === session.target) {
        targetRef.current = null;
        targetPageHrefRef.current = "";
        setTargetRect(undefined);
      }
      return;
    }
    window.requestAnimationFrame(() => session.target.focus({ preventScroll: true }));
  }, []);

  const cancelInlineVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session) return;
    const wasProcessing = voicePhaseRef.current === "processing";
    voiceSessionRef.current = undefined;
    void sendInlineRecorderControl(session.id, "cancel").catch(() => undefined);
    if (wasProcessing) void cancelMaterialSave(session.id).catch(() => undefined);
    setInlineVoicePhase("idle");
    setVoiceError("");
    setPendingCopyText("");
    setVoiceCandidate(undefined);
    restoreTargetFocus(session);
  }, [restoreTargetFocus, sendInlineRecorderControl, setInlineVoicePhase]);

  const clearTarget = useCallback(() => {
    // Losing focus or having an SPA replace the editor must not cancel a live
    // recording. Keep its last anchor visible; completion will save first and
    // offer Copy when the original editor can no longer accept the text.
    if (voiceSessionRef.current) {
      selectionSnapshotRef.current = undefined;
      setSelectionSnapshot(undefined);
      setKeyboardActive(false);
      return;
    }
    externalTargetSessionRef.current = undefined;
    externalInsertUndoRef.current = undefined;
    targetRef.current = null;
    targetPageHrefRef.current = "";
    setTargetRect(undefined);
    selectionSnapshotRef.current = undefined;
    setSelectionSnapshot(undefined);
    setKeyboardActive(false);
  }, []);

  const refreshTarget = useCallback(() => {
    const target = targetRef.current;
    if (!isEditableTargetAvailable(target)) {
      clearTarget();
      return;
    }
    setTargetRect(target.getBoundingClientRect());
  }, [clearTarget]);

  const refreshSelectionSkillTarget = useCallback(() => {
    const target = targetRef.current;
    if (
      !isEditableTargetAvailable(target) ||
      hasNativeSelectionSkillOwner(target)
    ) {
      selectionSnapshotRef.current = undefined;
      setSelectionSnapshot(undefined);
      return;
    }
    const next = captureStableEditableSelection(target, selectionSnapshotRef.current);
    if (selectionSkillDismissalStillApplies(dismissedSelectionSnapshotRef.current, next)) {
      selectionSnapshotRef.current = undefined;
      setSelectionSnapshot(undefined);
      return;
    }
    if (next) dismissedSelectionSnapshotRef.current = undefined;
    selectionSnapshotRef.current = next;
    setSelectionSnapshot(next);
    if (!next || selectionSkillsLoadedRef.current) return;
    selectionSkillsLoadedRef.current = true;
    void getExtensionSkills().then(setSelectionSkills).catch(() => {
      selectionSkillsLoadedRef.current = false;
    });
  }, []);

  const scheduleSelectionSkillRefresh = useCallback(() => {
    if (selectionRefreshFrameRef.current !== undefined) {
      window.cancelAnimationFrame(selectionRefreshFrameRef.current);
    }
    selectionRefreshFrameRef.current = window.requestAnimationFrame(() => {
      selectionRefreshFrameRef.current = undefined;
      refreshSelectionSkillTarget();
    });
  }, [refreshSelectionSkillTarget]);

  const dismissSelectionSkills = useCallback(() => {
    if (selectionRefreshFrameRef.current !== undefined) {
      window.cancelAnimationFrame(selectionRefreshFrameRef.current);
      selectionRefreshFrameRef.current = undefined;
    }
    if (selectionSnapshotRef.current) {
      dismissedSelectionSnapshotRef.current = selectionSnapshotRef.current;
    }
    selectionSnapshotRef.current = undefined;
    setSelectionSnapshot(undefined);
    setFocusSelectionSkillTrigger(false);
  }, []);

  const showSelectionSkillNotice = useCallback((notice: {
    anchor: { left: number; top: number };
    message: string;
    history?: SelectionSkillApplyTransaction;
    undo?: {
      adoption: SelectionSkillApplyTransaction;
      replacement: SelectionSkillReplacementTransaction;
      localApplied?: boolean;
    };
  }) => {
    if (selectionNoticeTimerRef.current) window.clearTimeout(selectionNoticeTimerRef.current);
    setSelectionSkillNotice(notice);
    if (!notice.history && !notice.undo) {
      selectionNoticeTimerRef.current = window.setTimeout(() => setSelectionSkillNotice(undefined), 4500);
    }
  }, []);

  const refreshPageSelection = useCallback(() => {
    if (selectionCommentSessionRef.current) return;
    const next = staticPageSelection();
    pageSelectionSnapshotRef.current = next;
    setPageSelectionSnapshot(next);
    if (next) {
      setSelectionCommentError("");
      setSelectionCommentPhaseValue("ready");
    }
  }, [setSelectionCommentPhaseValue]);

  const schedulePageSelectionRefresh = useCallback(() => {
    if (pageSelectionRefreshFrameRef.current !== undefined) {
      window.cancelAnimationFrame(pageSelectionRefreshFrameRef.current);
    }
    pageSelectionRefreshFrameRef.current = window.requestAnimationFrame(() => {
      pageSelectionRefreshFrameRef.current = undefined;
      refreshPageSelection();
    });
  }, [refreshPageSelection]);

  const commitSelectionComment = useCallback((session: SelectionCommentSession, audio: Blob) => {
    if (selectionCommentSessionRef.current?.id !== session.id) return;
    session.audio = audio;
    setSelectionCommentPhaseValue("committing");
    setSelectionCommentError("");
    void (async () => {
      let appliedContext: AppliedContext | undefined;
      try {
        const activeProject = session.projects[0] ?? "";
        const instructions = "Transcribe only the spoken comment about the selected text. Preserve the speaker's meaning and wording.";
        const savePlan = {
          source_content: session.snapshot.text,
          source: session.snapshot.source,
          projects: session.projects,
          tags: [],
        };
        const recoveryPlan: PendingVoicePlan = {
          kind: "selection",
          transcription: {
            pageUrl: session.snapshot.source.url,
            pageTitle: session.snapshot.source.title,
            selectedText: session.snapshot.text,
            instructions,
            profileRequest: { project: activeProject, ...session.overrides },
          },
          save: savePlan,
        };
        await queuePendingVoice({
          id: session.id,
          pageUrl: session.snapshot.source.url,
          pageTitle: session.snapshot.source.title,
          plan: recoveryPlan,
        });
        const context = session.context ?? await (session.contextPromise ?? getCaptureContext(session.snapshot.source.url, activeProject, session.overrides));
        const profile = context.resolved_voice_profile;
        appliedContext = frozenAppliedContext(session.snapshot.source, activeProject, context, session.overrides);
        await queuePendingVoice({
          id: session.id,
          pageUrl: session.snapshot.source.url,
          pageTitle: session.snapshot.source.title,
          plan: {
            kind: "selection",
            transcription: {
              pageUrl: session.snapshot.source.url,
              pageTitle: session.snapshot.source.title,
              selectedText: session.snapshot.text,
              projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
              glossary: profile.vocabulary.join("\n"),
              instructions,
              appliedContext,
            },
            save: savePlan,
          },
        });
        await completeSelectionVoiceInput({
          transcribe: async () => {
            const transcription = await transcribeAudio({
              requestId: session.id,
              audio,
              source: session.snapshot.source,
              selectedText: session.snapshot.text,
              projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
              glossary: profile.vocabulary.join("\n"),
              instructions,
              appliedContext,
            });
            appliedContext = transcription.applied_context;
            await markPendingVoiceTranscribed({
              id: session.id,
              captureId: transcription.capture_id,
              rawTranscript: transcription.raw_transcript,
              text: transcription.text,
              appliedContext,
            });
            return { text: transcription.text, rawTranscript: transcription.raw_transcript, captureId: transcription.capture_id };
          },
          save: async (transcription) => {
            const saved = await saveSelection({
              requestId: session.id,
              sourceContent: session.snapshot.text,
              comment: transcription.text,
              rawTranscript: transcription.rawTranscript,
              transcript: transcription.text,
              source: session.snapshot.source,
              projects: session.projects,
              captureId: transcription.captureId,
              appliedContext,
            });
            await completePendingVoice(session.id);
            return saved;
          },
        });
        if (selectionCommentSessionRef.current?.id !== session.id) return;
        selectionCommentSessionRef.current = undefined;
        pageSelectionSnapshotRef.current = undefined;
        setPageSelectionSnapshot(undefined);
        setSelectionCommentError("");
        setSelectionCommentPhaseValue("ready");
        setVoiceProfileOverrides({});
        window.getSelection()?.removeAllRanges();
      } catch {
        if (selectionCommentSessionRef.current?.id !== session.id) return;
        setSelectionCommentError("Recording saved locally. Open Logue to retry.");
        setSelectionCommentPhaseValue("error");
      }
    })();
  }, [setSelectionCommentPhaseValue]);

  const startSelectionComment = useCallback(() => {
    const retry = selectionCommentSessionRef.current;
    if (selectionCommentPhaseRef.current === "error" && retry?.audio) {
      commitSelectionComment(retry, retry.audio);
      return;
    }
    const snapshot = pageSelectionSnapshotRef.current;
    if (!snapshot) return;
    const session: SelectionCommentSession = {
      id: createRequestId(),
      snapshot,
      projects: [],
      overrides: { ...voiceProfileOverrides },
    };
    selectionCommentSessionRef.current = session;
    setSelectionCommentError("");
    setSelectionCommentPhaseValue("starting");
    void requireWritablePendingVoiceQueue(snapshot.text).then(() => chrome.runtime.sendMessage({ type: "logue:get-tab-projects" }) as Promise<{ ok?: boolean; value?: string[] } | undefined>).then(async (projectResponse) => {
      if (selectionCommentSessionRef.current?.id !== session.id) return;
      if (!projectResponse?.ok || !Array.isArray(projectResponse.value)) {
        throw new Error("Could not read the Project for this tab.");
      }
      session.projects = projectResponse.value.slice(0, 1);
      session.contextPromise = getCaptureContext(session.snapshot.source.url, session.projects[0] ?? "", session.overrides);
      void session.contextPromise.then((context) => {
        if (selectionCommentSessionRef.current?.id !== session.id) return;
        session.context = context;
        setVoiceProfileContext(context);
      }).catch(() => undefined);
      setVoiceProfilePickerOpen(false);
      return sendInlineRecorderControl(session.id, "start");
    }).catch((cause: unknown) => {
      if (selectionCommentSessionRef.current?.id !== session.id) return;
      selectionCommentSessionRef.current = undefined;
      setSelectionCommentError(cause instanceof Error ? cause.message : "Could not start voice comment.");
      setSelectionCommentPhaseValue("error");
    });
  }, [commitSelectionComment, sendInlineRecorderControl, setSelectionCommentPhaseValue, voiceProfileOverrides]);

  const acceptSelectionComment = useCallback(() => {
    const session = selectionCommentSessionRef.current;
    if (!session || selectionCommentPhaseRef.current !== "recording") return;
    void sendInlineRecorderControl(session.id, "stop").catch((cause: unknown) => {
      if (selectionCommentSessionRef.current?.id !== session.id) return;
      setSelectionCommentError(cause instanceof Error ? cause.message : "Could not stop voice comment.");
      setSelectionCommentPhaseValue("error");
    });
  }, [sendInlineRecorderControl, setSelectionCommentPhaseValue]);

  const cancelSelectionComment = useCallback(() => {
    const session = selectionCommentSessionRef.current;
    if (selectionCommentPhaseRef.current === "committing") return;
    selectionCommentSessionRef.current = undefined;
    if (session) void sendInlineRecorderControl(session.id, "cancel").catch(() => undefined);
    setSelectionCommentError("");
    setSelectionTextCommentOpen(false);
    setSelectionTextComment("");
    setSelectionCommentPhaseValue("ready");
    refreshPageSelection();
  }, [refreshPageSelection, sendInlineRecorderControl, setSelectionCommentPhaseValue]);

  const saveTextSelectionComment = useCallback(() => {
    const snapshot = pageSelectionSnapshotRef.current;
    const comment = selectionTextComment.trim();
    if (!snapshot || !comment || selectionTextCommentSaving) return;
    setSelectionTextCommentSaving(true);
    setSelectionCommentError("");
    void (async () => {
      const projectResponse = await chrome.runtime.sendMessage({ type: "logue:get-tab-projects" }) as { ok?: boolean; value?: string[] } | undefined;
      const projects = projectResponse?.ok && Array.isArray(projectResponse.value) ? projectResponse.value.slice(0, 1) : [];
      await saveSelection({
        requestId: createRequestId(),
        sourceContent: snapshot.text,
        comment,
        source: snapshot.source,
        projects,
      });
      pageSelectionSnapshotRef.current = undefined;
      setPageSelectionSnapshot(undefined);
      setSelectionTextCommentOpen(false);
      setSelectionTextComment("");
      window.getSelection()?.removeAllRanges();
    })().catch((cause: unknown) => {
      setSelectionCommentError(cause instanceof Error ? cause.message : "Could not save this comment.");
    }).finally(() => setSelectionTextCommentSaving(false));
  }, [selectionTextComment, selectionTextCommentSaving]);

  const savePageSelection = useCallback(() => {
    const snapshot = pageSelectionSnapshotRef.current;
    if (!snapshot || selectionTextCommentSaving) return;
    setSelectionTextCommentSaving(true); setSelectionCommentError("");
    void (async () => {
      const projectResponse = await chrome.runtime.sendMessage({ type: "logue:get-tab-projects" }) as { ok?: boolean; value?: string[] } | undefined;
      const projects = projectResponse?.ok && Array.isArray(projectResponse.value) ? projectResponse.value.slice(0, 1) : [];
      await saveSelection({ requestId: createRequestId(), sourceContent: snapshot.text, source: snapshot.source, projects });
      pageSelectionSnapshotRef.current = undefined; setPageSelectionSnapshot(undefined); window.getSelection()?.removeAllRanges();
    })().catch((cause: unknown) => setSelectionCommentError(cause instanceof Error ? cause.message : "Could not save this selection.")).finally(() => setSelectionTextCommentSaving(false));
  }, [selectionTextCommentSaving]);

  const finishSelectionComment = useCallback((event: RecordingBridgeEvent) => {
    const session = selectionCommentSessionRef.current;
    if (!session || event.sessionId !== session.id) return false;
    if (event.event === "started") {
      setSelectionCommentPhaseValue("recording");
      return true;
    }
    if (event.event === "cancelled") {
      selectionCommentSessionRef.current = undefined;
      setSelectionCommentPhaseValue("ready");
      return true;
    }
    if (event.event === "error") {
      selectionCommentSessionRef.current = undefined;
      setSelectionCommentError(event.error || "Could not start voice comment.");
      setSelectionCommentPhaseValue("error");
      return true;
    }
    if (event.event === "stopped") {
      commitSelectionComment(session, audioBlobFromEvent(event));
      return true;
    }
    return true;
  }, [commitSelectionComment, setSelectionCommentPhaseValue]);

  const finishInlineVoice = useCallback((event: RecordingBridgeEvent) => {
    const session = voiceSessionRef.current;
    if (!session || event.sessionId !== session.id) return;
    if (event.event === "started") {
      if (session.mode === "command") {
        setCommandPhase("recording");
        return;
      }
      setInlineVoicePhase("recording");
      return;
    }
    if (event.event === "cancelled") {
      voiceSessionRef.current = undefined;
      if (session.mode === "command") {
        setCommandPhase("editing");
        return;
      }
      setInlineVoicePhase("idle");
      restoreTargetFocus(session);
      return;
    }
    if (event.event === "error") {
      voiceSessionRef.current = undefined;
      if (session.mode === "command") {
        setCommandPhase("editing");
        setCommandError(event.error || "Could not record Voice Command.");
        return;
      }
      setVoiceError(event.error || "Could not start voice input.");
      setInlineVoicePhase("error");
      restoreTargetFocus(session);
      return;
    }
    if (event.event !== "stopped") return;

    if (session.mode === "command") {
      setCommandPhase("transcribing");
      void (async () => {
        const project = session.commandProject ?? session.projects[0] ?? "";
        const pendingSelection = session.commandSelection;
        const instructions = "Transcribe this as a direct instruction for Logue. Preserve the requested action, scope, and output intent.";
        await queuePendingVoice({
          id: session.id,
          pageUrl: session.source.url,
          pageTitle: session.source.title,
          plan: {
            kind: "material",
            transcription: {
              pageUrl: session.source.url,
              pageTitle: session.source.title,
              targetText: session.targetText,
              instructions,
              profileRequest: { project, ...session.overrides },
            },
            save: { kind: "voice", source: session.source, projects: [], suggested_projects: [], tags: [], activity_type: "voice-command" },
            command: {
              scope: session.commandScopeExplicit ? session.commandScope ?? "page" : "auto",
              project,
              source: pendingSelection ? { ...session.source, selection: pendingSelection } : session.source,
              selection: pendingSelection,
              pageText: session.commandPageText,
              targetText: session.targetText,
              targetSessionId: session.target === document.body ? undefined : targetSessionId(session.target),
              targetAvailable: session.target !== document.body && isEditableTargetAvailable(session.target),
            },
          },
        });
        const context = session.context ?? await (session.contextPromise ?? getCaptureContext(session.source.url, project, session.overrides));
        const profile = context.resolved_voice_profile;
        const appliedContext = frozenAppliedContext(session.source, project, context, session.overrides);
        const transcription = await transcribeAudio({
          requestId: session.id,
          audio: audioBlobFromEvent(event),
          source: session.source,
          targetText: session.targetText,
          selectedText: pendingSelection,
          projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
          glossary: profile.vocabulary.join("\n"),
          instructions,
          appliedContext,
        });
        await markPendingVoiceTranscribed({
          id: session.id,
          captureId: transcription.capture_id,
          rawTranscript: transcription.raw_transcript,
          text: transcription.text,
          appliedContext: transcription.applied_context,
        });
        const activity = await saveMaterial({
          requestId: session.id,
          kind: "voice",
          content: transcription.text,
          rawTranscript: transcription.raw_transcript,
          transcript: transcription.text,
          source: session.source,
          projects: [],
          tags: [],
          captureId: transcription.capture_id,
          appliedContext: transcription.applied_context,
          activityType: "voice-command",
        });
        setCommandActivitySourceId(activity.id);
        setCommandPendingVoiceId(session.id);
        if (voiceSessionRef.current?.id !== session.id) return;
        voiceSessionRef.current = undefined;
        setCommandInstruction(transcription.text);
        const target = session.target === document.body ? null : session.target;
        const selection = session.commandSelection;
        const spokenScope = inferredCommandScope(transcription.text, Boolean(selection), project);
        const explicitScopeConflict = Boolean(
          session.commandScopeExplicit && commandMentionsScope(transcription.text) &&
          (spokenScope === "conflict" || spokenScope !== session.commandScope),
        );
        const inferred = session.commandScopeExplicit
          ? session.commandScope ?? "page"
          : spokenScope;
        const explicitScopeInvalid = session.commandScopeExplicit && (
          (inferred === "selection" && !selection) ||
          (inferred === "project" && !project)
        );
        if (inferred === "conflict" || explicitScopeInvalid || explicitScopeConflict) {
          setCommandPhase("editing");
          setCommandError("Choose whether this command should use the Selection, Page, or Project.");
          return;
        }
        setCommandScope(inferred);
        if (inferred === "project" && !project) {
          setCommandPhase("editing");
          setCommandError("Choose the Project whose Sources Logue should use.");
          return;
        }
        const source = inferred === "selection" && selection ? { ...session.source, selection } : session.source;
        const anchorRect = target?.getBoundingClientRect() ?? pageSelectionSnapshotRef.current?.anchor;
        await runCommandExecutionRef.current({
          instruction: transcription.text,
          scope: inferred,
          project,
          source,
          selection: inferred === "selection" ? selection : undefined,
          pageText: inferred === "page" ? session.commandPageText : undefined,
          targetText: isEditableTargetAvailable(target) ? getEditableText(target) : session.targetText,
          targetSessionId: targetSessionId(target),
          targetAvailable: isEditableTargetAvailable(target),
          targetElement: isEditableTargetAvailable(target) ? target : undefined,
          activitySourceId: activity.id,
          pendingVoiceId: session.id,
          anchor: { left: anchorRect?.left ?? 24, top: (anchorRect?.bottom ?? 80) + 8 },
          editableSnapshot: inferred === "selection" ? session.commandEditableSnapshot : undefined,
          epoch: commandEpochRef.current,
          evidenceRequestId: `${activity.id}:evidence`,
          runRequestId: `${activity.id}:run`,
        });
      })().catch((cause: unknown) => {
        if (voiceSessionRef.current?.id === session.id) voiceSessionRef.current = undefined;
        if (cause instanceof ExtensionApiError) setCommandFailedRun(cause.run);
        if (isCommandParseFailure(cause)) setCommandParseError(true);
        setCommandPhase("editing");
        setCommandError(isCommandParseFailure(cause) ? "Couldn’t understand the action. Edit the intent, retry transcription, or switch to Voice Write." : cause instanceof Error ? cause.message : "Voice Command was saved, but could not run.");
      });
      return;
    }

    setInlineVoicePhase("processing");
    void (async () => {
      try {
        const activeProject = session.projects[0] ?? "";
        const instructions = "Transcribe this as ready-to-insert text for the current input.";
        const savePlan = {
          kind: "voice",
          source: session.source,
          projects: [],
          suggested_projects: activeProject ? [activeProject] : [],
          tags: [],
        };
        const recoveryPlan: PendingVoicePlan = {
          kind: "material",
          transcription: {
            pageUrl: session.source.url,
            pageTitle: session.source.title,
            targetText: session.targetText,
            instructions,
            profileRequest: { project: activeProject, ...session.overrides },
          },
          save: savePlan,
        };
        await queuePendingVoice({
          id: session.id,
          pageUrl: session.source.url,
          pageTitle: session.source.title,
          plan: recoveryPlan,
        });
        const context = session.context ?? await (session.contextPromise ?? getCaptureContext(session.source.url, activeProject, session.overrides));
        const profile = context.resolved_voice_profile;
        let appliedContext = frozenAppliedContext(session.source, activeProject, context, session.overrides);
        await queuePendingVoice({
          id: session.id,
          pageUrl: session.source.url,
          pageTitle: session.source.title,
          plan: {
            kind: "material",
            transcription: {
              pageUrl: session.source.url,
              pageTitle: session.source.title,
              targetText: session.targetText,
              projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
              glossary: profile.vocabulary.join("\n"),
              instructions,
              appliedContext,
            },
            save: savePlan,
          },
        });
        const transcription = await transcribeAudio({
          requestId: session.id,
          audio: audioBlobFromEvent(event),
          source: session.source,
          targetText: session.targetText,
          projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
          glossary: profile.vocabulary.join("\n"),
          instructions,
          appliedContext,
        });
        appliedContext = transcription.applied_context;
        await markPendingVoiceTranscribed({
          id: session.id,
          captureId: transcription.capture_id,
          rawTranscript: transcription.raw_transcript,
          text: transcription.text,
          appliedContext,
        });
        if (voiceSessionRef.current?.id !== session.id) return;
        const saved = await saveMaterial({
          requestId: session.id,
          kind: "voice",
          content: transcription.text,
          rawTranscript: transcription.raw_transcript,
          transcript: transcription.text,
          source: session.source,
          projects: [],
          suggestedProjects: appliedContext.reference_project ? [appliedContext.reference_project] : [],
          captureId: transcription.capture_id,
          appliedContext,
        });
        await completePendingVoice(session.id);
        if (voiceSessionRef.current?.id !== session.id) return;
        setVoiceCandidate({ materialId: saved.id, text: transcription.text, revision: 1, profileLabel: appliedContext.voice_profile_label || profile.label, referenceProject: activeProject });
        setVoiceError("");
        setPendingCopyText("");
        setInlineVoicePhase("idle");
      } catch {
        if (voiceSessionRef.current?.id !== session.id) return;
        voiceSessionRef.current = undefined;
        setVoiceError("Recording saved locally. Open Logue to retry.");
        setInlineVoicePhase("error");
        restoreTargetFocus(session);
      }
    })();
  }, [restoreTargetFocus, setInlineVoicePhase]);

  const dismissVoiceCandidate = useCallback(() => {
    const session = voiceSessionRef.current;
    voiceSessionRef.current = undefined;
    lastInsertUndoRef.current = undefined;
    setVoiceCandidate(undefined);
    setVoiceProfileOverrides({});
    setVoiceProfilePickerOpen(false);
    setInlineVoicePhase("idle");
    restoreTargetFocus(session);
  }, [restoreTargetFocus, setInlineVoicePhase]);

  const startVoiceCommand = useCallback((autoRecord = false) => {
    const launchEpoch = ++commandEpochRef.current;
    const selectionAvailable = Boolean(selectionSnapshotRef.current?.text || pageSelectionSnapshotRef.current?.text || window.getSelection()?.toString().trim());
    setCommandOpen(true);
    setCommandPhase("editing");
    setCommandError("");
    setCommandParseError(false);
    setCommandInstruction("");
    setCommandActivitySourceId(undefined);
    setCommandPendingVoiceId(undefined);
    setCommandFailedRun(undefined);
    setPendingCommandExecution(undefined);
    setCommandScope(selectionAvailable ? "selection" : "page");
    setCommandScopeExplicit(false);
    commandTargetRef.current = isEditableTargetAvailable(targetRef.current) ? targetRef.current : null;
    setVoiceProfilePickerOpen(false);
    void chrome.runtime.sendMessage({ type: "logue:get-tab-projects" })
      .then((response: { ok?: boolean; value?: string[] } | undefined) => {
        if (commandEpochRef.current !== launchEpoch) throw new Error("Command closed");
        const project = response?.ok && Array.isArray(response.value) ? response.value[0] ?? "" : "";
        setCommandProject(project);
        if (autoRecord) startCommandVoiceRef.current(project, selectionAvailable ? "selection" : "page", false);
        return getCaptureContext(pageSource().url ?? "", project, voiceProfileOverrides).then((context) => ({ context, project }));
      })
      .then(({ context, project }) => {
        if (commandEpochRef.current !== launchEpoch) return;
        setVoiceProfileContext(context);
      })
      .catch((cause: unknown) => {
        if (commandEpochRef.current === launchEpoch && cause instanceof Error && cause.message !== "Command closed") setCommandProject("");
      });
  }, [voiceProfileOverrides]);

  const closeVoiceCommand = useCallback(() => {
    commandEpochRef.current += 1;
    const session = voiceSessionRef.current;
    if (session?.mode === "command") {
      voiceSessionRef.current = undefined;
      void sendInlineRecorderControl(session.id, "cancel").catch(() => undefined);
    }
    setCommandOpen(false);
    setCommandPhase("editing");
    setCommandError("");
    setCommandParseError(false);
    if (commandPendingVoiceId) void completePendingVoice(commandPendingVoiceId).catch(() => undefined);
    setCommandPendingVoiceId(undefined);
    const execution = commandExecutionRef.current;
    commandExecutionRef.current = undefined;
    if (execution) {
      void cancelMaterialSave(execution.evidenceRequestId).catch(() => undefined);
      void cancelMaterialSave(`${execution.evidenceRequestId}:source`).catch(() => undefined);
      void cancelMaterialSave(execution.runRequestId).catch(() => undefined);
    }
    if (session) restoreTargetFocus(session);
    else if (isEditableTargetAvailable(commandTargetRef.current)) commandTargetRef.current.focus({ preventScroll: true });
    commandTargetRef.current = null;
  }, [commandPendingVoiceId, restoreTargetFocus, sendInlineRecorderControl]);

  const presentCommandResult = useCallback((execution: PendingCommandExecution, run: ExtensionSkillRun) => {
    if (run.status !== "complete" || !run.original_output?.trim()) throw new Error(run.error || "No result returned.");
    if (execution.epoch !== commandEpochRef.current) return;
    commandExecutionRef.current = undefined;
    setSelectionActionCandidate({
      runId: run.id,
      skillName: run.skill_name || "Voice Command",
      text: run.original_output,
      originalText: run.original_output,
      source: execution.source,
      projects: execution.project ? [execution.project] : [],
      anchor: execution.anchor,
      editableSnapshot: execution.scope === "selection" ? execution.editableSnapshot : undefined,
      insertTarget: execution.scope !== "selection" && execution.targetAvailable ? execution.targetElement : undefined,
      insertTargetText: execution.scope !== "selection" ? execution.targetText : undefined,
      insertTargetSessionId: execution.scope !== "selection" ? execution.targetSessionId : undefined,
      sources: run.sources ?? [],
    });
    void getExtensionDocuments().then(setCandidateDocuments).catch(() => setCandidateDocuments([]));
    setPendingCommandExecution(undefined);
    setCommandFailedRun(undefined);
    setCommandOpen(false);
    setCommandInstruction("");
    setCommandActivitySourceId(undefined);
    setCommandPhase("editing");
  }, []);

  const runCommandExecution = useCallback(async (execution: PendingCommandExecution) => {
    commandExecutionRef.current = execution;
    setPendingCommandExecution(execution);
    setCommandPhase("running");
    setCommandError("");
    if (execution.scope === "project") {
      const response = await chrome.runtime.sendMessage({
        type: "logue:open-side-panel",
        intent: "generate",
        source: execution.source,
        targetText: execution.targetText,
        targetSessionId: execution.targetSessionId,
        targetAvailable: execution.targetAvailable,
        draft: execution.instruction,
        projects: [execution.project],
        commandActivitySourceId: execution.activitySourceId,
        commandRunRequestId: execution.runRequestId,
        autoRun: true,
      }) as { ok?: boolean; error?: string } | undefined;
      if (!response?.ok) throw new Error(response?.error || "Could not run this command.");
      if (execution.pendingVoiceId) await completePendingVoice(execution.pendingVoiceId);
      if (execution.epoch !== commandEpochRef.current) return;
      commandExecutionRef.current = undefined;
      setCommandOpen(false);
      setCommandInstruction("");
      setCommandActivitySourceId(undefined);
      setCommandPendingVoiceId(undefined);
      commandTargetRef.current = null;
      setCommandPhase("editing");
      return;
    }
    const evidenceId = execution.scope === "selection" && execution.selection
      ? (await saveSelection({ requestId: execution.evidenceRequestId, sourceContent: execution.selection, source: execution.source, projects: [] })).source.id
      : (await saveMaterial({ requestId: execution.evidenceRequestId, kind: "selection", content: execution.pageText || execution.source.title || execution.source.url, source: execution.source, projects: [], tags: [], actor: "web" })).id;
    const [availableSkills, settings, captureContext] = await Promise.all([
      getExtensionSkills(),
      getExtensionSettings(),
      getCaptureContext(execution.source.url, execution.project, voiceProfileOverrides),
    ]);
    const binding = captureContext.projects.find((item) => item.name === execution.project)?.skill_bindings?.command;
    const skill = availableSkills.find((item) => item.id === (binding || settings.default_extension_skill))
      || availableSkills.find((item) => item.output === "insert");
    if (!skill) throw new Error("No Voice Command Skill is available.");
    const run = await createExtensionSkillRun({
      requestId: execution.runRequestId,
      skillId: skill.id,
      instruction: execution.instruction,
      project: execution.project || undefined,
      pageTitle: execution.source.title,
      pageUrl: execution.source.url,
      targetText: execution.targetText,
      selection: execution.selection,
      sourceIds: [evidenceId],
      autoSearch: false,
      activitySourceId: execution.activitySourceId,
    });
    if (execution.pendingVoiceId) await completePendingVoice(execution.pendingVoiceId);
    presentCommandResult(execution, run);
  }, [presentCommandResult, voiceProfileOverrides]);

  runCommandExecutionRef.current = runCommandExecution;

  const submitVoiceCommand = useCallback((instructionOverride?: string, contextOverride?: { project?: string; scope?: CommandScope; activitySourceId?: string; pendingVoiceId?: string }) => {
    const instruction = (instructionOverride ?? commandInstruction).trim();
    const project = (contextOverride?.project ?? commandProject).trim();
    const scope = contextOverride?.scope ?? commandScope;
    if (!instruction) return;
    setCommandParseError(false);
    if (scope === "project" && !project) {
      setCommandError("Choose the Project whose Sources Logue should use.");
      return;
    }
    const target = targetRef.current;
    const selection = selectionSnapshotRef.current?.text || pageSelectionSnapshotRef.current?.text || window.getSelection()?.toString().trim() || undefined;
    const inferredScope = inferredCommandScope(instruction, Boolean(selection), project);
    if (inferredScope === "conflict" || (commandMentionsScope(instruction) && inferredScope !== scope)) {
      setCommandError("The instruction and selected scope do not match. Choose Selection, Page, or Project, then run again.");
      return;
    }
    const source = selection && scope === "selection" ? { ...pageSource(), selection } : pageSource();
    setCommandPhase("running");
    setCommandError("");
    void (async () => {
      const activitySourceId = contextOverride?.activitySourceId || commandActivitySourceId || (await saveMaterial({
        requestId: createRequestId(),
        kind: "text",
        content: instruction,
        source,
        projects: [],
        tags: [],
        activityType: "text-command",
      })).id;
      setCommandActivitySourceId(activitySourceId);
      const anchorRect = target?.getBoundingClientRect() ?? pageSelectionSnapshotRef.current?.anchor;
      const execution: PendingCommandExecution = {
        instruction,
        scope,
        project,
        source,
        selection: scope === "selection" ? selection : undefined,
        pageText: scope === "page" ? document.body?.innerText?.trim().slice(0, 80_000) : undefined,
        targetText: isEditableTargetAvailable(target) ? getEditableText(target) : "",
        targetSessionId: targetSessionId(target),
        targetAvailable: isEditableTargetAvailable(target),
        targetElement: isEditableTargetAvailable(target) ? target : undefined,
        activitySourceId,
        pendingVoiceId: contextOverride?.pendingVoiceId ?? commandPendingVoiceId,
        anchor: { left: anchorRect?.left ?? 24, top: (anchorRect?.bottom ?? 80) + 8 },
        editableSnapshot: scope === "selection" ? selectionSnapshotRef.current : undefined,
        epoch: commandEpochRef.current,
        evidenceRequestId: `${activitySourceId}:evidence`,
        runRequestId: `${activitySourceId}:run`,
      };
      await runCommandExecution(execution);
    })().catch((cause: unknown) => {
      const failed = cause instanceof ExtensionApiError ? cause.run : undefined;
      setCommandFailedRun(failed);
      if (isCommandParseFailure(cause)) setCommandParseError(true);
      setCommandPhase("editing");
      setCommandError(isCommandParseFailure(cause) ? "Couldn’t understand the action. Edit the intent, retry transcription, or switch to Voice Write." : cause instanceof Error ? cause.message : "Could not run this command.");
    });
  }, [commandActivitySourceId, commandInstruction, commandPendingVoiceId, commandProject, commandScope, runCommandExecution]);

  const retryVoiceCommand = useCallback(() => {
    const failed = commandFailedRun;
    const execution = pendingCommandExecution;
    if (!failed || !execution) return;
    setCommandPhase("running");
    setCommandError("");
    const retryRequestId = `${execution.runRequestId}:retry`;
    commandExecutionRef.current = { ...execution, runRequestId: retryRequestId };
    void retryExtensionSkillRun(failed, retryRequestId).then(async (run) => {
      if (execution.pendingVoiceId) await completePendingVoice(execution.pendingVoiceId);
      presentCommandResult(execution, run);
    }).catch((cause: unknown) => {
      const nextFailed = cause instanceof ExtensionApiError ? cause.run : undefined;
      setCommandFailedRun(nextFailed ?? failed);
      setCommandPhase("editing");
      setCommandError(cause instanceof Error ? cause.message : "Could not retry this command.");
    });
  }, [commandFailedRun, pendingCommandExecution, presentCommandResult]);

  const retryCommandTranscription = useCallback(() => {
    if (!commandActivitySourceId) {
      startCommandVoiceRef.current();
      return;
    }
    setCommandPhase("transcribing");
    setCommandError("");
    void retranscribeMaterial(commandActivitySourceId, {
      referenceProject: commandProject,
      profileOverrides: voiceProfileOverrides,
    }).then((result) => {
      const nextInstruction = result.revision.transcript.trim();
      setCommandInstruction(nextInstruction);
      setCommandParseError(false);
      setCommandPhase("editing");
      submitVoiceCommand(nextInstruction);
    }).catch((cause: unknown) => {
      setCommandPhase("editing");
      setCommandError(cause instanceof Error ? cause.message : "Could not retry transcription.");
    });
  }, [commandActivitySourceId, commandProject, submitVoiceCommand, voiceProfileOverrides]);

  const switchCommandToVoiceWrite = useCallback(() => {
    const materialId = commandActivitySourceId;
    const text = commandInstruction.trim();
    if (!materialId || !text) return;
    const target = commandTargetRef.current ?? targetRef.current ?? document.body;
    const source = pageSource();
    if (commandPendingVoiceId) void completePendingVoice(commandPendingVoiceId).catch(() => undefined);
    commandEpochRef.current += 1;
    voiceSessionRef.current = {
      id: commandPendingVoiceId ?? createRequestId(),
      target,
      source,
      targetText: isEditableTargetAvailable(target) ? getEditableText(target) : "",
      projects: commandProject ? [commandProject] : [],
      overrides: { ...voiceProfileOverrides },
    };
    setVoiceCandidate({
      materialId,
      text,
      revision: 1,
      profileLabel: voiceProfileContext?.resolved_voice_profile.label || "Voice settings",
      referenceProject: commandProject,
    });
    setCommandOpen(false);
    setCommandParseError(false);
    setCommandError("");
    setCommandPendingVoiceId(undefined);
    setInlineVoicePhase("idle");
  }, [commandActivitySourceId, commandInstruction, commandPendingVoiceId, commandProject, setInlineVoicePhase, voiceProfileContext, voiceProfileOverrides]);

  const insertVoiceCandidate = useCallback((textOverride?: string) => {
    const session = voiceSessionRef.current;
    const candidate = voiceCandidate;
    const text = (textOverride ?? candidate?.text ?? "").trim();
    if (!session || !candidate || !text || candidate.busy) return;
    setVoiceCandidate((current) => current ? { ...current, busy: true, error: undefined } : current);
    if (!isEditableTargetAvailable(session.target)) {
      setVoiceCandidate((current) => current ? { ...current, busy: false, error: "The original input is no longer available. Copy the saved text instead." } : current);
      return;
    }
    const transaction = insertIntoElementWithUndo(session.target, text);
    if (!transaction) {
      setVoiceCandidate((current) => current ? { ...current, busy: false, error: "Could not insert here. Copy the saved text instead." } : current);
      return;
    }
    const adoptionId = createRequestId();
    lastInsertUndoRef.current = { token: adoptionId, transaction };
    const adoptionTarget = { surface: "inline-voice", url: session.source.url, target_key: session.id };
    setVoiceCandidate((current) => current ? { ...current, text, busy: true, inserted: true, canUndo: true, adoptionId, adoptionPending: "insert", adoptionTarget, undoNeedsInsert: false, error: undefined } : current);
    void adoptVoiceMaterial(candidate.materialId, { adoptionId, action: "insert", content: text, target: adoptionTarget }).then(() => {
      setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, adoptionPending: undefined, error: undefined } : current);
    }).catch((cause: unknown) => {
      setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, adoptionPending: "insert", error: cause instanceof Error ? `Inserted, but Logue could not record it: ${cause.message}` : "Inserted, but Logue could not record it." } : current);
    });
  }, [voiceCandidate]);

  const copyVoiceCandidate = useCallback((clipboardAlreadyWritten = false) => {
    const session = voiceSessionRef.current;
    const candidate = voiceCandidate;
    if (!session || !candidate || !candidate.text.trim() || candidate.busy) return;
    const adoptionId = createRequestId();
    const adoptionTarget = { surface: "clipboard", url: session.source.url, target_key: session.id };
    setVoiceCandidate((current) => current ? { ...current, busy: true, error: undefined } : current);
    const copy = clipboardAlreadyWritten ? Promise.resolve() : navigator.clipboard.writeText(candidate.text);
    void copy.then(() => {
      setVoiceCandidate((current) => current ? { ...current, copied: true, inserted: false, canUndo: false, adoptionId, adoptionPending: "copy", adoptionTarget, undoNeedsInsert: false, error: undefined } : current);
      return adoptVoiceMaterial(candidate.materialId, { adoptionId, action: "copy", content: candidate.text, target: adoptionTarget });
    }).then(() => {
      setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, adoptionPending: undefined, error: undefined } : current);
    }).catch((cause: unknown) => {
      setVoiceCandidate((current) => current ? { ...current, busy: false, adoptionPending: current.copied ? "copy" : undefined, error: cause instanceof Error ? cause.message : "Could not copy this text." } : current);
    });
  }, [voiceCandidate]);

  const undoVoiceCandidate = useCallback(() => {
    const pending = lastInsertUndoRef.current;
    const candidate = voiceCandidate;
    if (!pending || !candidate?.adoptionId) return;
    const adoptionId = candidate.adoptionId;
    lastInsertUndoRef.current = undefined;
    const restored = pending.transaction.undo();
    if (!restored) {
      setVoiceCandidate((current) => current ? { ...current, inserted: false, canUndo: false, error: "The page changed, so this insert can’t be undone." } : current);
      return;
    }
    const undoNeedsInsert = candidate.adoptionPending === "insert";
    setVoiceCandidate((current) => current ? { ...current, busy: true, inserted: false, canUndo: false, adoptionPending: "undo", undoNeedsInsert, error: undefined } : current);
    const ensureInsert = undoNeedsInsert
      ? adoptVoiceMaterial(candidate.materialId, { adoptionId, action: "insert", content: candidate.text, target: candidate.adoptionTarget })
      : Promise.resolve();
    void ensureInsert.then(() => adoptVoiceMaterial(candidate.materialId, { adoptionId, undone: true })).then(() => {
      setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, adoptionPending: undefined, undoNeedsInsert: false, error: undefined } : current);
    }).catch((cause: unknown) => {
      setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, adoptionPending: "undo", error: cause instanceof Error ? `Text was removed, but Logue could not record Undo: ${cause.message}` : "Text was removed, but Logue could not record Undo." } : current);
    });
  }, [voiceCandidate]);

  const retryVoiceCandidateAdoption = useCallback(() => {
    const candidate = voiceCandidate;
    const session = voiceSessionRef.current;
    if (!candidate?.adoptionId || !candidate.adoptionPending || !session || candidate.busy) return;
    const adoptionId = candidate.adoptionId;
    setVoiceCandidate((current) => current ? { ...current, busy: true, error: undefined } : current);
    const request = candidate.adoptionPending === "undo"
      ? (candidate.undoNeedsInsert
          ? adoptVoiceMaterial(candidate.materialId, { adoptionId, action: "insert", content: candidate.text, target: candidate.adoptionTarget })
          : Promise.resolve()).then(() => adoptVoiceMaterial(candidate.materialId, { adoptionId, undone: true }))
      : adoptVoiceMaterial(candidate.materialId, { adoptionId, action: candidate.adoptionPending === "copy" ? "copy" : "insert", content: candidate.text, target: candidate.adoptionTarget });
    void request.then(() => setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, adoptionPending: undefined, undoNeedsInsert: false, error: undefined } : current)).catch((cause: unknown) => setVoiceCandidate((current) => current && current.adoptionId === adoptionId ? { ...current, busy: false, error: cause instanceof Error ? cause.message : "Could not record this adoption." } : current));
  }, [voiceCandidate]);

  const retranscribeVoiceCandidate = useCallback((input: VoiceCandidateRetranscribeInput, overridesOverride?: VoiceProfileOverrides) => {
    const session = voiceSessionRef.current;
    const candidate = voiceCandidate;
    const overrides = overridesOverride ?? voiceProfileOverrides;
    if (!session || !candidate || candidate.busy) return;
    setVoiceCandidate((current) => current ? { ...current, busy: true, error: undefined } : current);
    void Promise.all([
      retranscribeMaterial(candidate.materialId, { referenceProject: session.projects[0] ?? "", profileOverrides: overrides, correction: input.correction }),
      getCaptureContext(session.source.url ?? "", session.projects[0] ?? "", overrides),
    ]).then(([result, nextContext]) => {
      if (voiceSessionRef.current?.id !== session.id) return;
      setVoiceProfileContext(nextContext);
      setVoiceCandidate((current) => current ? { ...current, text: result.revision.transcript, revision: result.revision.revision, profileLabel: result.revision.applied_context.voice_profile_label || current.profileLabel, busy: false, inserted: false, copied: false, canUndo: false, adoptionId: undefined, adoptionPending: undefined, adoptionTarget: undefined, undoNeedsInsert: false, error: undefined } : current);
      lastInsertUndoRef.current = undefined;
    }).catch((cause: unknown) => {
      setVoiceCandidate((current) => current ? { ...current, busy: false, error: cause instanceof Error ? cause.message : "Could not re-transcribe this recording." } : current);
    });
  }, [voiceCandidate, voiceProfileOverrides]);

  const startInlineVoice = useCallback((override?: VoiceProfileOverrides) => {
    const target = targetRef.current;
    if (!target || !isEditableTargetAvailable(target)) return;
    const session: InlineVoiceSession = {
      id: createRequestId(),
      target,
      source: pageSource(),
      targetText: getEditableText(target),
      projects: [],
      overrides: { ...(override ?? voiceProfileOverrides) },
    };
    voiceSessionRef.current = session;
    setInlineVoicePhase("starting");
    setVoiceError("");
    setPendingCopyText("");
    void (async () => {
      await requireWritablePendingVoiceQueue();
      const projectResponse = await chrome.runtime.sendMessage({ type: "logue:get-tab-projects" }) as { ok?: boolean; value?: string[] } | undefined;
      session.projects = projectResponse?.ok && Array.isArray(projectResponse.value) ? projectResponse.value.slice(0, 1) : [];
      session.contextPromise = getCaptureContext(session.source.url ?? "", session.projects[0] ?? "", session.overrides);
      void session.contextPromise.then((context) => {
        if (voiceSessionRef.current?.id !== session.id) return;
        session.context = context;
        setVoiceProfileContext(context);
      }).catch(() => undefined);
      if (voiceSessionRef.current?.id !== session.id) return;
      setVoiceProfilePickerOpen(false);
      await sendInlineRecorderControl(session.id, "start");
    })().catch((cause: unknown) => {
      if (voiceSessionRef.current?.id !== session.id) return;
      voiceSessionRef.current = undefined;
      setVoiceError(cause instanceof Error ? cause.message : "Could not start voice input.");
      setInlineVoicePhase("error");
      restoreTargetFocus(session);
    });
  }, [restoreTargetFocus, sendInlineRecorderControl, setInlineVoicePhase, voiceProfileOverrides]);

  const startCommandVoice = useCallback((projectOverride?: string, scopeOverride?: CommandScope, scopeExplicitOverride?: boolean) => {
    const project = projectOverride ?? commandProject;
    const target = targetRef.current;
    const selection = selectionSnapshotRef.current?.text || pageSelectionSnapshotRef.current?.text || window.getSelection()?.toString().trim() || undefined;
    const session: InlineVoiceSession = {
      id: createRequestId(),
      target: target ?? document.body,
      source: pageSource(),
      targetText: isEditableTargetAvailable(target) ? getEditableText(target) : "",
      projects: project ? [project] : [],
      overrides: { ...voiceProfileOverrides },
      mode: "command",
      commandProject: project,
      commandSelection: selection,
      commandPageText: document.body?.innerText?.trim().slice(0, 80_000),
      commandEditableSnapshot: selectionSnapshotRef.current,
      commandScope: scopeOverride ?? commandScope,
      commandScopeExplicit: scopeExplicitOverride ?? commandScopeExplicit,
    };
    voiceSessionRef.current = session;
    setCommandPhase("starting");
    setCommandError("");
    void (async () => {
      await requireWritablePendingVoiceQueue();
      session.contextPromise = getCaptureContext(session.source.url ?? "", project, session.overrides);
      void session.contextPromise.then((context) => {
        if (voiceSessionRef.current?.id !== session.id) return;
        session.context = context;
        setVoiceProfileContext(context);
      }).catch(() => undefined);
      if (voiceSessionRef.current?.id !== session.id) return;
      await sendInlineRecorderControl(session.id, "start");
    })().catch((cause: unknown) => {
      if (voiceSessionRef.current?.id !== session.id) return;
      voiceSessionRef.current = undefined;
      setCommandPhase("editing");
      setCommandError(cause instanceof Error ? cause.message : "Could not start Voice Command.");
    });
  }, [commandProject, commandScope, commandScopeExplicit, sendInlineRecorderControl, voiceProfileOverrides]);

  startCommandVoiceRef.current = startCommandVoice;

  const stopCommandVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session || session.mode !== "command" || commandPhase !== "recording") return;
    setCommandPhase("transcribing");
    void sendInlineRecorderControl(session.id, "stop").catch((cause: unknown) => {
      if (voiceSessionRef.current?.id !== session.id) return;
      voiceSessionRef.current = undefined;
      setCommandPhase("editing");
      setCommandError(cause instanceof Error ? cause.message : "Could not stop Voice Command.");
    });
  }, [commandPhase, sendInlineRecorderControl]);

  const cancelCommandVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session || session.mode !== "command") return;
    voiceSessionRef.current = undefined;
    void sendInlineRecorderControl(session.id, "cancel").catch(() => undefined);
    setCommandPhase("editing");
    setCommandError("");
  }, [sendInlineRecorderControl]);

  const stopAndInsertInlineVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session || voicePhaseRef.current !== "recording") return;
    void sendInlineRecorderControl(session.id, "stop").catch((cause: unknown) => {
      if (voiceSessionRef.current?.id !== session.id) return;
      voiceSessionRef.current = undefined;
      setVoiceError(cause instanceof Error ? cause.message : "Could not stop voice input.");
      setInlineVoicePhase("error");
      restoreTargetFocus(session);
    });
  }, [restoreTargetFocus, sendInlineRecorderControl, setInlineVoicePhase]);

  const controlGoogleDocsEditor = useCallback((command: GoogleDocsLauncherCommand) => {
    // Google Docs routinely replaces this hidden event iframe. Resolve the
    // document target at the moment of the action, rather than retaining a
    // frame-local reference from an earlier focus event.
    const docsTarget = googleDocsEditableTarget(document);
    if (!docsTarget || !isGoogleDocsDocumentTarget(docsTarget)) return false;
    targetRef.current = docsTarget;
    targetPageHrefRef.current = window.location.href;
    setTargetRect(docsTarget.getBoundingClientRect());
    const isCommandAction = command.action.startsWith("command-");
    if (isCommandAction && command.action !== "command-close" && !command.action.startsWith("command-candidate-")) setCommandOpen(true);
    if (isCommandAction && command.project !== undefined) setCommandProject(command.project);
    if (isCommandAction && command.scope) setCommandScope(command.scope);
    if (isCommandAction && command.text !== undefined) setCommandInstruction(command.text);
    if (isCommandAction && command.activitySourceId !== undefined) setCommandActivitySourceId(command.activitySourceId);
    if (isCommandAction && command.pendingVoiceId !== undefined) setCommandPendingVoiceId(command.pendingVoiceId);
    if (command.action === "start") startInlineVoice(command.overrides);
    if (command.action === "stop") stopAndInsertInlineVoice();
    if (command.action === "cancel") cancelInlineVoice();
    if (command.action === "candidate-text") setVoiceCandidate((current) => current ? { ...current, text: command.text ?? current.text } : current);
    if (command.action === "candidate-overrides" && command.overrides) setVoiceProfileOverrides(command.overrides);
    if (command.action === "candidate-copy") copyVoiceCandidate(true);
    if (command.action === "candidate-insert") insertVoiceCandidate(command.text);
    if (command.action === "candidate-undo") undoVoiceCandidate();
    if (command.action === "candidate-retry") retryVoiceCandidateAdoption();
    if (command.action === "candidate-dismiss") dismissVoiceCandidate();
    if (command.action === "candidate-retranscribe") retranscribeVoiceCandidate(command.retranscribeInput ?? {}, command.overrides);
    if (command.action === "command-open") startVoiceCommand(true);
    if (command.action === "command-text") { setCommandInstruction(command.text ?? ""); setCommandError(""); }
    if (command.action === "command-project") { setCommandProject(command.project ?? ""); setCommandError(""); }
    if (command.action === "command-scope" && command.scope) { setCommandScope(command.scope); setCommandScopeExplicit(true); setCommandError(""); }
    if (command.action === "command-submit") submitVoiceCommand(command.text, { project: command.project, scope: command.scope, activitySourceId: command.activitySourceId, pendingVoiceId: command.pendingVoiceId });
    if (command.action === "command-start-voice") startCommandVoice();
    if (command.action === "command-stop-voice") {
      if (!voiceSessionRef.current && command.sessionId) {
        voiceSessionRef.current = {
          id: command.sessionId,
          target: docsTarget,
          source: pageSource(),
          targetText: getEditableText(docsTarget),
          projects: command.project ? [command.project] : [],
          overrides: { ...voiceProfileOverrides },
          mode: "command",
          commandProject: command.project,
          commandScope: command.scope,
          commandScopeExplicit: command.scopeExplicit ?? false,
          commandPageText: document.body?.innerText?.trim().slice(0, 80_000),
        };
        setCommandPhase("transcribing");
        void sendInlineRecorderControl(command.sessionId, "stop");
      } else stopCommandVoice();
    }
    if (command.action === "command-cancel-voice") {
      if (!voiceSessionRef.current && command.sessionId) void sendInlineRecorderControl(command.sessionId, "cancel");
      else cancelCommandVoice();
    }
    if (command.action === "command-retry") (commandParseError ? retryCommandTranscription() : retryVoiceCommand());
    if (command.action === "command-switch-write") switchCommandToVoiceWrite();
    if (command.action === "command-close") closeVoiceCommand();
    if (command.action === "command-candidate-text") setSelectionActionCandidate((current) => current ? { ...current, text: command.text ?? current.text } : current);
    if (command.action.startsWith("command-candidate-") && !selectionActionCandidate) return false;
    if (command.action === "command-candidate-primary") void applySelectionActionCandidate(command.text);
    if (command.action === "command-candidate-copy") void copySelectionActionCandidate(command.text);
    if (command.action === "command-candidate-keep") void keepSelectionActionCandidate(command.text);
    if (command.action === "command-candidate-keep-undo") void undoSelectionActionKeep();
    if (command.action === "command-candidate-document") void saveSelectionActionDocument(command.text, command.document);
    if (command.action === "command-candidate-document-undo") void undoSelectionActionDocument();
    if (command.action === "command-candidate-dismiss") dismissSelectionActionCandidate();
    return true;
  }, [cancelCommandVoice, cancelInlineVoice, closeVoiceCommand, commandParseError, copyVoiceCandidate, dismissVoiceCandidate, insertVoiceCandidate, retranscribeVoiceCandidate, retryCommandTranscription, retryVoiceCandidateAdoption, retryVoiceCommand, selectionActionBusy, selectionActionCandidate, selectionActionError, sendInlineRecorderControl, startCommandVoice, startInlineVoice, startVoiceCommand, stopAndInsertInlineVoice, stopCommandVoice, submitVoiceCommand, switchCommandToVoiceWrite, undoVoiceCandidate, voiceProfileOverrides]);

  useEffect(() => {
    const updateGoogleDocsProxy = (state: GoogleDocsLauncherState) => {
      const frame = googleDocsEditorFrame(document);
      if (!frame) return;
      if (!state.visible) {
        setGoogleDocsProxy((current) => current?.command?.recorderSessionId && ["starting", "recording"].includes(current.command.phase) ? current : undefined);
        return;
      }
      if (!frame.contentWindow) return;
      const surface = googleDocsEditorSurface(document) ?? frame;
      setGoogleDocsProxy((current) => {
        if (state.command && !current?.command) {
          googleDocsCommandInstructionRef.current = state.command.instruction;
          googleDocsCommandProjectRef.current = state.command.project;
          googleDocsCommandScopeRef.current = state.command.scope;
        }
        const command = state.command && current?.command
          ? {
              ...state.command,
              instruction: googleDocsCommandInstructionRef.current ?? state.command.instruction,
              project: googleDocsCommandProjectRef.current ?? state.command.project,
              scope: googleDocsCommandScopeRef.current ?? state.command.scope,
            }
          : state.command ?? (!state.commandCandidate && current?.command?.recorderSessionId && ["starting", "recording"].includes(current.command.phase) ? current.command : undefined);
        return { ...state, command, anchor: surface.getBoundingClientRect() };
      });
    };
    const onGoogleDocsRelay = (message: unknown) => {
      // Only the top document renders the control. The background forwards a
      // validated state update from the dedicated Docs editor frame.
      if (window.top !== window) return false;
      const state = readGoogleDocsLauncherState(message);
      if (!state) return false;
      updateGoogleDocsProxy(state);
      return false;
    };
    chrome.runtime.onMessage.addListener(onGoogleDocsRelay);
    return () => {
      chrome.runtime.onMessage.removeListener(onGoogleDocsRelay);
    };
  }, []);

  useEffect(() => {
    if (window.top !== window || window.location.hostname !== "docs.google.com") return;
    const syncFocusedDocsEditor = () => {
      const frame = googleDocsEditorFrame(document);
      const isFocused = isGoogleDocsEditorFocused(document);
      const host = document.getElementById("logue-extension-host");
      const launcherFocused = Boolean(host?.shadowRoot?.activeElement);
      if (!frame || !frame.contentWindow || (!isFocused && !launcherFocused)) {
        setGoogleDocsProxy((current) => current && current.phase === "idle" && !current.candidate ? undefined : current);
        return;
      }
      const anchor = (googleDocsEditorSurface(document) ?? frame).getBoundingClientRect();
      setGoogleDocsProxy((current) => {
        if (
          current && current.anchor.left === anchor.left && current.anchor.top === anchor.top &&
          current.anchor.width === anchor.width && current.anchor.height === anchor.height
        ) return current;
        return current ?? { visible: true, phase: "idle", error: "", pendingCopyText: "", anchor };
      });
    };
    syncFocusedDocsEditor();
    const timer = window.setInterval(syncFocusedDocsEditor, 120);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const host = document.getElementById("logue-extension-host");
    let pageContextFrame: number | undefined;
    const schedulePageContextChanged = () => {
      if (pageContextFrame !== undefined) window.cancelAnimationFrame(pageContextFrame);
      pageContextFrame = window.requestAnimationFrame(() => {
        pageContextFrame = undefined;
        void chrome.runtime.sendMessage({ type: "logue:page-context-changed" }).catch(() => undefined);
      });
    };
    const activateTarget = (candidate: EventTarget | null | undefined) => {
      if (voiceSessionRef.current) return;
      const target = candidate ?? null;
      if (!isEditableElement(target)) {
        clearTarget();
        return;
      }
      targetRef.current = target;
      targetPageHrefRef.current = window.location.href;
      rememberExternalTarget(target);
      setKeyboardActive(false);
      refreshTarget();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (host && event.composedPath().includes(host)) {
        setKeyboardActive(true);
        return;
      }
      activateTarget(event.target);
      schedulePageContextChanged();
      scheduleSelectionSkillRefresh();
    };
    const onViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      refreshTarget();
      const pageSelection = pageSelectionSnapshotRef.current;
      if (pageSelection) {
        const anchor = refreshedSelectionAnchor(pageSelection);
        if (anchor) {
          const next = { ...pageSelection, anchor };
          pageSelectionSnapshotRef.current = next;
          setPageSelectionSnapshot(next);
        } else if (!selectionCommentSessionRef.current) {
          pageSelectionSnapshotRef.current = undefined;
          setPageSelectionSnapshot(undefined);
        }
      }
    };
    const onRoute = () => {
      // A same-document route update must not cancel an in-progress voice
      // capture when the focused editor itself is still the same live target.
      // Selection Skills are stricter: their old selection may not survive a
      // route change, so close that menu until the user makes a new selection.
      dismissSelectionSkills();
      const selectionComment = selectionCommentSessionRef.current;
      if (selectionComment && selectionCommentPhaseRef.current !== "committing") {
        selectionCommentSessionRef.current = undefined;
        void sendInlineRecorderControl(selectionComment.id, "cancel").catch(() => undefined);
      }
      if (selectionCommentPhaseRef.current !== "committing") {
        pageSelectionSnapshotRef.current = undefined;
        setPageSelectionSnapshot(undefined);
        setSelectionCommentError("");
        setSelectionCommentPhaseValue("ready");
      }
      targetPageHrefRef.current = window.location.href;
      const target = targetRef.current;
      if (!isEditableTargetAvailable(target)) {
        clearTarget();
        schedulePageContextChanged();
        return;
      }
      rememberExternalTarget(target);
      setTargetRect(target.getBoundingClientRect());
      schedulePageContextChanged();
    };
    let href = window.location.href;
    const routeTimer = window.setInterval(() => {
      if (href === window.location.href) return;
      href = window.location.href;
      onRoute();
    }, 250);
    const observer = new MutationObserver(() => {
      if (targetRef.current && !targetRef.current.isConnected) {
        clearTarget();
        schedulePageContextChanged();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn, true);
    const onSelectionInteraction = (event: Event) => {
      if (host && event.composedPath().includes(host)) return;
      refreshTarget();
      schedulePageContextChanged();
      scheduleSelectionSkillRefresh();
      schedulePageSelectionRefresh();
    };
    const onPointerDownOutsideSelection = (event: PointerEvent) => {
      const target = targetRef.current;
      const path = event.composedPath();
      if (!target || path.includes(target) || (host && path.includes(host))) return;
      dismissSelectionSkills();
    };
    document.addEventListener("selectionchange", scheduleSelectionSkillRefresh);
    document.addEventListener("selectionchange", schedulePageSelectionRefresh);
    document.addEventListener("input", schedulePageContextChanged, true);
    document.addEventListener("select", onSelectionInteraction, true);
    document.addEventListener("pointerdown", onPointerDownOutsideSelection, true);
    document.addEventListener("pointerup", onSelectionInteraction, true);
    document.addEventListener("keyup", onSelectionInteraction, true);
    activateTarget(activeEditableElement(document));
    scheduleSelectionSkillRefresh();
    schedulePageSelectionRefresh();
    const initialLayoutFrame = window.requestAnimationFrame(() => {
      activateTarget(activeEditableElement(document));
      scheduleSelectionSkillRefresh();
      schedulePageSelectionRefresh();
    });
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(initialLayoutFrame);
      if (pageContextFrame !== undefined) window.cancelAnimationFrame(pageContextFrame);
      window.clearInterval(routeTimer);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("selectionchange", scheduleSelectionSkillRefresh);
      document.removeEventListener("selectionchange", schedulePageSelectionRefresh);
      document.removeEventListener("input", schedulePageContextChanged, true);
      document.removeEventListener("select", onSelectionInteraction, true);
      document.removeEventListener("pointerdown", onPointerDownOutsideSelection, true);
      document.removeEventListener("pointerup", onSelectionInteraction, true);
      document.removeEventListener("keyup", onSelectionInteraction, true);
      if (selectionRefreshFrameRef.current !== undefined) {
        window.cancelAnimationFrame(selectionRefreshFrameRef.current);
        selectionRefreshFrameRef.current = undefined;
      }
      if (pageSelectionRefreshFrameRef.current !== undefined) {
        window.cancelAnimationFrame(pageSelectionRefreshFrameRef.current);
        pageSelectionRefreshFrameRef.current = undefined;
      }
      window.removeEventListener("scroll", onViewport, true);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("hashchange", onRoute);
      window.removeEventListener("popstate", onRoute);
    };
  }, [clearTarget, dismissSelectionSkills, refreshTarget, rememberExternalTarget, schedulePageSelectionRefresh, scheduleSelectionSkillRefresh, sendInlineRecorderControl, setSelectionCommentPhaseValue]);

  useEffect(() => {
    const target = targetRef.current;
    // The visual control cannot escape the one-pixel Docs event iframe. Relay
    // its state to the top-frame Logue host, which anchors it beside the caret.
    if (!target || !isGoogleDocsDocumentTarget(target)) return;
    const isDocsTarget = isGoogleDocsDocumentTarget(target);
    const captureActive = voicePhase === "starting" || voicePhase === "recording" || voicePhase === "processing";
    void chrome.runtime.sendMessage(googleDocsLauncherStateMessage({
      visible: Boolean(
        isDocsTarget && targetRect &&
        (document.activeElement === target || keyboardActive || captureActive || voicePhase === "error" || voiceCandidate || commandOpen || selectionActionCandidate),
      ),
      phase: voicePhase,
      error: voiceError,
      pendingCopyText,
      candidate: voiceCandidate,
      profileContext: voiceProfileContext,
      profileOverrides: voiceProfileOverrides,
      command: commandOpen ? {
        phase: commandPhase,
        instruction: commandInstruction,
        project: commandProject,
        scope: commandScope,
        scopeExplicit: commandScopeExplicit,
        selectionAvailable: Boolean(selectionSnapshotRef.current?.text || pageSelectionSnapshotRef.current?.text),
        projects: voiceProfileContext?.projects.map((item) => item.name) ?? (commandProject ? [commandProject] : []),
        error: commandError,
        retryAvailable: Boolean(commandParseError || commandFailedRun),
        switchWriteAvailable: commandParseError,
        recorderSessionId: voiceSessionRef.current?.mode === "command" ? voiceSessionRef.current.id : undefined,
        activitySourceId: commandActivitySourceId,
        pendingVoiceId: commandPendingVoiceId,
      } : undefined,
      commandCandidate: selectionActionCandidate ? {
        skillName: selectionActionCandidate.skillName,
        text: selectionActionCandidate.text,
        primaryAction: selectionActionCandidate.editableSnapshot ? "Replace" : selectionActionCandidate.insertTarget ? "Insert" : "Copy",
        busyAction: selectionActionBusy,
        error: selectionActionError,
        project: selectionActionCandidate.projects[0],
        documents: candidateDocuments,
        keepUndoAvailable: Boolean(selectionActionCandidate.keepAdoption),
        documentUndoAvailable: Boolean(selectionActionCandidate.documentAdoption),
      } : undefined,
    })).catch(() => undefined);
  }, [candidateDocuments, commandError, commandFailedRun, commandInstruction, commandOpen, commandParseError, commandPhase, commandProject, commandScope, keyboardActive, pendingCopyText, selectionActionBusy, selectionActionCandidate, selectionActionError, targetRect, voiceCandidate, voiceError, voicePhase, voiceProfileContext, voiceProfileOverrides]);

  useEffect(() => {
    const docsTarget = googleDocsEditableTarget(document);
    if (!docsTarget || !isGoogleDocsDocumentTarget(docsTarget)) return;
    // The frame can finish mounting after its first focus event. Bind the
    // actual editor eagerly so a top-frame control always has a live target.
    if (!isGoogleDocsDocumentTarget(targetRef.current)) {
      targetRef.current = docsTarget;
      targetPageHrefRef.current = window.location.href;
      rememberExternalTarget(docsTarget);
      setTargetRect(docsTarget.getBoundingClientRect());
    }
  }, [rememberExternalTarget, targetRect]);

  useEffect(() => () => {
    if (selectionNoticeTimerRef.current) window.clearTimeout(selectionNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = targetRef.current;
      if (
        event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ||
        event.isComposing
      ) return;
      const docsTarget = googleDocsEditableTarget(document);
      const topPage = topLevelWindow();
      if (
        window.top !== window && topPage.location.hostname === "docs.google.com" &&
        docsTarget && document.activeElement === docsTarget
      ) {
        const button = topPage.document.getElementById("logue-extension-host")?.shadowRoot
          ?.querySelector<HTMLButtonElement>('button[aria-label="Start voice input"]');
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        button.focus({ preventScroll: true });
        return;
      }
      if (document.activeElement !== target || isGoogleDocsDocumentTarget(target)) return;
      const button = document.getElementById("logue-extension-host")?.shadowRoot
        ?.querySelector<HTMLButtonElement>('button[aria-label="Start voice input"]');
      if (!button) return;
      event.preventDefault();
      setKeyboardActive(true);
      button.focus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.isComposing || event.repeat || document.activeElement !== targetRef.current ||
        !selectionSnapshotRef.current || !eligibleSelectionSkills.length || voiceSessionRef.current
      ) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setFocusSelectionSkillTrigger(true);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [eligibleSelectionSkills.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldDismissSelectionSkills(
        event,
        Boolean(selectionSnapshotRef.current && eligibleSelectionSkills.length),
        Boolean(voiceSessionRef.current),
      )) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissSelectionSkills();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dismissSelectionSkills, eligibleSelectionSkills.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const session = selectionCommentSessionRef.current;
      if (!pageSelectionSnapshotRef.current && !session) return;
      if (event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const phase = selectionCommentPhaseRef.current;
      if (event.key === "Enter" && phase === "recording") {
        event.preventDefault();
        event.stopImmediatePropagation();
        acceptSelectionComment();
      } else if (event.key === "Escape" && phase !== "committing") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelSelectionComment();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [acceptSelectionComment, cancelSelectionComment]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const session = voiceSessionRef.current;
      if (!session) {
        if (commandOpen && event.key === "Escape" && !event.isComposing && !event.repeat) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeVoiceCommand();
        }
        return;
      }
      if (session.mode === "command") {
        if (event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === "Enter" && commandPhase === "recording") {
          event.preventDefault();
          event.stopImmediatePropagation();
          stopCommandVoice();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeVoiceCommand();
        }
        return;
      }
      const action = recordingShortcutAction({
        open: true,
        mode: "input",
        phase: voicePhaseRef.current,
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        isComposing: event.isComposing,
        repeat: event.repeat,
      });
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action === "stop-and-insert") stopAndInsertInlineVoice();
      if (action === "cancel") cancelInlineVoice();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [cancelInlineVoice, closeVoiceCommand, commandOpen, commandPhase, stopAndInsertInlineVoice, stopCommandVoice]);

  useEffect(() => {
    if (window.top !== window || !googleDocsProxy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (googleDocsProxy.command) {
        if (event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === "Enter" && googleDocsProxy.command.phase === "recording") {
          event.preventDefault();
          event.stopImmediatePropagation();
          controlGoogleDocsProxy("command-stop-voice");
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          controlGoogleDocsProxy("command-close");
        }
        return;
      }
      const action = recordingShortcutAction({
        open: true,
        mode: "input",
        phase: googleDocsProxy.phase,
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        isComposing: event.isComposing,
        repeat: event.repeat,
      });
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      controlGoogleDocsProxy(action === "stop-and-insert" ? "stop" : "cancel");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [googleDocsProxy]);

  useEffect(() => {
    if (window.top !== window) return;
    const url = pageSource().url;
    let cancelled = false;
    void getPageMaterials(url).then(async (materials) => {
      let changed = false;
      for (const material of materials) {
        if (cancelled || material.kind !== "selection" || !material.source?.selection || material.source.anchor?.status === "snapshot_only") continue;
        const status = findPageAnchor(material.source) ? "anchored" : "page_changed";
        if (material.source.anchor?.status === status) continue;
        await updateSourceAnchor(material.id, { action: "resolve", status, expectedRevision: material.source.anchor?.revision ?? 1 });
        changed = true;
      }
      if (changed && !cancelled) void chrome.runtime.sendMessage({ type: "logue:page-anchors-changed", url }).catch(() => undefined);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (window.top !== window) return;
    const listener = (event: MessageEvent<unknown>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const request = event.data as Partial<ExtensionTargetBridgeRequest> | undefined;
      if (
        request?.source !== "logue-web" || request.type !== "logue:target-bridge-request" ||
        typeof request.requestId !== "string" || ![
          "list",
          "insert",
          "undo",
          "shortcuts",
          "update-shortcut",
          "reset-shortcut",
          "pending-captures",
          "retry-pending-capture",
          "export-pending-capture",
          "delete-pending-capture",
        ].includes(String(request.action))
      ) return;
      void getServerURL().then(async (serverURL) => {
        if (new URL(serverURL).origin !== window.location.origin) return;
        const result = await chrome.runtime.sendMessage({ type: "logue:web-target-bridge", request }) as Omit<ExtensionTargetBridgeResponse, "source" | "type" | "requestId"> | undefined;
        const response: ExtensionTargetBridgeResponse = {
          source: "logue-extension",
          type: "logue:target-bridge-response",
          requestId: request.requestId!,
          ok: Boolean(result?.ok),
          targets: result?.targets,
          target: result?.target,
          undoToken: result?.undoToken,
          shortcuts: result?.shortcuts,
          pendingCaptures: result?.pendingCaptures,
          pendingCaptureExport: result?.pendingCaptureExport,
          error: result?.error,
        };
        window.postMessage(response, window.location.origin);
      }).catch(() => undefined);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    const listener = (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (value: unknown) => void) => {
      const googleDocsAction = readGoogleDocsLauncherAction(message);
      if (googleDocsAction) {
        sendResponse({ ok: controlGoogleDocsEditor(googleDocsAction) });
        return false;
      }
      const contentMessage = message as ContentMessage;
      if (contentMessage?.type === "logue:start-inline-voice") {
        const target = targetRef.current;
        if (!target || !isEditableTargetAvailable(target)) {
          sendResponse({ ok: false, error: "Focus a supported input first." });
          return false;
        }
        startInlineVoice();
        sendResponse({ ok: true });
        return false;
      }
      if (contentMessage?.type === "logue:start-voice-command") {
        startVoiceCommand(true);
        sendResponse({ ok: true });
        return false;
      }
      if (contentMessage?.type === "logue:resume-voice-command") {
        const recoveryEpoch = ++commandEpochRef.current;
        const instruction = contentMessage.instruction?.trim();
        const source = contentMessage.source;
        const activitySourceId = contentMessage.activitySourceId;
        const pendingVoiceId = contentMessage.pendingVoiceId;
        if (!instruction || !source?.url || !activitySourceId || !pendingVoiceId) {
          sendResponse({ ok: false, error: "This saved Voice Command is incomplete." });
          return false;
        }
        const recoverySource: CaptureSource = {
          url: source.url,
          title: source.title || source.domain || source.url,
          domain: source.domain || (() => { try { return new URL(source.url!).hostname; } catch { return ""; } })(),
        };
        const project = contentMessage.project?.trim() ?? "";
        const selection = contentMessage.selection?.trim() || undefined;
        const resolvedScope = contentMessage.scope === "auto"
          ? inferredCommandScope(instruction, Boolean(selection), project)
          : contentMessage.scope ?? "page";
        const target = targetRef.current;
        const targetAvailable = Boolean(
          contentMessage.targetAvailable && target &&
          targetSessionId(target) === contentMessage.targetSessionId &&
          isEditableTargetAvailable(target),
        );
        commandTargetRef.current = targetAvailable ? target : null;
        setCommandOpen(true);
        setCommandInstruction(instruction);
        setCommandProject(project);
        setCommandActivitySourceId(activitySourceId);
        setCommandPendingVoiceId(pendingVoiceId);
        setCommandFailedRun(undefined);
        setPendingCommandExecution(undefined);
        setCommandScopeExplicit(contentMessage.scope !== "auto");
        setCommandParseError(false);
        if (contentMessage.needsClarification || resolvedScope === "conflict" || (resolvedScope === "selection" && !selection) || (resolvedScope === "project" && !project)) {
          setCommandScope(selection ? "selection" : "page");
          setCommandPhase("editing");
          setCommandError("Choose whether this command should use the Selection, Page, or Project.");
          sendResponse({ ok: true });
          return false;
        }
        setCommandScope(resolvedScope);
        setCommandPhase("running");
        setCommandError("");
        const anchorRect = targetAvailable ? target!.getBoundingClientRect() : undefined;
        const execution: PendingCommandExecution = {
          instruction,
          scope: resolvedScope,
          project,
          source: resolvedScope === "selection" && selection ? { ...recoverySource, selection } : recoverySource,
          selection: resolvedScope === "selection" ? selection : undefined,
          pageText: resolvedScope === "page" ? contentMessage.pageText : undefined,
          targetText: targetAvailable ? getEditableText(target!) : contentMessage.targetText ?? "",
          targetSessionId: targetAvailable ? contentMessage.targetSessionId : undefined,
          targetAvailable,
          targetElement: targetAvailable ? target! : undefined,
          activitySourceId,
          pendingVoiceId,
          anchor: { left: anchorRect?.left ?? 24, top: (anchorRect?.bottom ?? 80) + 8 },
          editableSnapshot: resolvedScope === "selection" ? selectionSnapshotRef.current : undefined,
          epoch: recoveryEpoch,
          evidenceRequestId: `${activitySourceId}:evidence`,
          runRequestId: `${activitySourceId}:run`,
        };
        void runCommandExecutionRef.current(execution).catch((cause: unknown) => {
          if (cause instanceof ExtensionApiError) setCommandFailedRun(cause.run);
          if (isCommandParseFailure(cause)) setCommandParseError(true);
          setCommandPhase("editing");
          setCommandError(isCommandParseFailure(cause) ? "Couldn’t understand the action. Edit the intent, retry transcription, or switch to Voice Write." : cause instanceof Error ? cause.message : "Voice Command was saved, but could not run.");
        });
        sendResponse({ ok: true });
        return false;
      }
      if (contentMessage?.type === "logue:inline-recorder-event") {
        const event = { ...contentMessage, type: "logue:recording-bridge-event" } as RecordingBridgeEvent;
        if (!finishSelectionComment(event)) finishInlineVoice(event);
        sendResponse({ ok: true });
        return false;
      }
      if (contentMessage?.type === "logue:recording-dispose") {
        if (voiceSessionRef.current?.mode === "command") closeVoiceCommand();
        else cancelInlineVoice();
        sendResponse({ ok: true });
        return false;
      }
      if (contentMessage?.type === "logue:discover-input-target") {
        const session = liveExternalTarget();
        sendResponse(session ? { ok: true, value: externalTargetDescriptor(session) } : { ok: false });
        return false;
      }
      if (contentMessage?.type === "logue:insert-external-document") {
        const session = liveExternalTarget();
        if (!session || !contentMessage.sessionId || contentMessage.sessionId !== session.id || !contentMessage.text) {
          sendResponse({ ok: false, error: "This input is no longer available." });
          return false;
        }
        const transaction = insertIntoElementWithUndo(session.target, contentMessage.text);
        const token = transaction ? createRequestId() : undefined;
        externalInsertUndoRef.current = transaction && token ? { token, sessionId: session.id, transaction } : undefined;
        sendResponse(transaction && token
          ? { ok: true, value: externalTargetDescriptor(session), undoToken: token }
          : { ok: false, error: "Could not write to this input." });
        return false;
      }
      if (contentMessage?.type === "logue:undo-external-document") {
        const session = liveExternalTarget();
        const pending = externalInsertUndoRef.current;
        if (!session || !pending || contentMessage.sessionId !== session.id || pending.sessionId !== session.id || contentMessage.token !== pending.token) {
          sendResponse({ ok: false, error: "This insert can no longer be undone." });
          return false;
        }
        externalInsertUndoRef.current = undefined;
        sendResponse(pending.transaction.undo()
          ? { ok: true, value: externalTargetDescriptor(session) }
          : { ok: false, error: "The input changed after this insert, so Logue did not overwrite it." });
        return false;
      }
      if (contentMessage?.type === "logue:insert-text") {
        const target = targetRef.current;
        const matchesExpectedTarget = Boolean(
          contentMessage.expectedTargetSessionId &&
          contentMessage.expectedTargetSessionId === targetSessionId(target),
        );
        const transaction = contentMessage.text && matchesExpectedTarget && isEditableTargetAvailable(target)
          ? insertIntoElementWithUndo(target, contentMessage.text)
          : undefined;
        const token = transaction ? createRequestId() : undefined;
        lastInsertUndoRef.current = transaction && token ? { token, transaction } : undefined;
        sendResponse({ ok: Boolean(transaction), undoToken: token });
        return false;
      }
      if (contentMessage?.type === "logue:undo-insert") {
        const pending = lastInsertUndoRef.current;
        if (!pending || !contentMessage.token || pending.token !== contentMessage.token) {
          sendResponse({ ok: false });
          return false;
        }
        lastInsertUndoRef.current = undefined;
        sendResponse({ ok: pending.transaction.undo() });
        return false;
      }
      if (contentMessage?.type === "logue:locate-page-anchor") {
        const range = findPageAnchor(contentMessage.source);
        if (!range) {
          sendResponse({ ok: false });
          return false;
        }
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        const element = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
        element?.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
        sendResponse({ ok: true });
        return false;
      }
      if (contentMessage?.type === "logue:get-current-selection-anchor") {
        const snapshot = staticPageSelection();
        sendResponse({ ok: Boolean(snapshot), value: snapshot?.source });
        return false;
      }
      if (contentMessage?.type === "logue:get-page-context") {
        const target = targetRef.current;
        const targetAvailable = isEditableTargetAvailable(target);
        const selection = staticPageSelection();
        const context: PageCaptureContext = {
          source: selection?.source ?? pageSource(),
          candidateServerURL: logueServerCandidate(document, window.location.href),
          selectionText: (selection?.text ?? window.getSelection()?.toString().trim()) || undefined,
          targetText: targetAvailable ? getEditableText(target) : undefined,
          targetSessionId: targetAvailable ? targetSessionId(target) : undefined,
          targetAvailable,
          pageText: document.body?.innerText?.trim().slice(0, 80_000) || undefined,
        };
        sendResponse({
          ok: true,
          value: context,
        });
        return false;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    void chrome.runtime.sendMessage({ type: "logue:page-context-ready" }).catch(() => undefined);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [cancelInlineVoice, closeVoiceCommand, controlGoogleDocsEditor, externalTargetDescriptor, finishInlineVoice, finishSelectionComment, liveExternalTarget, startInlineVoice, startVoiceCommand]);

  const captureActive = voicePhase === "starting" || voicePhase === "recording" || voicePhase === "processing";
  const voiceFlowActive = captureActive || commandOpen || Boolean(voiceCandidate) || Boolean(selectionActionCandidate);
  const selectionCommentActive = selectionTextCommentOpen || selectionCommentPhase === "starting" || selectionCommentPhase === "recording" || selectionCommentPhase === "committing";
  const hasPageSelectionComment = Boolean(pageSelectionSnapshot && !voiceFlowActive && !isGoogleDocsDocumentTarget(targetRef.current));
  const skillSelectionAnchor = selectionSnapshot?.anchor ?? (pageSelectionSnapshot ? { left: Math.max(8, pageSelectionSnapshot.anchor.left - 92), top: pageSelectionSnapshot.anchor.bottom + 8 } : undefined);
  const hasSelectionSkillMenu = Boolean(selectionSnapshot && skillSelectionAnchor && eligibleSelectionSkills.length && !voiceFlowActive);
  const controlMetrics = inlineVoiceControlMetrics[voicePhase];
  const defaultPosition = targetRect ? defaultLauncherPosition(targetRect, viewport, controlMetrics.width, controlMetrics.height) : undefined;
  const position = defaultPosition ? clampLauncherPosition(defaultPosition, viewport, controlMetrics.width, controlMetrics.height) : undefined;
  const candidatePosition = targetRect ? defaultLauncherPosition(targetRect, viewport, 380, 252) : undefined;
  const commandAnchor = targetRect ?? pageSelectionSnapshot?.anchor;
  const commandPosition = commandAnchor
    ? clampLauncherPosition(defaultLauncherPosition(commandAnchor, viewport, 420, 244), viewport, 420, 244)
    : { left: Math.max(8, (viewport.width - 420) / 2), top: Math.max(8, Math.min(96, viewport.height / 5)) };
  const googleDocsMetrics = googleDocsProxy ? inlineVoiceControlMetrics[googleDocsProxy.phase] : undefined;
  const googleDocsPosition = googleDocsProxy && googleDocsMetrics
    // The Docs text-event iframe is hidden outside the viewport. Keep the
    // control inside the visible editor surface instead of the toolbar.
    ? clampLauncherPosition(
      {
        left: googleDocsProxy.anchor.right - googleDocsMetrics.width - 16,
        top: googleDocsProxy.anchor.top + 16,
      },
      viewport,
      googleDocsMetrics.width,
      googleDocsMetrics.height,
    )
    : undefined;
  const googleDocsCandidatePosition = googleDocsProxy?.candidate || googleDocsProxy?.commandCandidate
    ? clampLauncherPosition(
      {
        left: googleDocsProxy.anchor.right - 380 - 16,
        top: googleDocsProxy.anchor.top + 16,
      },
      viewport,
      380,
      252,
    )
    : undefined;
  const googleDocsErrorPlacement: { vertical: "above" | "below"; horizontal: "left" | "right" } = googleDocsPosition && googleDocsMetrics
    ? launcherErrorPlacement(googleDocsPosition, googleDocsMetrics.width)
    : { vertical: "below", horizontal: "right" };
  const errorPlacement: { vertical: "above" | "below"; horizontal: "left" | "right" } = position
    ? launcherErrorPlacement(position, controlMetrics.width)
    : { vertical: "below", horizontal: "right" };
  const isGoogleDocsEditorFrame = isGoogleDocsDocumentTarget(targetRef.current);
  const visible = Boolean(
    targetRect && position && !hasSelectionSkillMenu &&
    (document.activeElement === targetRef.current || keyboardActive || captureActive) &&
    !isGoogleDocsEditorFrame,
  );
  const googleDocsProxyVisible = Boolean(googleDocsProxy && googleDocsPosition);
  const selectionCommentWidth = selectionTextCommentOpen ? 360 : selectionCommentPhase === "recording" || selectionCommentPhase === "starting" ? 286 : Math.min(520, 156 + eligibleSelectionSkills.slice(0, 2).length * 112);
  const selectionCommentPosition = pageSelectionSnapshot ? {
    left: Math.max(8, Math.min(viewport.width - selectionCommentWidth - 8, pageSelectionSnapshot.anchor.right + 8)),
    top: Math.max(8, Math.min(
      viewport.height - 50,
      pageSelectionSnapshot.anchor.bottom + 50 > viewport.height
        ? pageSelectionSnapshot.anchor.top - 50
        : pageSelectionSnapshot.anchor.bottom + 8,
    )),
  } : undefined;

  function controlGoogleDocsProxy(action: GoogleDocsLauncherAction, values: Omit<GoogleDocsLauncherCommand, "action"> = {}) {
    const command = googleDocsProxy?.command;
    const commandValues = action.startsWith("command-") && command ? {
      text: googleDocsCommandInstructionRef.current ?? command.instruction,
      project: googleDocsCommandProjectRef.current ?? command.project,
      scope: googleDocsCommandScopeRef.current ?? command.scope,
      scopeExplicit: command.scopeExplicit,
      sessionId: command.recorderSessionId,
      activitySourceId: command.activitySourceId,
      pendingVoiceId: command.pendingVoiceId,
    } : {};
    if (action === "command-close") {
      googleDocsCommandInstructionRef.current = undefined;
      googleDocsCommandProjectRef.current = undefined;
      googleDocsCommandScopeRef.current = undefined;
      setGoogleDocsProxy(undefined);
    }
    const showError = () => {
      setGoogleDocsProxy((current) => current && {
        ...current,
        phase: "error",
        error: "Could not reach the active Google Docs editor.",
        pendingCopyText: "",
      });
    };
    void chrome.runtime.sendMessage(googleDocsLauncherActionMessage(action, action === "start" ? { overrides: voiceProfileOverrides } : { ...commandValues, ...values }))
      .then((response: { ok?: boolean } | undefined) => {
        if (!response?.ok) showError();
      })
      .catch(showError);
  }

  function rememberSelectionSkill(skillId: string) {
    const next = [
      skillId,
      ...recentSelectionSkillIds.filter((id) => id !== skillId),
    ].slice(0, 8);
    setRecentSelectionSkillIds(next);
    void chrome.storage.local
      .set({ [selectionSkillRecencyKey]: next })
      .catch(() => undefined);
  }

  async function applySelectionSkill(skillId: string) {
    const editableSnapshot = selectionSnapshotRef.current;
    const pageSnapshot = pageSelectionSnapshotRef.current;
    const target = targetRef.current;
    if (!editableSnapshot && !pageSnapshot) return;
    if (editableSnapshot && (!target || !isEditableTargetAvailable(target))) {
      showSelectionSkillNotice({ anchor: editableSnapshot.anchor, message: "Selection changed — choose a skill again." });
      return;
    }
    const skill = eligibleSelectionSkills.find((item) => item.id === skillId);
    if (!skill) {
      const anchor = editableSnapshot?.anchor ?? { left: pageSnapshot!.anchor.left, top: pageSnapshot!.anchor.bottom + 8 };
      showSelectionSkillNotice({ anchor, message: "That skill is no longer available." });
      return;
    }
    const selectedText = editableSnapshot?.text ?? pageSnapshot!.text;
    const response = await chrome.runtime.sendMessage({ type: "logue:get-tab-projects" }) as { ok?: boolean; value?: string[] } | undefined;
    const projects = response?.ok && Array.isArray(response.value) ? response.value : [];
    const source = pageSnapshot?.source ?? { ...pageSource(), selection: selectedText };
    const inputSource = await saveMaterial({
      requestId: createRequestId(),
      kind: editableSnapshot ? "text" : "selection",
      content: selectedText,
      source,
      projects,
      actor: "user",
    });
    const run = await createExtensionSkillRun({
      skillId: skill.id,
      instruction: "Transform only the selected text. Return only the replacement text.",
      project: projects[0],
      pageTitle: document.title,
      pageUrl: window.location.href,
      targetText: editableSnapshot && target ? getEditableText(target) : undefined,
      selection: selectedText,
      sourceIds: [inputSource.id],
      autoSearch: false,
    });
    const replacement = normalizeSelectionSkillReplacement(run.original_output);
    if (!replacement) throw new Error("This skill returned no text.");
    const anchor = editableSnapshot?.anchor ?? { left: pageSnapshot!.anchor.left, top: pageSnapshot!.anchor.bottom + 8 };
    setSelectionActionError("");
    setSelectionActionCandidate({ runId: run.id, skillName: skill.name, text: replacement, originalText: selectedText, source, projects, anchor, editableSnapshot, sources: run.sources ?? [] });
    void getExtensionDocuments().then(setCandidateDocuments).catch(() => setCandidateDocuments([]));
    rememberSelectionSkill(skill.id);
  }

  function dismissSelectionActionCandidate() {
    const focusTarget = selectionActionCandidate?.insertTarget ?? selectionActionCandidate?.editableSnapshot?.target ?? commandTargetRef.current;
    setSelectionActionCandidate(undefined);
    setSelectionActionError("");
    selectionSnapshotRef.current = undefined;
    pageSelectionSnapshotRef.current = undefined;
    setSelectionSnapshot(undefined);
    setPageSelectionSnapshot(undefined);
    if (isEditableTargetAvailable(focusTarget)) focusTarget.focus({ preventScroll: true });
    commandTargetRef.current = null;
  }

  async function copySelectionActionCandidate(textOverride?: string) {
    const currentCandidate = selectionActionCandidate;
    const candidate = currentCandidate && textOverride !== undefined ? { ...currentCandidate, text: textOverride } : currentCandidate;
    if (!candidate || selectionActionBusy) return;
    setSelectionActionBusy("copy");
    setSelectionActionError("");
    const previousAttempt = candidate.adoptionAttempts?.copy;
    const adoptionId = previousAttempt?.content === candidate.text ? previousAttempt.id : createRequestId();
    const pendingCandidate = { ...candidate, adoptionAttempts: { ...candidate.adoptionAttempts, copy: { id: adoptionId, content: candidate.text } } };
    setSelectionActionCandidate(pendingCandidate);
    try {
      await navigator.clipboard.writeText(candidate.text);
      await adoptExtensionSkillRun(candidate.runId, candidate.text, { action: "copy", adoptionId, target: { surface: "clipboard", url: candidate.source.url, target_key: `selection:${candidate.runId}` } });
      dismissSelectionActionCandidate();
    } catch (cause) {
      setSelectionActionError(cause instanceof Error ? cause.message : "Could not copy this result.");
    } finally {
      setSelectionActionBusy(undefined);
    }
  }

  async function applySelectionActionCandidate(textOverride?: string) {
    const currentCandidate = selectionActionCandidate;
    const candidate = currentCandidate && textOverride !== undefined ? { ...currentCandidate, text: textOverride } : currentCandidate;
    if (!candidate || selectionActionBusy) return;
    if (!candidate.editableSnapshot && !candidate.insertTarget) { await copySelectionActionCandidate(); return; }
    setSelectionActionBusy("primary");
    setSelectionActionError("");
    try {
      const isInsert = !candidate.editableSnapshot;
      const insertTarget = candidate.insertTarget;
      if (isInsert && (
        !insertTarget || !isEditableTargetAvailable(insertTarget) ||
        targetSessionId(insertTarget) !== candidate.insertTargetSessionId ||
        getEditableText(insertTarget) !== candidate.insertTargetText
      )) throw new Error("The original input changed. Copy this result instead.");
      const replacement = candidate.editableSnapshot
        ? replaceSelectionWithUndoIfUnchanged(candidate.editableSnapshot, candidate.text)
        : insertIntoElementWithUndo(insertTarget!, candidate.text);
      if (!replacement) throw new Error(isInsert ? "Could not insert into the original input." : "Selection changed. Run the Skill again on the current text.");
      const target = {
        surface: isInsert ? "inline-command" : "inline-selection",
        url: candidate.source.url,
        target_key: isInsert ? candidate.insertTargetSessionId : `selection:${candidate.runId}`,
      };
      const adoption = { runId: candidate.runId, replacement: candidate.text, adoptionId: createRequestId(), target };
      const history = await saveSelectionSkillHistory(
        adoption,
        (id, text, adoptionId, frozenTarget) => adoptExtensionSkillRun(id, text, { action: isInsert ? "insert" : "replace", adoptionId, target: frozenTarget }),
      );
      showSelectionSkillNotice({
        anchor: candidate.anchor,
        message: history ? `${isInsert ? "Text inserted" : "Text replaced"}, but history wasn’t saved.` : "Applied",
        history,
        undo: { adoption, replacement },
      });
      dismissSelectionActionCandidate();
    } catch (cause) {
      setSelectionActionError(cause instanceof Error ? cause.message : "Could not replace this selection.");
    } finally {
      setSelectionActionBusy(undefined);
    }
  }

  async function keepSelectionActionCandidate(textOverride?: string) {
    const currentCandidate = selectionActionCandidate;
    const candidate = currentCandidate && textOverride !== undefined ? { ...currentCandidate, text: textOverride } : currentCandidate;
    if (!candidate || selectionActionBusy) return;
    setSelectionActionBusy("keep");
    setSelectionActionError("");
    const target = {
      surface: "inline-selection",
      url: candidate.source.url,
      target_key: `selection:${candidate.runId}`,
    };
    const attempt = prepareSelectionActionKeep(
      candidate.adoptionAttempts?.keep,
      candidate.text,
      target,
      createRequestId,
    );
    const pendingCandidate = {
      ...candidate,
      adoptionAttempts: { ...candidate.adoptionAttempts, keep: attempt },
    };
    setSelectionActionCandidate(pendingCandidate);
    try {
      await adoptExtensionSkillRun(candidate.runId, attempt.content, {
        action: "keep",
        adoptionId: attempt.id,
        target: attempt.target,
      });
      setSelectionActionCandidate((current) =>
        current?.runId === candidate.runId
          ? {
              ...current,
              adoptionAttempts: {
                ...current.adoptionAttempts,
                keep: undefined,
              },
              keepAdoption: completeSelectionActionKeep(
                candidate.runId,
                attempt,
              ),
            }
          : current,
      );
    } catch (cause) {
      setSelectionActionError(cause instanceof Error ? cause.message : "Could not keep this result.");
    } finally {
      setSelectionActionBusy(undefined);
    }
  }

  async function undoSelectionActionKeep() {
    const candidate = selectionActionCandidate;
    const adoption = candidate?.keepAdoption;
    if (!candidate || !adoption || selectionActionBusy) return;
    setSelectionActionBusy("keep");
    setSelectionActionError("");
    try {
      await adoptExtensionSkillRun(adoption.runId, adoption.content, {
        action: "undo",
        adoptionId: adoption.id,
        target: adoption.target,
      });
      setSelectionActionCandidate((current) =>
        current?.runId === adoption.runId
          ? { ...current, keepAdoption: undefined }
          : current,
      );
    } catch (cause) {
      setSelectionActionError(
        cause instanceof Error
          ? cause.message
          : "Could not undo Keep in Logue.",
      );
    } finally {
      setSelectionActionBusy(undefined);
    }
  }

  async function saveSelectionActionDocument(textOverride?: string, targetDocument?: ExtensionDocument) {
    const currentCandidate = selectionActionCandidate;
    const candidate = currentCandidate && textOverride !== undefined ? { ...currentCandidate, text: textOverride } : currentCandidate;
    if (!candidate || selectionActionBusy) return;
    setSelectionActionBusy("document");
    setSelectionActionError("");
    const targetKey = targetDocument?.id ?? "new";
    const previousAttempt = candidate.adoptionAttempts?.document;
    const adoptionId = previousAttempt?.content === candidate.text && previousAttempt.targetKey === targetKey ? previousAttempt.id : createRequestId();
    const pendingCandidate = { ...candidate, adoptionAttempts: { ...candidate.adoptionAttempts, document: { id: adoptionId, content: candidate.text, targetKey } } };
    setSelectionActionCandidate(pendingCandidate);
    try {
      const sourceIds = candidate.sources.map((source) => source.id);
      const content = /\[Source \d+\]/.test(candidate.text) ? candidate.text : `${candidate.text}\n\n[Source 1]`;
      const saved = await saveExtensionSkillRunAsDocument(candidate.runId, {
        title: targetDocument?.title ?? `${candidate.skillName} result`,
        content,
        documentId: targetDocument?.id,
        project: candidate.projects[0],
        sourceIds,
        contextSourceIds: sourceIds,
        sources: candidate.sources,
        contextSources: candidate.sources,
        expectedRevision: targetDocument?.revision,
        adoptionId,
        adoptionAction: targetDocument ? "replace" : "document",
        target: { surface: "inline-selection", url: candidate.source.url, target_key: targetDocument ? `document:${targetDocument.id}` : `project:${candidate.projects[0] ?? ""}:new-document` },
      });
      if (targetDocument) {
        setCandidateDocuments((items) => [saved.document, ...items.filter((item) => item.id !== saved.document.id)]);
        setSelectionActionCandidate((current) => current ? { ...current, documentAdoption: { id: adoptionId, documentId: saved.document.id, documentRevision: saved.document.revision } } : current);
      } else dismissSelectionActionCandidate();
    } catch (cause) {
      setSelectionActionError(cause instanceof Error ? cause.message : "Could not save this document.");
    } finally {
      setSelectionActionBusy(undefined);
    }
  }

  async function undoSelectionActionDocument() {
    const candidate = selectionActionCandidate;
    const adoption = candidate?.documentAdoption;
    if (!candidate || !adoption || selectionActionBusy) return;
    setSelectionActionBusy("document");
    setSelectionActionError("");
    try {
      const restored = await saveExtensionSkillRunAsDocument(candidate.runId, {
        title: `${candidate.skillName} result`,
        content: candidate.text,
        documentId: adoption.documentId,
        expectedRevision: adoption.documentRevision,
        adoptionId: adoption.id,
        adoptionAction: "undo",
        target: { surface: "inline-selection", url: candidate.source.url, target_key: `document:${adoption.documentId}` },
      });
      setCandidateDocuments((items) => [restored.document, ...items.filter((item) => item.id !== restored.document.id)]);
      dismissSelectionActionCandidate();
    } catch (cause) {
      setSelectionActionError(cause instanceof Error ? cause.message : "Could not undo this Document update.");
    } finally {
      setSelectionActionBusy(undefined);
    }
  }

  async function retrySelectionSkillHistory() {
    const notice = selectionSkillNotice;
    if (!notice?.history) return;
    const retry = await saveSelectionSkillHistory(
      notice.history,
      (id, text, adoptionId, target) => adoptExtensionSkillRun(id, text, { action: target.surface === "inline-command" ? "insert" : "replace", adoptionId, target }),
    );
    if (retry) {
      setSelectionSkillNotice({ ...notice, history: retry });
      return;
    }
    showSelectionSkillNotice({ ...notice, history: undefined });
  }

  async function undoSelectionSkill() {
    const notice = selectionSkillNotice;
    if (!notice?.undo) return;
    const undo = notice.undo;
    if (!undo.localApplied && !undo.replacement.undo()) {
      setSelectionSkillNotice({ ...notice, message: "The editor changed, so Logue didn’t overwrite it." });
      return;
    }
    const locallyUndone = { ...undo, localApplied: true };
    if (notice.history) {
      const retry = await saveSelectionSkillHistory(
        notice.history,
        (id, text, adoptionId, target) => adoptExtensionSkillRun(id, text, { action: target.surface === "inline-command" ? "insert" : "replace", adoptionId, target }),
      );
      if (retry) {
        setSelectionSkillNotice({ ...notice, message: "Text restored, but Logue could not save Undo.", history: retry, undo: locallyUndone });
        return;
      }
    }
    try {
      await adoptExtensionSkillRun(undo.adoption.runId, undo.adoption.replacement, {
        action: "undo",
        adoptionId: undo.adoption.adoptionId,
        target: undo.adoption.target,
      });
      setSelectionSkillNotice(undefined);
    } catch {
      setSelectionSkillNotice({ ...notice, message: "Text restored, but Logue could not save Undo.", history: undefined, undo: locallyUndone });
    }
  }

  if (!visible && !hasSelectionSkillMenu && !googleDocsProxyVisible && !hasPageSelectionComment && !commandOpen) return null;
  return (
    <>
      {commandOpen ? <V2CommandLauncherSurface
        phase={commandPhase}
        instruction={commandInstruction}
        project={commandProject}
        scope={commandScope}
        selectionAvailable={Boolean(selectionSnapshotRef.current?.text || pageSelectionSnapshotRef.current?.text || window.getSelection()?.toString().trim())}
        projects={voiceProfileContext?.projects.map((item) => item.name) ?? (commandProject ? [commandProject] : [])}
        scopeLabel={commandScope === "selection" ? "Selection" : commandScope === "project" ? "Project Sources" : "Page"}
        targetLabel={isEditableTargetAvailable(targetRef.current) ? editableTargetLabel(targetRef.current) : "Copy or save result"}
        error={commandError}
        style={commandPosition}
        onInstructionChange={(value) => { setCommandInstruction(value); setCommandParseError(false); setCommandError(""); }}
        onProjectChange={(value) => { setCommandProject(value); setCommandError(""); }}
        onScopeChange={(value) => { setCommandScope(value); setCommandScopeExplicit(true); setCommandError(""); }}
        onSubmit={() => submitVoiceCommand()}
        onStartVoice={startCommandVoice}
        onStopVoice={stopCommandVoice}
        onCancelVoice={cancelCommandVoice}
        onRetry={commandParseError ? retryCommandTranscription : commandFailedRun ? retryVoiceCommand : undefined}
        onSwitchToVoiceWrite={commandParseError ? switchCommandToVoiceWrite : undefined}
        onClose={closeVoiceCommand}
      /> : null}
      {hasPageSelectionComment && selectionCommentPosition && <V2SelectionSurface
        phase={selectionCommentPhase}
        style={selectionCommentPosition}
        error={selectionCommentError}
        textOpen={selectionTextCommentOpen}
        textValue={selectionTextComment}
        textSaving={selectionTextCommentSaving}
        skills={eligibleSelectionSkills}
        onStart={startSelectionComment}
        onAccept={acceptSelectionComment}
        onCancel={cancelSelectionComment}
        onTextOpen={() => {
          setSelectionCommentError("");
          setSelectionTextCommentOpen(true);
          setVoiceProfilePickerOpen(false);
        }}
        onTextChange={setSelectionTextComment}
        onTextSave={saveTextSelectionComment}
        onSaveSelection={savePageSelection}
        onUseSkill={applySelectionSkill}
        profileContext={voiceProfileContext}
        profileOverrides={voiceProfileOverrides}
        profilePickerOpen={voiceProfilePickerOpen}
        onProfileOverridesChange={setVoiceProfileOverrides}
        onProfilePickerOpenChange={setVoiceProfilePickerOpen}
      />}
      {hasSelectionSkillMenu && skillSelectionAnchor && <SelectionSkillMenu
        anchor={skillSelectionAnchor}
        skills={eligibleSelectionSkills}
        onUseSkill={applySelectionSkill}
        focusTrigger={focusSelectionSkillTrigger}
        onFocusTriggerHandled={() => setFocusSelectionSkillTrigger(false)}
        onDismiss={() => {
          dismissSelectionSkills();
        }}
      />}
      {selectionActionCandidate && <SelectionActionCandidate
        skillName={selectionActionCandidate.skillName}
        text={selectionActionCandidate.text}
        primaryAction={selectionActionCandidate.editableSnapshot ? "Replace" : selectionActionCandidate.insertTarget ? "Insert" : "Copy"}
        anchor={selectionActionCandidate.anchor}
        busyAction={selectionActionBusy}
        error={selectionActionError}
        project={selectionActionCandidate.projects[0]}
        documents={candidateDocuments}
        keepUndoAvailable={Boolean(selectionActionCandidate.keepAdoption)}
        documentUndoAvailable={Boolean(selectionActionCandidate.documentAdoption)}
        onTextChange={(text) => setSelectionActionCandidate((current) => current ? { ...current, text } : current)}
        onPrimary={() => void applySelectionActionCandidate()}
        onCopy={() => void copySelectionActionCandidate()}
        onKeep={() => void keepSelectionActionCandidate()}
        onUndoKeep={() => void undoSelectionActionKeep()}
        onSaveDocument={(document) => void saveSelectionActionDocument(undefined, document as ExtensionDocument | undefined)}
        onUndoDocument={() => void undoSelectionActionDocument()}
        onCancel={dismissSelectionActionCandidate}
      />}
      {selectionSkillNotice && <div
        className="v2-selection-feedback"
        role={selectionSkillNotice.history ? "status" : "alert"}
        style={{ left: selectionSkillNotice.anchor.left, top: selectionSkillNotice.anchor.top }}
      >
        {selectionSkillNotice.message}
        {selectionSkillNotice.history ? <button type="button" onClick={() => void retrySelectionSkillHistory()}>Retry save</button> : null}
        {selectionSkillNotice.undo ? <button type="button" onClick={() => void undoSelectionSkill()}>{selectionSkillNotice.undo.localApplied ? "Retry saving Undo" : "Undo"}</button> : null}
      </div>}
      {visible && !commandOpen && !voiceCandidate && !selectionCommentActive && !hasPageSelectionComment && <V2InlineVoiceSurface
        phase={voicePhase}
        style={{ top: position?.top, left: position?.left }}
        onStart={() => startInlineVoice()}
        onStartCommand={() => startVoiceCommand(true)}
        onCancel={cancelInlineVoice}
        onStopAndInsert={stopAndInsertInlineVoice}
        error={voiceError}
        pendingCopyText={pendingCopyText}
        onCopy={() => void navigator.clipboard.writeText(pendingCopyText)}
        errorPlacement={errorPlacement}
        profileContext={voiceProfileContext}
        profileOverrides={voiceProfileOverrides}
        profilePickerOpen={voiceProfilePickerOpen}
        onProfileOverridesChange={setVoiceProfileOverrides}
        onProfilePickerOpenChange={setVoiceProfilePickerOpen}
      />}
      {visible && voiceCandidate && candidatePosition && !isGoogleDocsDocumentTarget(targetRef.current) && <V2VoiceCandidateSurface
        candidate={voiceCandidate}
        context={voiceProfileContext}
        overrides={voiceProfileOverrides}
        onOverridesChange={setVoiceProfileOverrides}
        onTextChange={(text) => setVoiceCandidate((current) => current ? { ...current, text } : current)}
        onRetranscribe={retranscribeVoiceCandidate}
        onInsert={() => insertVoiceCandidate()}
        onCopy={() => copyVoiceCandidate()}
        onUndo={undoVoiceCandidate}
        onRetryAdoption={retryVoiceCandidateAdoption}
        onDismiss={dismissVoiceCandidate}
        style={{ top: candidatePosition.top, left: candidatePosition.left }}
      />}
      {googleDocsProxyVisible && googleDocsProxy?.command && <V2CommandLauncherSurface
        phase={googleDocsProxy.command.phase}
        instruction={googleDocsProxy.command.instruction}
        project={googleDocsProxy.command.project}
        scope={googleDocsProxy.command.scope}
        selectionAvailable={googleDocsProxy.command.selectionAvailable}
        projects={googleDocsProxy.command.projects}
        scopeLabel={googleDocsProxy.command.scope === "selection" ? "Selection" : googleDocsProxy.command.scope === "project" ? "Project Sources" : "Page"}
        targetLabel="Google Docs"
        error={googleDocsProxy.command.error}
        style={{ top: googleDocsPosition?.top, left: googleDocsPosition?.left }}
        onInstructionChange={(text) => {
          googleDocsCommandInstructionRef.current = text;
          setGoogleDocsProxy((current) => current?.command ? { ...current, command: { ...current.command, instruction: text } } : current);
          controlGoogleDocsProxy("command-text", { text });
        }}
        onProjectChange={(project) => {
          googleDocsCommandProjectRef.current = project;
          setGoogleDocsProxy((current) => current?.command ? { ...current, command: { ...current.command, project } } : current);
          controlGoogleDocsProxy("command-project", { project });
        }}
        onScopeChange={(scope) => {
          googleDocsCommandScopeRef.current = scope;
          setGoogleDocsProxy((current) => current?.command ? { ...current, command: { ...current.command, scope, scopeExplicit: true } } : current);
          controlGoogleDocsProxy("command-scope", { scope, scopeExplicit: true });
        }}
        onSubmit={() => controlGoogleDocsProxy("command-submit")}
        onStartVoice={() => controlGoogleDocsProxy("command-start-voice")}
        onStopVoice={() => controlGoogleDocsProxy("command-stop-voice")}
        onCancelVoice={() => controlGoogleDocsProxy("command-cancel-voice")}
        onRetry={googleDocsProxy.command.retryAvailable ? () => controlGoogleDocsProxy("command-retry") : undefined}
        onSwitchToVoiceWrite={googleDocsProxy.command.switchWriteAvailable ? () => controlGoogleDocsProxy("command-switch-write") : undefined}
        onClose={() => controlGoogleDocsProxy("command-close")}
      />}
      {googleDocsProxyVisible && googleDocsProxy && !googleDocsProxy.command && !googleDocsProxy.commandCandidate && !googleDocsProxy.candidate && <V2InlineVoiceSurface
        phase={googleDocsProxy.phase}
        style={{ top: googleDocsPosition?.top, left: googleDocsPosition?.left }}
        onStart={() => controlGoogleDocsProxy("start")}
        onStartCommand={() => controlGoogleDocsProxy("command-open")}
        onCancel={() => controlGoogleDocsProxy("cancel")}
        onStopAndInsert={() => controlGoogleDocsProxy("stop")}
        error={googleDocsProxy.error}
        pendingCopyText={googleDocsProxy.pendingCopyText}
        onCopy={() => void navigator.clipboard.writeText(googleDocsProxy.pendingCopyText)}
        errorPlacement={googleDocsErrorPlacement}
        profileContext={voiceProfileContext}
        profileOverrides={voiceProfileOverrides}
        profilePickerOpen={voiceProfilePickerOpen}
        onProfileOverridesChange={setVoiceProfileOverrides}
        onProfilePickerOpenChange={setVoiceProfilePickerOpen}
      />}
      {googleDocsProxy?.commandCandidate && googleDocsCandidatePosition && <SelectionActionCandidate
        skillName={googleDocsProxy.commandCandidate.skillName}
        text={googleDocsProxy.commandCandidate.text}
        primaryAction={googleDocsProxy.commandCandidate.primaryAction}
        anchor={{ left: googleDocsCandidatePosition.left, top: googleDocsCandidatePosition.top }}
        busyAction={googleDocsProxy.commandCandidate.busyAction}
        error={googleDocsProxy.commandCandidate.error}
        project={googleDocsProxy.commandCandidate.project}
        documents={googleDocsProxy.commandCandidate.documents}
        keepUndoAvailable={googleDocsProxy.commandCandidate.keepUndoAvailable}
        documentUndoAvailable={googleDocsProxy.commandCandidate.documentUndoAvailable}
        onTextChange={(text) => controlGoogleDocsProxy("command-candidate-text", { text })}
        onPrimary={() => controlGoogleDocsProxy("command-candidate-primary", { text: googleDocsProxy.commandCandidate?.text })}
        onCopy={() => controlGoogleDocsProxy("command-candidate-copy", { text: googleDocsProxy.commandCandidate?.text })}
        onKeep={() => controlGoogleDocsProxy("command-candidate-keep", { text: googleDocsProxy.commandCandidate?.text })}
        onUndoKeep={() => controlGoogleDocsProxy("command-candidate-keep-undo")}
        onSaveDocument={(document) => controlGoogleDocsProxy("command-candidate-document", { text: googleDocsProxy.commandCandidate?.text, document: document as ExtensionDocument | undefined })}
        onUndoDocument={() => controlGoogleDocsProxy("command-candidate-document-undo")}
        onCancel={() => controlGoogleDocsProxy("command-candidate-dismiss")}
      />}
      {googleDocsProxy?.candidate && googleDocsCandidatePosition && <V2VoiceCandidateSurface
        candidate={googleDocsProxy.candidate}
        context={googleDocsProxy.profileContext}
        overrides={googleDocsProxy.profileOverrides ?? {}}
        onOverridesChange={(overrides) => {
          setGoogleDocsProxy((current) => current ? { ...current, profileOverrides: overrides } : current);
          controlGoogleDocsProxy("candidate-overrides", { overrides });
        }}
        onTextChange={(text) => {
          setGoogleDocsProxy((current) => current?.candidate ? { ...current, candidate: { ...current.candidate, text } } : current);
          controlGoogleDocsProxy("candidate-text", { text });
        }}
        onRetranscribe={(retranscribeInput) => controlGoogleDocsProxy("candidate-retranscribe", { retranscribeInput, overrides: googleDocsProxy.profileOverrides ?? {} })}
        onInsert={() => controlGoogleDocsProxy("candidate-insert", { text: googleDocsProxy.candidate?.text })}
        onCopy={() => void navigator.clipboard.writeText(googleDocsProxy.candidate?.text ?? "").then(() => controlGoogleDocsProxy("candidate-copy"))}
        onUndo={() => controlGoogleDocsProxy("candidate-undo")}
        onRetryAdoption={() => controlGoogleDocsProxy("candidate-retry")}
        onDismiss={() => controlGoogleDocsProxy("candidate-dismiss")}
        style={{ top: googleDocsCandidatePosition.top, left: googleDocsCandidatePosition.left }}
      />}
    </>
  );
}

if (!isLogueExtensionDisabledDocument(document, window.location.href) && !document.getElementById("logue-extension-host")) {
  const host = document.createElement("div");
  host.id = "logue-extension-host";
  host.dataset.logueExtension = "disabled";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  document.documentElement.append(host);
  createRoot(mount).render(<StrictMode><ExtensionLauncher /></StrictMode>);
}
