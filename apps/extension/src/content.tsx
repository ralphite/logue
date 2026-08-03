import { AudioLines, Check, LoaderCircle, X } from "lucide-react";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { cancelMaterialSave, getCaptureContext, saveMaterial, transcribeAudio, type AppliedContext } from "./api";
import { activeEditableElement, getEditableText, insertIntoElement, isEditableElement, isEditableTargetAvailable } from "./dom";
import { isLogueExtensionDisabledDocument } from "./eligibility";
import { clampLauncherPosition, defaultLauncherPosition, inlineVoiceControlMetrics, launcherErrorPlacement } from "./launcherPosition";
import type { CaptureSource, PageCaptureContext } from "./capturePrimitives";
import {
  audioBlobFromEvent,
  createContentRecordingBridge,
  createRecordingLifecycleRegistry,
  type ContentRecordingBridge,
  type RecordingBridgeEvent,
  type RecordingControlMessage,
  type RecordingDisposeMessage,
} from "./recordingBridge";
import { recordingShortcutAction } from "./recordingShortcuts";
import { createRequestId } from "./requestId";
import { completeVoiceInput, VoiceInputTransactionError } from "./transaction";
import styles from "./extension.css?inline";

interface ContentRequestMessage {
  type: "logue:insert-text" | "logue:get-page-context";
  text?: string;
}

type ContentMessage = ContentRequestMessage | RecordingControlMessage | RecordingDisposeMessage;

type InlineVoicePhase = "idle" | "starting" | "recording" | "processing" | "error";

interface InlineVoiceSession {
  id: string;
  target: HTMLElement;
  targetPageHref: string;
  source: CaptureSource;
  targetText: string;
}

function pageSource(): CaptureSource {
  return {
    url: window.location.href,
    title: document.title || window.location.hostname,
    domain: window.location.hostname,
  };
}

function ExtensionLauncher() {
  const [targetRect, setTargetRect] = useState<DOMRect>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [voicePhase, setVoicePhase] = useState<InlineVoicePhase>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [pendingCopyText, setPendingCopyText] = useState("");
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const targetRef = useRef<HTMLElement | null>(null);
  const targetPageHrefRef = useRef("");
  const voicePhaseRef = useRef<InlineVoicePhase>("idle");
  const voiceSessionRef = useRef<InlineVoiceSession | undefined>(undefined);
  const recordingBridgeRef = useRef<ContentRecordingBridge | undefined>(undefined);

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
    activateTarget(activeEditableElement(document));
    const initialLayoutFrame = window.requestAnimationFrame(() => activateTarget(activeEditableElement(document)));
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(initialLayoutFrame);
      window.clearInterval(routeTimer);
      document.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("scroll", onViewport, true);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("hashchange", onRoute);
      window.removeEventListener("popstate", onRoute);
    };
  }, [clearTarget, refreshTarget]);

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
    const recordingLifecycle = createRecordingLifecycleRegistry(() => recordingBridge.dispose());
    const onConnect = (port: chrome.runtime.Port) => {
      recordingLifecycle.accept(port);
    };
    const listener = (message: ContentMessage, _sender: chrome.runtime.MessageSender, sendResponse: (value: unknown) => void) => {
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
    chrome.runtime.onConnect.addListener(onConnect);
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onConnect.removeListener(onConnect);
      chrome.runtime.onMessage.removeListener(listener);
      recordingLifecycle.dispose();
      recordingBridge.dispose();
      if (recordingBridgeRef.current === recordingBridge) recordingBridgeRef.current = undefined;
    };
  }, [finishInlineVoice]);

  const captureActive = voicePhase === "starting" || voicePhase === "recording" || voicePhase === "processing";
  const controlMetrics = inlineVoiceControlMetrics[voicePhase];
  const defaultPosition = targetRect ? defaultLauncherPosition(targetRect, viewport, controlMetrics.width, controlMetrics.height) : undefined;
  const position = defaultPosition ? clampLauncherPosition(defaultPosition, viewport, controlMetrics.width, controlMetrics.height) : undefined;
  const errorPlacement = position ? launcherErrorPlacement(position, controlMetrics.width) : { vertical: "below", horizontal: "right" };
  const visible = Boolean(
    targetRect && position &&
    (document.activeElement === targetRef.current || keyboardActive || captureActive) &&
    targetRect.width > 80 && targetRect.height > 18,
  );

  if (!visible) return null;
  return (
    <div className={`logue-launcher-group is-${voicePhase}${captureActive ? " is-capturing" : ""}`} style={{ top: position?.top, left: position?.left }} role="group" aria-label="Logue voice input">
      {voicePhase === "recording" ? <>
        <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={cancelInlineVoice}><X size={17} /></button>
        <button type="button" className="logue-launcher logue-inline-accept" aria-label="Stop and insert voice input" aria-keyshortcuts="Enter" title="Stop and insert (Enter)" onPointerDown={(event) => event.preventDefault()} onClick={stopAndInsertInlineVoice}><Check size={18} strokeWidth={2.3} /></button>
      </> : captureActive ? <>
        <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={cancelInlineVoice}><X size={17} /></button>
        <span className="logue-inline-status" role="status" aria-label={voicePhase === "starting" ? "Starting microphone" : "Transcribing and inserting"}><LoaderCircle size={17} className="logue-inline-spinner" /></span>
      </> : <button
        type="button"
        className="logue-launcher logue-launcher-voice"
        aria-label="Start voice input"
        title={voicePhase === "error" ? "Try voice input again" : "Start voice input"}
        onPointerDown={(event) => event.preventDefault()}
        onClick={startInlineVoice}
      >
        <AudioLines size={17} strokeWidth={2.1} />
      </button>}
      {voiceError && <div className={`logue-launcher-error is-${errorPlacement.vertical} is-${errorPlacement.horizontal}`} role="alert"><span>{voiceError}</span>{pendingCopyText && <button type="button" onClick={() => void navigator.clipboard.writeText(pendingCopyText)}>Copy</button>}</div>}
    </div>
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
