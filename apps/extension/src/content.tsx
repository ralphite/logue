import { SelectionSkillMenu, captureStableEditableSelection, replaceSelectionIfUnchanged, saveSelectionSkillHistory, selectionSkillDismissalStillApplies, selectionSkillEligibility, type EditableSelectionSnapshot, type SelectionSkillApplyTransaction } from "@logue/ui";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { adoptExtensionSkillRun, cancelMaterialSave, createExtensionSkillRun, getCaptureContext, getExtensionSkills, saveMaterial, transcribeAudio, type AppliedContext, type ExtensionSkill } from "./api";
import { activeEditableElement, getEditableText, googleDocsEditorFrame, insertIntoElement, isEditableElement, isEditableTargetAvailable, isGoogleDocsDocumentTarget, isGoogleDocsEditorFocused } from "./dom";
import { hasNativeSelectionSkillOwner, isLogueExtensionDisabledDocument, logueServerCandidate } from "./eligibility";
import {
  googleDocsLauncherActionMessage,
  googleDocsLauncherStateMessage,
  readGoogleDocsLauncherAction,
  readGoogleDocsLauncherEditorFrameId,
  readGoogleDocsLauncherState,
  type GoogleDocsLauncherAction,
  type GoogleDocsLauncherState,
} from "./googleDocsLauncherBridge";
import { clampLauncherPosition, defaultLauncherPosition, inlineVoiceControlMetrics, launcherErrorPlacement } from "./launcherPosition";
import type { CaptureSource, PageCaptureContext } from "./capturePrimitives";
import {
  audioBlobFromEvent,
  createContentRecordingBridge,
  type ContentRecordingBridge,
  type RecordingBridgeEvent,
  type RecordingControlMessage,
  type RecordingDisposeMessage,
} from "./recordingBridge";
import { recordingShortcutAction } from "./recordingShortcuts";
import { createRequestId } from "./requestId";
import { selectionSkillInvocationState } from "./selectionSkillInvocation";
import { completeVoiceInput, VoiceInputTransactionError } from "./transaction";
import { InlineVoiceControls, type InlineVoicePhase } from "./InlineVoiceControls";
import styles from "./extension.css?inline";

interface ContentRequestMessage {
  type: "logue:insert-text" | "logue:get-page-context";
  text?: string;
}

type ContentMessage = ContentRequestMessage | RecordingControlMessage | RecordingDisposeMessage;

interface InlineVoiceSession {
  id: string;
  target: HTMLElement;
  targetPageHref: string;
  source: CaptureSource;
  targetText: string;
}

interface GoogleDocsProxyState extends GoogleDocsLauncherState {
  anchor: DOMRect;
  editorFrameId?: number;
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

function ExtensionLauncher() {
  const [targetRect, setTargetRect] = useState<DOMRect>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [voicePhase, setVoicePhase] = useState<InlineVoicePhase>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [pendingCopyText, setPendingCopyText] = useState("");
  const [googleDocsProxy, setGoogleDocsProxy] = useState<GoogleDocsProxyState>();
  const [selectionSnapshot, setSelectionSnapshot] = useState<EditableSelectionSnapshot>();
  const [selectionSkills, setSelectionSkills] = useState<ExtensionSkill[]>([]);
  const [selectionSkillNotice, setSelectionSkillNotice] = useState<{
    anchor: { left: number; top: number };
    message: string;
    history?: SelectionSkillApplyTransaction;
  }>();
  const [focusSelectionSkillTrigger, setFocusSelectionSkillTrigger] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const targetRef = useRef<HTMLElement | null>(null);
  const targetPageHrefRef = useRef("");
  const voicePhaseRef = useRef<InlineVoicePhase>("idle");
  const voiceSessionRef = useRef<InlineVoiceSession | undefined>(undefined);
  const recordingBridgeRef = useRef<ContentRecordingBridge | undefined>(undefined);
  const selectionSnapshotRef = useRef<EditableSelectionSnapshot | undefined>(undefined);
  const dismissedSelectionSnapshotRef = useRef<EditableSelectionSnapshot | undefined>(undefined);
  const selectionRefreshFrameRef = useRef<number | undefined>(undefined);
  const selectionSkillsLoadedRef = useRef(false);
  const selectionNoticeTimerRef = useRef<number | undefined>(undefined);
  const eligibleSelectionSkills = selectionSkillEligibility(selectionSkills, "extension");

  const setInlineVoicePhase = useCallback((phase: InlineVoicePhase) => {
    voicePhaseRef.current = phase;
    setVoicePhase(phase);
  }, []);

  const restoreTargetFocus = useCallback((session?: InlineVoiceSession) => {
    if (!session || !isEditableTargetAvailable(session.target, session.targetPageHref, window.location.href)) return;
    window.requestAnimationFrame(() => session.target.focus({ preventScroll: true }));
  }, []);

  const cancelInlineVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session) return;
    const wasProcessing = voicePhaseRef.current === "processing";
    voiceSessionRef.current = undefined;
    recordingBridgeRef.current?.handle({ type: "logue:recording-control", action: "cancel", sessionId: session.id });
    if (wasProcessing) void cancelMaterialSave(session.id).catch(() => undefined);
    setInlineVoicePhase("idle");
    setVoiceError("");
    setPendingCopyText("");
    restoreTargetFocus(session);
  }, [restoreTargetFocus, setInlineVoicePhase]);

  const clearTarget = useCallback(() => {
    cancelInlineVoice();
    targetRef.current = null;
    targetPageHrefRef.current = "";
    setTargetRect(undefined);
    selectionSnapshotRef.current = undefined;
    setSelectionSnapshot(undefined);
    setKeyboardActive(false);
  }, [cancelInlineVoice]);

  const refreshTarget = useCallback(() => {
    const target = targetRef.current;
    if (!isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href)) {
      clearTarget();
      return;
    }
    setTargetRect(target.getBoundingClientRect());
  }, [clearTarget]);

  const refreshSelectionSkillTarget = useCallback(() => {
    const target = targetRef.current;
    if (
      !isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href) ||
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
    dismissedSelectionSnapshotRef.current = undefined;
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
  }) => {
    if (selectionNoticeTimerRef.current) window.clearTimeout(selectionNoticeTimerRef.current);
    setSelectionSkillNotice(notice);
    if (!notice.history) {
      selectionNoticeTimerRef.current = window.setTimeout(() => setSelectionSkillNotice(undefined), 4500);
    }
  }, []);

  const finishInlineVoice = useCallback((event: RecordingBridgeEvent) => {
    const session = voiceSessionRef.current;
    if (!session || event.sessionId !== session.id) return;
    if (event.event === "started") {
      setInlineVoicePhase("recording");
      return;
    }
    if (event.event === "cancelled") {
      voiceSessionRef.current = undefined;
      setInlineVoicePhase("idle");
      restoreTargetFocus(session);
      return;
    }
    if (event.event === "error") {
      voiceSessionRef.current = undefined;
      setVoiceError(event.error || "Could not start voice input.");
      setInlineVoicePhase("error");
      restoreTargetFocus(session);
      return;
    }
    if (event.event !== "stopped") return;

    setInlineVoicePhase("processing");
    void (async () => {
      try {
        let appliedContext: AppliedContext | undefined;
        const result = await completeVoiceInput({
          transcribe: async () => {
            const context = await getCaptureContext(session.source.url ?? "");
            appliedContext = {
              page_url: session.source.url,
              page_title: session.source.title,
              personal_context: context.personal_context || undefined,
              glossary: context.personal_glossary,
              recent_adopted_ids: context.recent_adopted_refs?.map((item) => item.id) ?? [],
              recent_adopted_texts: context.recent_adopted_refs?.map((item) => item.text) ?? context.recent_adopted,
            };
            const transcription = await transcribeAudio({
              requestId: session.id,
              audio: audioBlobFromEvent(event),
              source: session.source,
              targetText: session.targetText,
              projectContext: context.personal_context,
              glossary: context.personal_glossary.join("\n"),
              instructions: "Transcribe this as ready-to-insert text for the current input.",
              appliedContext,
            });
            return { text: transcription.text, captureId: transcription.capture_id };
          },
          save: async (transcription) => {
            if (voiceSessionRef.current?.id !== session.id) throw new Error("Voice input was cancelled.");
            return saveMaterial({
              requestId: session.id,
              kind: "voice",
              content: transcription.text,
              transcript: transcription.text,
              source: session.source,
              projects: [],
              captureId: transcription.captureId,
              appliedContext,
            });
          },
          insert: (text) => voiceSessionRef.current?.id === session.id &&
            isEditableTargetAvailable(session.target, session.targetPageHref, window.location.href) &&
            insertIntoElement(session.target, text),
        });
        if (voiceSessionRef.current?.id !== session.id) return;
        voiceSessionRef.current = undefined;
        if (result.inserted) {
          setVoiceError("");
          setPendingCopyText("");
          setInlineVoicePhase("idle");
          restoreTargetFocus(session);
          return;
        }
        setPendingCopyText(result.transcription.text);
        setVoiceError("Saved, but the original input is no longer available.");
        setInlineVoicePhase("error");
      } catch (cause) {
        if (voiceSessionRef.current?.id !== session.id) return;
        voiceSessionRef.current = undefined;
        const message = cause instanceof VoiceInputTransactionError
          ? cause.message
          : cause instanceof Error ? cause.message : "Could not finish voice input.";
        setVoiceError(message);
        setInlineVoicePhase("error");
        restoreTargetFocus(session);
      }
    })();
  }, [restoreTargetFocus, setInlineVoicePhase]);

  const startInlineVoice = useCallback(() => {
    const target = targetRef.current;
    const bridge = recordingBridgeRef.current;
    if (!target || !bridge || !isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href)) return;
    const session: InlineVoiceSession = {
      id: createRequestId(),
      target,
      targetPageHref: targetPageHrefRef.current,
      source: pageSource(),
      targetText: getEditableText(target),
    };
    voiceSessionRef.current = session;
    setVoiceError("");
    setPendingCopyText("");
    setInlineVoicePhase("starting");
    const response = bridge.handle({ type: "logue:recording-control", action: "start", sessionId: session.id });
    if (!response.ok) {
      voiceSessionRef.current = undefined;
      setVoiceError("Could not start voice input.");
      setInlineVoicePhase("error");
      restoreTargetFocus(session);
    }
  }, [restoreTargetFocus, setInlineVoicePhase]);

  const stopAndInsertInlineVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session || voicePhaseRef.current !== "recording") return;
    recordingBridgeRef.current?.handle({ type: "logue:recording-control", action: "stop", sessionId: session.id });
  }, []);

  useEffect(() => {
    const updateGoogleDocsProxy = (state: GoogleDocsLauncherState, editorFrameId?: number) => {
      const frame = googleDocsEditorFrame(document);
      if (!frame) return;
      if (!state.visible) {
        setGoogleDocsProxy(undefined);
        return;
      }
      if (!frame.contentWindow) return;
      setGoogleDocsProxy({ ...state, anchor: frame.getBoundingClientRect(), editorFrameId });
    };
    const onGoogleDocsRelay = (message: unknown) => {
      // Only the top document renders the control. The background forwards a
      // validated state update from the dedicated Docs editor frame.
      if (window.top !== window) return false;
      const state = readGoogleDocsLauncherState(message);
      if (!state) return false;
      updateGoogleDocsProxy(state, readGoogleDocsLauncherEditorFrameId(message));
      return false;
    };
    const onGoogleDocsFrameMessage = (event: MessageEvent) => {
      // Same-origin about:blank editor frames can expose a distinct
      // WindowProxy in Chrome's isolated world. The message payload is fully
      // validated and the actual action target always comes from the focused
      // Docs iframe in this document.
      if (window.top !== window) return;
      const state = readGoogleDocsLauncherState(event.data);
      if (state) updateGoogleDocsProxy(state, readGoogleDocsLauncherEditorFrameId(event.data));
    };
    window.addEventListener("message", onGoogleDocsFrameMessage);
    chrome.runtime.onMessage.addListener(onGoogleDocsRelay);
    return () => {
      window.removeEventListener("message", onGoogleDocsFrameMessage);
      chrome.runtime.onMessage.removeListener(onGoogleDocsRelay);
    };
  }, [cancelInlineVoice, startInlineVoice, stopAndInsertInlineVoice]);

  useEffect(() => {
    if (window.top !== window || window.location.hostname !== "docs.google.com") return;
    const syncFocusedDocsEditor = () => {
      const frame = googleDocsEditorFrame(document);
      const isFocused = isGoogleDocsEditorFocused(document);
      if (!frame || !frame.contentWindow || !isFocused) {
        setGoogleDocsProxy((current) => current && !(
          current.phase === "starting" || current.phase === "recording" || current.phase === "processing"
        ) ? undefined : current);
        return;
      }
      const anchor = frame.getBoundingClientRect();
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
    const activateTarget = (candidate: EventTarget | null | undefined) => {
      const target = candidate ?? null;
      if (!isEditableElement(target)) {
        clearTarget();
        return;
      }
      targetRef.current = target;
      targetPageHrefRef.current = window.location.href;
      setKeyboardActive(false);
      refreshTarget();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (host && event.composedPath().includes(host)) {
        setKeyboardActive(true);
        return;
      }
      activateTarget(event.target);
      scheduleSelectionSkillRefresh();
    };
    const onViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      refreshTarget();
    };
    const onRoute = () => clearTarget();
    let href = window.location.href;
    const routeTimer = window.setInterval(() => {
      if (href === window.location.href) return;
      href = window.location.href;
      onRoute();
    }, 250);
    const observer = new MutationObserver(() => {
      if (targetRef.current && !targetRef.current.isConnected) clearTarget();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn, true);
    const onSelectionInteraction = (event: Event) => {
      if (host && event.composedPath().includes(host)) return;
      refreshTarget();
      scheduleSelectionSkillRefresh();
    };
    const onPointerDownOutsideSelection = (event: PointerEvent) => {
      const target = targetRef.current;
      const path = event.composedPath();
      if (!target || path.includes(target) || (host && path.includes(host))) return;
      dismissSelectionSkills();
    };
    document.addEventListener("selectionchange", scheduleSelectionSkillRefresh);
    document.addEventListener("select", onSelectionInteraction, true);
    document.addEventListener("pointerdown", onPointerDownOutsideSelection, true);
    document.addEventListener("pointerup", onSelectionInteraction, true);
    document.addEventListener("keyup", onSelectionInteraction, true);
    activateTarget(activeEditableElement(document));
    scheduleSelectionSkillRefresh();
    const initialLayoutFrame = window.requestAnimationFrame(() => {
      activateTarget(activeEditableElement(document));
      scheduleSelectionSkillRefresh();
    });
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(initialLayoutFrame);
      window.clearInterval(routeTimer);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("selectionchange", scheduleSelectionSkillRefresh);
      document.removeEventListener("select", onSelectionInteraction, true);
      document.removeEventListener("pointerdown", onPointerDownOutsideSelection, true);
      document.removeEventListener("pointerup", onSelectionInteraction, true);
      document.removeEventListener("keyup", onSelectionInteraction, true);
      if (selectionRefreshFrameRef.current !== undefined) {
        window.cancelAnimationFrame(selectionRefreshFrameRef.current);
        selectionRefreshFrameRef.current = undefined;
      }
      window.removeEventListener("scroll", onViewport, true);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("hashchange", onRoute);
      window.removeEventListener("popstate", onRoute);
    };
  }, [clearTarget, dismissSelectionSkills, refreshTarget, scheduleSelectionSkillRefresh]);

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
        (document.activeElement === target || keyboardActive || captureActive),
      ),
      phase: voicePhase,
      error: voiceError,
      pendingCopyText,
    })).catch(() => undefined);
  }, [keyboardActive, pendingCopyText, targetRect, voiceError, voicePhase]);

  useEffect(() => {
    const docsTarget = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Document content"]');
    if (!docsTarget || !isGoogleDocsDocumentTarget(docsTarget)) return;
    // The frame can finish mounting after its first focus event. Bind the
    // actual editor eagerly so a top-frame control always has a live target.
    if (!isGoogleDocsDocumentTarget(targetRef.current)) {
      targetRef.current = docsTarget;
      targetPageHrefRef.current = window.location.href;
      setTargetRect(docsTarget.getBoundingClientRect());
    }
    // A long-lived extension port is the reliable return channel to Docs'
    // runtime-created editor frame. Page-window messaging cannot preserve
    // identity across its isolated extension worlds.
    const port = chrome.runtime.connect({ name: "logue:google-docs-editor" });
    const onMessage = (message: unknown) => {
      const action = readGoogleDocsLauncherAction(message);
      if (!action) return;
      if (action === "start") startInlineVoice();
      if (action === "stop") stopAndInsertInlineVoice();
      if (action === "cancel") cancelInlineVoice();
    };
    port.onMessage.addListener(onMessage);
    return () => {
      port.onMessage.removeListener(onMessage);
      port.disconnect();
    };
  }, [cancelInlineVoice, startInlineVoice, stopAndInsertInlineVoice, targetRect]);

  useEffect(() => () => {
    if (selectionNoticeTimerRef.current) window.clearTimeout(selectionNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ||
        event.isComposing || document.activeElement !== targetRef.current
      ) return;
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
      const session = voiceSessionRef.current;
      if (!session) return;
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
  }, [cancelInlineVoice, stopAndInsertInlineVoice]);

  useEffect(() => {
    const recordingBridge = createContentRecordingBridge({
      emit: (event) => {
        finishInlineVoice(event);
        return chrome.runtime.sendMessage(event);
      },
    });
    recordingBridgeRef.current = recordingBridge;
    const listener = (message: ContentMessage, _sender: chrome.runtime.MessageSender, sendResponse: (value: unknown) => void) => {
      const googleDocsAction = readGoogleDocsLauncherAction(message);
      if (googleDocsAction && isGoogleDocsDocumentTarget(targetRef.current)) {
        if (googleDocsAction === "start") startInlineVoice();
        if (googleDocsAction === "stop") stopAndInsertInlineVoice();
        if (googleDocsAction === "cancel") cancelInlineVoice();
        sendResponse({ ok: true });
        return false;
      }
      if (message?.type === "logue:recording-control") {
        sendResponse(recordingBridge.handle(message));
        return false;
      }
      if (message?.type === "logue:recording-dispose") {
        recordingBridge.dispose();
        sendResponse({ ok: true });
        return false;
      }
      if (message?.type === "logue:insert-text") {
        const target = targetRef.current;
        const inserted = Boolean(
          message.text &&
          isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href) &&
          insertIntoElement(target, message.text),
        );
        sendResponse({ ok: inserted });
        return false;
      }
      if (message?.type === "logue:get-page-context") {
        const target = targetRef.current;
        const targetAvailable = isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href);
        const context: PageCaptureContext = {
          source: pageSource(),
          candidateServerURL: logueServerCandidate(document, window.location.href),
          selectionText: window.getSelection()?.toString().trim() || undefined,
          targetText: targetAvailable ? getEditableText(target) : undefined,
          targetAvailable,
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
      recordingBridge.dispose();
      if (recordingBridgeRef.current === recordingBridge) recordingBridgeRef.current = undefined;
    };
  }, [cancelInlineVoice, finishInlineVoice, startInlineVoice, stopAndInsertInlineVoice]);

  const captureActive = voicePhase === "starting" || voicePhase === "recording" || voicePhase === "processing";
  const hasSelectionSkillMenu = Boolean(selectionSnapshot && eligibleSelectionSkills.length && !captureActive);
  const controlMetrics = inlineVoiceControlMetrics[voicePhase];
  const defaultPosition = targetRect ? defaultLauncherPosition(targetRect, viewport, controlMetrics.width, controlMetrics.height) : undefined;
  const position = defaultPosition ? clampLauncherPosition(defaultPosition, viewport, controlMetrics.width, controlMetrics.height) : undefined;
  const googleDocsMetrics = googleDocsProxy ? inlineVoiceControlMetrics[googleDocsProxy.phase] : undefined;
  const googleDocsPosition = googleDocsProxy && googleDocsMetrics
    // The Docs editor iframe is a tiny hidden event target. Aligning the host
    // control over it lets the iframe intercept clicks, so place the control
    // immediately beside the real caret target instead.
    ? clampLauncherPosition(
      { left: googleDocsProxy.anchor.right + 8, top: googleDocsProxy.anchor.top - 4 },
      viewport,
      googleDocsMetrics.width,
      googleDocsMetrics.height,
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
    !isGoogleDocsEditorFrame && targetRect.width > 80 && targetRect.height > 18,
  );
  const googleDocsProxyVisible = Boolean(googleDocsProxy && googleDocsPosition);

  function controlGoogleDocsProxy(action: GoogleDocsLauncherAction) {
    if (action === "start") {
      setGoogleDocsProxy((current) => current && { ...current, phase: "starting", error: "", pendingCopyText: "" });
    }
    void chrome.runtime.sendMessage(
      googleDocsLauncherActionMessage(action, googleDocsProxy?.editorFrameId),
    ).catch(() => undefined);
  }

  async function applySelectionSkill(skillId: string) {
    const snapshot = selectionSnapshotRef.current;
    const target = targetRef.current;
    if (!snapshot || !target || !isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href)) {
      if (snapshot) showSelectionSkillNotice({ anchor: snapshot.anchor, message: "Selection changed — choose a skill again." });
      return;
    }
    const skill = eligibleSelectionSkills.find((item) => item.id === skillId);
    if (!skill) {
      showSelectionSkillNotice({ anchor: snapshot.anchor, message: "That skill is no longer available." });
      return;
    }
    const invocation = {
      snapshot,
      target,
      pageHref: targetPageHrefRef.current,
    };
    const run = await createExtensionSkillRun({
      skillId: skill.id,
      instruction: "Transform only the selected text. Return only the replacement text.",
      pageTitle: document.title,
      pageUrl: window.location.href,
      targetText: getEditableText(target),
      selection: snapshot.text,
    });
    const invocationState = selectionSkillInvocationState({
      invocation,
      currentSnapshot: selectionSnapshotRef.current,
      currentTarget: targetRef.current,
      currentPageHref: window.location.href,
    });
    if (invocationState === "cancelled") return;
    if (invocationState === "changed") {
      showSelectionSkillNotice({ anchor: snapshot.anchor, message: "Selection changed — choose a skill again." });
      return;
    }
    const replacement = run.original_output?.trim();
    if (!replacement) throw new Error("This skill returned no text.");
    if (!replaceSelectionIfUnchanged(snapshot, replacement)) {
      showSelectionSkillNotice({ anchor: snapshot.anchor, message: "Selection changed — choose a skill again." });
      return;
    }
    const history = await saveSelectionSkillHistory({ runId: run.id, replacement }, adoptExtensionSkillRun);
    if (history) showSelectionSkillNotice({ anchor: snapshot.anchor, message: "Applied", history });
    selectionSnapshotRef.current = undefined;
    setSelectionSnapshot(undefined);
  }

  async function retrySelectionSkillHistory() {
    const notice = selectionSkillNotice;
    if (!notice?.history) return;
    const retry = await saveSelectionSkillHistory(notice.history, adoptExtensionSkillRun);
    if (retry) {
      setSelectionSkillNotice({ ...notice, history: retry });
      return;
    }
    setSelectionSkillNotice(undefined);
  }

  if (!visible && !hasSelectionSkillMenu && !googleDocsProxyVisible) return null;
  return (
    <>
      {hasSelectionSkillMenu && selectionSnapshot && <SelectionSkillMenu
        anchor={selectionSnapshot.anchor}
        skills={eligibleSelectionSkills}
        onUseSkill={applySelectionSkill}
        focusTrigger={focusSelectionSkillTrigger}
        onFocusTriggerHandled={() => setFocusSelectionSkillTrigger(false)}
        onDismiss={() => {
          dismissSelectionSkills();
        }}
      />}
      {selectionSkillNotice && <div
        className="logue-selection-feedback"
        role={selectionSkillNotice.history ? "status" : "alert"}
        style={{ left: selectionSkillNotice.anchor.left, top: selectionSkillNotice.anchor.top }}
      >
        {selectionSkillNotice.message}{selectionSkillNotice.history && <button type="button" onClick={() => void retrySelectionSkillHistory()}>Retry saving history</button>}
      </div>}
      {visible && <InlineVoiceControls
        phase={voicePhase}
        style={{ top: position?.top, left: position?.left }}
        onStart={startInlineVoice}
        onCancel={cancelInlineVoice}
        onStopAndInsert={stopAndInsertInlineVoice}
        error={voiceError}
        pendingCopyText={pendingCopyText}
        onCopy={() => void navigator.clipboard.writeText(pendingCopyText)}
        errorPlacement={errorPlacement}
      />}
      {googleDocsProxyVisible && googleDocsProxy && <InlineVoiceControls
        phase={googleDocsProxy.phase}
        style={{ top: googleDocsPosition?.top, left: googleDocsPosition?.left }}
        onStart={() => controlGoogleDocsProxy("start")}
        onCancel={() => controlGoogleDocsProxy("cancel")}
        onStopAndInsert={() => controlGoogleDocsProxy("stop")}
        error={googleDocsProxy.error}
        pendingCopyText={googleDocsProxy.pendingCopyText}
        onCopy={() => void navigator.clipboard.writeText(googleDocsProxy.pendingCopyText)}
        errorPlacement={googleDocsErrorPlacement}
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
