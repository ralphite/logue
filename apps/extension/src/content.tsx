import { AgentGenerationPanel, CapturePanel, VoiceInputPanel, type AgentGenerationPhase, type CaptureMode, type CapturePhase, type ContextSource } from "@logue/ui";
import { AudioLines, Check, Sparkles } from "lucide-react";
import { StrictMode, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./extension.css?inline";

function friendlyError(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message : "";
  if (/returned no transcription|no transcription/i.test(message)) return "没有识别到清晰语音。录音仍保留，可重试。";
  if (/failed to fetch|network|连接/i.test(message)) return "无法连接 Logue 本机服务，请确认应用正在运行。";
  if (/permission|notallowed|denied/i.test(message)) return "麦克风权限未开启，请在浏览器地址栏允许后重试。";
  if (/notfound|no audio|empty/i.test(message)) return "没有检测到可用音频，请重新录制。";
  return fallback;
}
import {
  adoptExtensionAgentRun,
  createExtensionAgentRun,
  deleteCapture,
  ExtensionApiError,
  getCaptureContext,
  getExtensionAgents,
  getExtensionSettings,
  getServiceStatus,
  saveMaterial,
  saveSelection,
  transcribeAudio,
  type AppliedContext,
  type CaptureContext,
  type ExtensionAgent,
} from "./api";
import { getEditableText, insertIntoElement, isEditableElement, isEditableTargetAvailable } from "./dom";
import { isLogueExtensionDisabledDocument } from "./eligibility";
import { adoptedVoiceText, voiceMaterialPayload } from "./provenance";
import { recordingShortcutAction } from "./recordingShortcuts";
import { createRequestId } from "./requestId";
import { completeSelectionVoiceInput, completeVoiceInput, saveBeforeInsert, VoiceInputTransactionError } from "./transaction";
import { clampLauncherPosition, defaultLauncherPosition, type LauncherPosition } from "./launcherPosition";

interface OpenMessage {
  type: "logue:open-selection" | "logue:open-input";
  selectionText?: string;
}

type ExtensionMode = CaptureMode | "agent";

interface LauncherDragState {
  moved: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: LauncherPosition;
}

function pageSource() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
  };
}

async function e2eAudioStream() {
  if (import.meta.env.MODE !== "e2e" || !["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return undefined;
  }
  const captureId = new URLSearchParams(window.location.search).get("logue_e2e_capture");
  if (!captureId || !/^cap_[a-z0-9]+$/i.test(captureId)) return undefined;

  const response = await fetch(`http://127.0.0.1:8787/v1/captures/${captureId}`);
  if (!response.ok) throw new Error("E2E audio capture is unavailable");
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
  const destination = audioContext.createMediaStreamDestination();
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(destination);
  destination.stream.getAudioTracks()[0]?.addEventListener("ended", () => {
    void audioContext.close();
  }, { once: true });
  source.start(audioContext.currentTime + 0.2);
  return destination.stream;
}

function ExtensionApp() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ExtensionMode>("input");
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [draft, setDraft] = useState("");
  const [reviewTranscript, setReviewTranscript] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [captureId, setCaptureId] = useState<string>();
  const [savedMaterialId, setSavedMaterialId] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [errorKind, setErrorKind] = useState<"transcription" | "microphone" | "save" | "target">("transcription");
  const [elapsed, setElapsed] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect>();
  const [toast, setToast] = useState<string>();
  const [contextData, setContextData] = useState<CaptureContext>();
  const [referenceProject, setReferenceProject] = useState("");
  const [selectionProjects, setSelectionProjects] = useState<string[]>([]);
  const [selectionTags, setSelectionTags] = useState<string[]>([]);
  const [captureProject, setCaptureProject] = useState<string>();
  const [captureAppliedContext, setCaptureAppliedContext] = useState<AppliedContext>();
  const [committing, setCommitting] = useState(false);
  const [agents, setAgents] = useState<ExtensionAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [agentInstruction, setAgentInstruction] = useState("基于我的相关资料，生成一段可直接使用的简洁回复（不超过 120 字）。");
  const [agentOutput, setAgentOutput] = useState("");
  const [agentRunId, setAgentRunId] = useState<string>();
  const [agentPhase, setAgentPhase] = useState<AgentGenerationPhase>("ready");
  const [agentError, setAgentError] = useState<string>();
  const [agentProject, setAgentProject] = useState("");
  const [agentSourceIds, setAgentSourceIds] = useState<string[]>([]);
  const [agentContextLabel, setAgentContextLabel] = useState("自动使用当前页面上下文");
  const [launcherKeyboardActive, setLauncherKeyboardActive] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition>();
  const [launcherDragging, setLauncherDragging] = useState(false);
  const [launcherViewport, setLauncherViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const targetRef = useRef<HTMLElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canceledRef = useRef(false);
  const recordingAttemptRef = useRef(0);
  const lastBlobRef = useRef<Blob | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(createRequestId());
  const commitLockRef = useRef(false);
  const referenceProjectRef = useRef("");
  const targetPageHrefRef = useRef("");
  const openRef = useRef(false);
  const startRecordingRef = useRef<() => Promise<void>>(async () => undefined);
  const stopRecordingRef = useRef<() => void>(() => undefined);
  const closeRef = useRef<() => void>(() => undefined);
  const retryCommitRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const launcherDragRef = useRef<LauncherDragState | undefined>(undefined);
  const suppressLauncherClickRef = useRef(false);

  openRef.current = open;

  const clearTarget = useCallback((forgetTarget = true) => {
    setTargetRect(undefined);
    if (forgetTarget) {
      targetRef.current = null;
      targetPageHrefRef.current = "";
      setLauncherPosition(undefined);
    }
  }, []);

  const refreshTargetRect = useCallback(() => {
    const target = targetRef.current;
    if (!isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href)) {
      clearTarget();
      return;
    }
    const next = target.getBoundingClientRect();
    setTargetRect((previous) =>
      previous &&
      previous.top === next.top &&
      previous.right === next.right &&
      previous.bottom === next.bottom &&
      previous.left === next.left &&
      previous.width === next.width &&
      previous.height === next.height
        ? previous
        : next,
    );
  }, [clearTarget]);

  const refreshContext = useCallback(async (projectName: string, acceptSuggestion = false) => {
    const value = await getCaptureContext(window.location.href, projectName);
    setContextData(value);
    if (acceptSuggestion && !projectName) {
      const suggestion = value.suggested_project || "";
      referenceProjectRef.current = suggestion;
      setReferenceProject(suggestion);
    }
    return value;
  }, []);

  useEffect(() => {
    void getServiceStatus()
      .then((status) => setConnected(status.ok))
      .catch(() => setConnected(false));
    const extensionHost = () => document.getElementById("logue-extension-host");
    const onFocus = (event: FocusEvent) => {
      const host = extensionHost();
      if (host && event.composedPath().includes(host)) {
        setLauncherKeyboardActive(true);
        return;
      }
      if (!isEditableElement(event.target)) {
        if (!openRef.current) clearTarget();
        return;
      }
      const targetChanged = targetRef.current !== event.target;
      setLauncherKeyboardActive(false);
      targetRef.current = event.target;
      targetPageHrefRef.current = window.location.href;
      if (targetChanged) setLauncherPosition(undefined);
      refreshTargetRect();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.target !== targetRef.current) return;
      const host = extensionHost();
      if (event.relatedTarget === host || (event.relatedTarget instanceof Node && host?.shadowRoot?.contains(event.relatedTarget))) {
        setLauncherKeyboardActive(true);
        return;
      }
      if (!openRef.current) clearTarget();
    };
    const onViewportChange = () => {
      setLauncherViewport((previous) =>
        previous.width === window.innerWidth && previous.height === window.innerHeight
          ? previous
          : { width: window.innerWidth, height: window.innerHeight },
      );
      refreshTargetRect();
    };
    const onWindowBlur = () => setTargetRect(undefined);
    const onWindowFocus = () => {
      onViewportChange();
      if (document.activeElement === targetRef.current) refreshTargetRect();
    };
    let currentHref = window.location.href;
    const onRouteChange = () => {
      currentHref = window.location.href;
      clearTarget();
    };
    let refreshFrame: number | undefined;
    const observer = new MutationObserver(() => {
      if (!targetRef.current) return;
      if (!targetRef.current.isConnected) {
        clearTarget();
        return;
      }
      if (refreshFrame !== undefined) return;
      refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = undefined;
        refreshTargetRect();
      });
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "disabled", "readonly", "contenteditable", "data-logue-extension"],
    });
    const routeTimer = window.setInterval(() => {
      if (window.location.href !== currentHref) onRouteChange();
    }, 250);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("hashchange", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    if (isEditableElement(document.activeElement)) {
      targetRef.current = document.activeElement;
      targetPageHrefRef.current = window.location.href;
      refreshTargetRect();
    }
    return () => {
      observer.disconnect();
      if (refreshFrame !== undefined) window.cancelAnimationFrame(refreshFrame);
      window.clearInterval(routeTimer);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("hashchange", onRouteChange);
      window.removeEventListener("popstate", onRouteChange);
    };
  }, [clearTarget, refreshTargetRect]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const refreshConnection = () => {
      void getServiceStatus()
        .then((status) => {
          if (!cancelled) setConnected(status.ok);
        })
        .catch(() => {
          if (!cancelled) setConnected(false);
        });
    };
    refreshConnection();
    const timer = window.setInterval(refreshConnection, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    const listener = (message: OpenMessage) => {
      if (message.type === "logue:open-selection") {
        setMode("selection");
        setSelectedText(message.selectionText ?? window.getSelection()?.toString() ?? "");
        setSelectionProjects([]);
        setSelectionTags([]);
        setErrorMessage(undefined);
        setOpen(true);
        void refreshContext("", true)
          .then((value) => {
            const suggestion = value.suggested_project || "";
            setSelectionProjects(suggestion ? [suggestion] : []);
          })
          .catch(() => undefined);
      }
      if (message.type === "logue:open-input") {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          return;
        }
        const target = targetRef.current;
        if (
          document.activeElement !== target ||
          !isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href)
        ) return;
        setMode("input");
        setErrorMessage(undefined);
        setOpen(true);
        void refreshContext("", true).catch(() => undefined);
        void startRecordingRef.current();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refreshContext]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.isComposing &&
        !open &&
        targetRect &&
        document.activeElement === targetRef.current
      ) {
        const launcher = document
          .getElementById("logue-extension-host")
          ?.shadowRoot
          ?.querySelector<HTMLButtonElement>('button[aria-label="用 Logue 语音输入"]');
        if (launcher) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setLauncherKeyboardActive(true);
          launcher.focus();
          return;
        }
      }
      const recordingAction = recordingShortcutAction({
        open,
        mode,
        phase,
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        isComposing: event.isComposing,
        repeat: event.repeat,
      });
      if (recordingAction) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (recordingAction === "stop-and-insert") stopRecordingRef.current();
        else closeRef.current();
        return;
      }
      if (
        event.key === "Escape" &&
        open &&
        mode === "input" &&
        phase !== "processing" &&
        phase !== "review" &&
        !event.isComposing &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (
        event.key !== "Escape" ||
        !open ||
        phase === "recording" ||
        (mode === "input" && phase !== "error")
      ) return;
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [mode, open, phase, targetRect]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const contexts = useMemo<ContextSource[]>(() => {
    const items: ContextSource[] = [
      { id: "page", label: document.title || window.location.hostname, type: "page" },
    ];
    if (mode === "selection" && selectedText) {
      items.push({ id: "selection", label: "当前选区", type: "selection" });
    }
    if (referenceProject) items.push({ id: "project", label: referenceProject, type: "project" });
    const project = contextData?.projects.find((item) => item.name === referenceProject);
    const glossaryCount = (contextData?.personal_glossary.length ?? 0) + (project?.glossary.length ?? 0);
    if (glossaryCount > 0) items.push({ id: "glossary", label: `${glossaryCount} 个已确认术语`, type: "glossary" });
    if (contextData?.recent_adopted.length) items.push({ id: "recent", label: `${contextData.recent_adopted.length} 条本项目已采用表达`, type: "project" });
    return items;
  }, [contextData, mode, referenceProject, selectedText]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const finishSuccess = useCallback((message: string) => {
    setToast(message);
    setPhase("idle");
    setDraft("");
    setRawTranscript("");
    setReviewTranscript("");
    setCaptureId(undefined);
    setCaptureProject(undefined);
    setCaptureAppliedContext(undefined);
    setSavedMaterialId(undefined);
    setErrorMessage(undefined);
    requestIdRef.current = createRequestId();
    setOpen(false);
    setMode("input");
    window.setTimeout(() => setToast(undefined), 2600);
  }, []);

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      setPhase("processing");
      setErrorMessage(undefined);
      try {
        const activeReferenceProject = referenceProjectRef.current;
        const freshContext = await refreshContext(activeReferenceProject);
        const project = freshContext.projects.find((item) => item.name === activeReferenceProject);
        const appliedContext = {
          page_url: window.location.href,
          page_title: document.title,
          reference_project: activeReferenceProject || undefined,
          personal_context: freshContext.personal_context || undefined,
          project_overview: project?.overview || undefined,
          glossary: [...freshContext.personal_glossary, ...(project?.glossary ?? [])],
          recent_adopted_ids: freshContext.recent_adopted_refs?.map((item) => item.id) ?? [],
          recent_adopted_texts: freshContext.recent_adopted_refs?.map((item) => item.text) ?? freshContext.recent_adopted,
        };
        setCaptureAppliedContext(appliedContext);
        const transcribe = async () => {
          const result = await transcribeAudio({
            audio: blob,
            source: pageSource(),
            targetText: mode === "input" ? getEditableText(targetRef.current) : undefined,
            selectedText: mode === "selection" ? selectedText : undefined,
            projectContext: [
              freshContext.personal_context,
              project?.overview,
              freshContext.recent_adopted.length
                ? `本项目近期已采用表达（仅用于保持用词和语气一致）：\n${freshContext.recent_adopted.map((value) => `- ${value}`).join("\n")}`
                : undefined,
            ].filter(Boolean).join("\n\n"),
            glossary: [...freshContext.personal_glossary, ...(project?.glossary ?? [])].join("\n"),
            instructions: mode === "selection" ? "把语音作为对所选原文的批注。" : "把语音整理为可直接写入当前输入框的文字。",
            appliedContext,
          });
          return { text: result.text, captureId: result.capture_id };
        };

        if (mode === "input") {
          const completion = await completeVoiceInput({
            transcribe,
            save: (transcription) => {
              const voicePayload = voiceMaterialPayload(transcription.text, transcription.text);
              return saveMaterial({
                requestId: requestIdRef.current,
                kind: "voice",
                content: voicePayload.content,
                source: pageSource(),
                projects: activeReferenceProject ? [activeReferenceProject] : [],
                captureId: transcription.captureId,
                transcript: voicePayload.transcript,
                appliedContext,
              });
            },
            insert: (text) => Boolean(targetRef.current && insertIntoElement(targetRef.current, text)),
          });
          if (!completion.inserted) {
            setCaptureId(completion.transcription.captureId);
            setCaptureProject(activeReferenceProject);
            setRawTranscript(completion.transcription.text);
            setReviewTranscript(completion.transcription.text);
            setSavedMaterialId(completion.materialId);
            setErrorKind("target");
            setErrorMessage("资料已经保存。重新聚焦一个输入框后可再次插入，或直接复制文字。");
            setPhase("error");
            return;
          }
          finishSuccess("已插入网页并保存到资料流");
          return;
        }

        const completion = await completeSelectionVoiceInput({
          transcribe,
          save: (transcription) => saveSelection({
            requestId: requestIdRef.current,
            sourceContent: selectedText,
            annotation: transcription.text,
            transcript: transcription.text,
            source: { ...pageSource(), selection: selectedText },
            projects: selectionProjects,
            tags: selectionTags,
            captureId: transcription.captureId,
            appliedContext,
          }),
        });
        setCaptureId(completion.transcription.captureId);
        finishSuccess("已保存原文与语音批注");
      } catch (cause) {
        const transactionError = cause instanceof VoiceInputTransactionError ? cause : undefined;
        const originalCause = transactionError?.cause ?? cause;
        const transcription = transactionError?.transcription;
        const failedCaptureId = transcription?.captureId ??
          (originalCause instanceof ExtensionApiError ? originalCause.captureId : undefined);
        if (failedCaptureId) setCaptureId(failedCaptureId);
        if (transcription) {
          setCaptureProject(referenceProjectRef.current);
          setRawTranscript(transcription.text);
          setReviewTranscript(transcription.text);
        }
        const failedDuringSave = transactionError?.step === "save";
        setErrorMessage(friendlyError(
          originalCause,
          failedDuringSave ? "内容尚未保存，请重试。" : "转写未完成。录音仍保留，可重试。",
        ));
        setErrorKind(failedDuringSave ? "save" : "transcription");
        setPhase("error");
        void getServiceStatus()
          .then((status) => setConnected(status.ok))
          .catch(() => setConnected(false));
      }
    },
    [finishSuccess, mode, refreshContext, selectedText, selectionProjects, selectionTags],
  );

  const startRecording = useCallback(async () => {
    const attempt = recordingAttemptRef.current + 1;
    recordingAttemptRef.current = attempt;
    setPhase("idle");
    try {
      if (captureId) {
        await deleteCapture(captureId);
        if (attempt !== recordingAttemptRef.current) return;
        setCaptureId(undefined);
        setRawTranscript("");
        setReviewTranscript("");
      }
      canceledRef.current = false;
      chunksRef.current = [];
      setCaptureProject(undefined);
      setCaptureAppliedContext(undefined);
      setElapsed(0);
      setErrorMessage(undefined);
      const stream = await e2eAudioStream() ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attempt !== recordingAttemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (canceledRef.current || attempt !== recordingAttemptRef.current) {
          setPhase("idle");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        lastBlobRef.current = blob;
        void uploadBlob(blob);
      });
      recorder.start(250);
      setPhase("recording");
      timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch (cause) {
      if (attempt !== recordingAttemptRef.current) return;
      setErrorMessage(friendlyError(cause, "无法访问麦克风，请检查浏览器权限。"));
      setErrorKind("microphone");
      setPhase("error");
    }
  }, [captureId, stopTimer, uploadBlob]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    recordingAttemptRef.current += 1;
    canceledRef.current = true;
    stopTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setPhase("idle");
  }, [stopTimer]);

  stopRecordingRef.current = stopRecording;

  const removeRecording = useCallback(async () => {
    if (captureId) await deleteCapture(captureId).catch(() => undefined);
    setCaptureId(undefined);
    setCaptureProject(undefined);
    setCaptureAppliedContext(undefined);
    setRawTranscript("");
    setReviewTranscript("");
    lastBlobRef.current = undefined;
    setErrorMessage(undefined);
    setPhase("idle");
  }, [captureId]);

  const retry = useCallback(async () => {
    if (errorKind === "save" || errorKind === "target") {
      await retryCommitRef.current(reviewTranscript);
      return;
    }
    if (errorKind === "microphone") {
      await startRecording();
      return;
    }
    if (!lastBlobRef.current) return;
    if (captureId) {
      try {
        await deleteCapture(captureId);
        setCaptureId(undefined);
      } catch (cause) {
        setErrorMessage(friendlyError(cause, "无法清理这段录音，请稍后重试。"));
        return;
      }
    }
    await uploadBlob(lastBlobRef.current);
  }, [captureId, errorKind, reviewTranscript, startRecording, uploadBlob]);

  const close = useCallback(() => {
    cancelRecording();
    if (captureId && !savedMaterialId) void deleteCapture(captureId).catch(() => undefined);
    setOpen(false);
    setMode("input");
    setPhase("idle");
    setDraft("");
    setRawTranscript("");
    setReviewTranscript("");
    setSelectedText("");
    setSelectionProjects([]);
    setSelectionTags([]);
    setCaptureId(undefined);
    setCaptureProject(undefined);
    setCaptureAppliedContext(undefined);
    setSavedMaterialId(undefined);
    setErrorMessage(undefined);
    setAgentPhase("ready");
    setAgentOutput("");
    setAgentRunId(undefined);
    setAgentError(undefined);
    setAgentProject("");
    setAgentSourceIds([]);
    lastBlobRef.current = undefined;
    requestIdRef.current = createRequestId();
    targetRef.current?.focus();
  }, [cancelRecording, captureId, phase, savedMaterialId]);

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  const commit = useCallback(async (adoptedDraft = draft) => {
    if (commitLockRef.current) return;
    commitLockRef.current = true;
    setCommitting(true);
    try {
      const adoptedProject = captureId ? (captureProject ?? "") : referenceProjectRef.current;
      if (mode === "input") {
        const voicePayload = voiceMaterialPayload(adoptedDraft, rawTranscript);
        const result = await saveBeforeInsert({
          savedMaterialId,
          save: () => saveMaterial({
              requestId: requestIdRef.current,
              kind: captureId ? "voice" : "text",
              content: voicePayload.content,
              source: pageSource(),
              projects: adoptedProject ? [adoptedProject] : [],
              captureId,
              transcript: captureId ? voicePayload.transcript : undefined,
              appliedContext: captureAppliedContext,
            }),
          insert: () => Boolean(targetRef.current && insertIntoElement(targetRef.current, adoptedDraft)),
        });
        setSavedMaterialId(result.materialId);
        if (!result.inserted) {
          setErrorKind("target");
          setErrorMessage("资料已经保存。重新聚焦一个输入框后可再次插入，或直接复制文字。");
          setPhase("error");
          return;
        }
        setToast("已插入网页并保存到资料流");
      } else {
        await saveSelection({
          requestId: requestIdRef.current,
          sourceContent: selectedText,
          annotation: adoptedDraft.trim() || undefined,
          transcript: captureId ? rawTranscript.trim() : undefined,
          source: { ...pageSource(), selection: selectedText },
          projects: selectionProjects,
          tags: selectionTags,
          captureId,
          appliedContext: captureAppliedContext,
        });
        setToast(adoptedDraft.trim() ? "已保存原文与批注" : "已保存选区");
      }
      setPhase("idle");
      setDraft("");
      setRawTranscript("");
      setReviewTranscript("");
      setCaptureId(undefined);
      setCaptureProject(undefined);
      setCaptureAppliedContext(undefined);
      setSavedMaterialId(undefined);
      setErrorMessage(undefined);
      requestIdRef.current = createRequestId();
      setOpen(false);
      setMode("input");
      window.setTimeout(() => setToast(undefined), 2600);
    } catch (cause) {
      setErrorMessage(friendlyError(cause, "内容尚未保存，请重试。"));
      setErrorKind("save");
      setPhase("error");
    } finally {
      commitLockRef.current = false;
      setCommitting(false);
    }
  }, [captureAppliedContext, captureId, captureProject, draft, mode, rawTranscript, savedMaterialId, selectedText, selectionProjects, selectionTags]);

  const primary = useCallback(() => commit(), [commit]);

  useEffect(() => {
    retryCommitRef.current = (text) => commit(text);
  }, [commit]);

  const openAgentGeneration = useCallback(async () => {
    setMode("agent");
    setOpen(true);
    setAgentPhase("ready");
    setAgentOutput("");
    setAgentRunId(undefined);
    setAgentError(undefined);
    setAgentInstruction("基于我的相关资料，生成一段可直接使用的简洁回复（不超过 120 字）。");
    try {
      const [availableAgents, settings, context] = await Promise.all([
        getExtensionAgents(),
        getExtensionSettings(),
        refreshContext("", true),
      ]);
      setAgents(availableAgents);
      const defaultAgent = availableAgents.find((agent) => agent.id === settings.default_extension_agent) ?? availableAgents[0];
      setSelectedAgentId(defaultAgent?.id ?? "");
      if (!defaultAgent) {
        setAgentPhase("error");
        setAgentError("没有启用且可在 Extension 使用的生成 Agent。可在 Logue 的“生成 → Agents”中配置。");
      }
      const project = context.suggested_project || "";
      const sourceIds = (context.recent_adopted_refs ?? []).slice(0, 8).map((item) => item.id);
      setAgentProject(project);
      setAgentSourceIds(sourceIds);
      setAgentContextLabel([
        "当前页面",
        project || undefined,
        sourceIds.length ? `${sourceIds.length} 条相关资料` : undefined,
      ].filter(Boolean).join(" · "));
    } catch (cause) {
      setAgentPhase("error");
      setAgentError(friendlyError(cause, "无法加载 Agent，请确认 Logue 本机服务正在运行。"));
    }
  }, [refreshContext]);

  const runAgentGeneration = useCallback(async () => {
    if (!selectedAgentId || !agentInstruction.trim()) return;
    setAgentPhase("generating");
    setAgentError(undefined);
    try {
      const run = await createExtensionAgentRun({
        agentId: selectedAgentId,
        instruction: agentInstruction.trim(),
        project: agentProject || undefined,
        sourceIds: agentSourceIds,
        pageTitle: document.title,
        pageUrl: window.location.href,
        targetText: getEditableText(targetRef.current),
        selection: window.getSelection()?.toString() || undefined,
      });
      if (run.status !== "complete" || !run.original_output?.trim()) {
        throw new Error(run.error || "Agent 没有返回可用结果");
      }
      setAgentRunId(run.id);
      setAgentOutput(run.original_output);
      if (run.sources?.length) {
        setAgentContextLabel(["当前页面", agentProject || undefined, `${run.sources.length} 条相关资料`].filter(Boolean).join(" · "));
      }
      setAgentPhase("result");
    } catch (cause) {
      setAgentPhase("error");
      setAgentError(friendlyError(cause, cause instanceof Error ? cause.message : "生成失败，请重试。"));
    }
  }, [agentInstruction, agentProject, agentSourceIds, selectedAgentId]);

  const insertAgentOutput = useCallback(async () => {
    if (!agentRunId || !agentOutput.trim()) return;
    setAgentError(undefined);
    try {
      await adoptExtensionAgentRun(agentRunId, agentOutput);
      const target = targetRef.current;
      if (!isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href) || !insertIntoElement(target, agentOutput)) {
        setAgentError("原输入框已不可用。结果已保存在 Logue，可复制后使用。");
        setAgentPhase("result");
        return;
      }
      setToast("已插入输入框");
      setOpen(false);
      setMode("input");
      setAgentPhase("ready");
      setAgentOutput("");
      setAgentRunId(undefined);
      window.setTimeout(() => setToast(undefined), 2600);
    } catch (cause) {
      setAgentError(friendlyError(cause, cause instanceof Error ? cause.message : "结果尚未插入，请重试。"));
      setAgentPhase("result");
    }
  }, [agentOutput, agentRunId]);

  const defaultPosition = targetRect ? defaultLauncherPosition(targetRect, launcherViewport) : undefined;
  const resolvedLauncherPosition = defaultPosition
    ? clampLauncherPosition(launcherPosition ?? defaultPosition, launcherViewport)
    : undefined;

  const handleLauncherPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !resolvedLauncherPosition) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    launcherDragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: resolvedLauncherPosition,
    };
  }, [resolvedLauncherPosition]);

  const handleLauncherPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = launcherDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    if (!drag.moved && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 4) return;
    drag.moved = true;
    setLauncherDragging(true);
    setLauncherPosition(
      clampLauncherPosition(
        { left: drag.startPosition.left + deltaX, top: drag.startPosition.top + deltaY },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, []);

  const finishLauncherDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>, suppressClick: boolean) => {
    const drag = launcherDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    launcherDragRef.current = undefined;
    setLauncherDragging(false);
    if (!suppressClick || !drag.moved) return;
    suppressLauncherClickRef.current = true;
    window.setTimeout(() => {
      suppressLauncherClickRef.current = false;
    }, 0);
  }, []);

  const launcherVisible =
    !open &&
    targetRect &&
    (document.activeElement === targetRef.current || launcherKeyboardActive) &&
    targetRect.width > 80 &&
    targetRect.height > 18;
  const panelStyle = mode !== "selection" && targetRect && window.innerWidth > 720
    ? {
        right: Math.max(12, Math.min(window.innerWidth - 372, window.innerWidth - targetRect.right)),
      }
    : undefined;
  const shortcutHint = /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘⇧L" : "Ctrl+Shift+L";

  return (
    <>
      {launcherVisible && (
        <div
          className="logue-launcher-group"
          style={{ top: resolvedLauncherPosition?.top, left: resolvedLauncherPosition?.left }}
          onPointerDown={handleLauncherPointerDown}
          onPointerMove={handleLauncherPointerMove}
          onPointerUp={(event) => finishLauncherDrag(event, true)}
          onPointerCancel={(event) => finishLauncherDrag(event, false)}
          onClickCapture={(event) => {
            if (!suppressLauncherClickRef.current) return;
            event.preventDefault();
            event.stopPropagation();
          }}
          data-dragging={launcherDragging || undefined}
          role="group"
          aria-label="可拖动的 Logue 输入工具"
          title="拖动以移动工具"
        >
          <button
            className="logue-launcher logue-launcher-voice"
            onClick={() => {
              setMode("input");
              setOpen(true);
              void refreshContext(referenceProject, !referenceProject).catch(() => undefined);
              void startRecording();
            }}
            aria-label="用 Logue 语音输入"
            title={`用 Logue 语音输入 (${shortcutHint})`}
            data-shortcut={shortcutHint}
            type="button"
          >
            <AudioLines size={15} strokeWidth={2.2} />
          </button>
          <button
            className="logue-launcher logue-launcher-agent"
            onClick={() => void openAgentGeneration()}
            aria-label="用 Logue Agent 生成"
            title="用 Logue Agent 生成"
            type="button"
          >
            <Sparkles size={14} />
          </button>
        </div>
      )}

      {open && (
        <div className={`logue-sidecar ${mode === "input" ? "logue-voice-sidecar" : ""}`} style={panelStyle} role="dialog" aria-label={mode === "input" ? "Logue 语音输入" : mode === "agent" ? "Logue Agent 生成" : "Logue 选区保存面板"}>
          {mode === "agent" ? (
            <AgentGenerationPanel
              agents={agents}
              selectedAgentId={selectedAgentId}
              instruction={agentInstruction}
              output={agentOutput}
              phase={agentPhase}
              contextLabel={agentContextLabel}
              errorMessage={agentError}
              onAgentChange={setSelectedAgentId}
              onInstructionChange={setAgentInstruction}
              onOutputChange={setAgentOutput}
              onGenerate={() => void runAgentGeneration()}
              onInsert={() => void insertAgentOutput()}
              onCopy={() => void navigator.clipboard.writeText(agentOutput).then(() => setToast("结果已复制"))}
              onRetry={() => void runAgentGeneration()}
              onClose={close}
            />
          ) : mode === "input" ? (
            <VoiceInputPanel
              phase={
                committing || phase === "processing" || phase === "review"
                  ? "processing"
                  : phase === "recording"
                    ? "recording"
                    : phase === "error"
                      ? "error"
                      : "starting"
              }
              elapsedSeconds={elapsed}
              errorMessage={errorMessage}
              errorKind={errorKind}
              onStopAndInsert={stopRecording}
              onCancel={close}
              onRetry={() => void retry()}
              onCopy={() => {
                void navigator.clipboard.writeText(reviewTranscript).then(() => setToast("文字已复制"));
              }}
            />
          ) : (
            <CapturePanel
              phase={phase}
              contexts={contexts}
              selectedText={selectedText}
              draft={draft}
              transcript={reviewTranscript}
              elapsedSeconds={elapsed}
              errorMessage={errorMessage}
              errorKind={errorKind}
              serviceConnected={connected}
              committing={committing}
              projectOptions={(contextData?.projects ?? []).map((project) => ({ value: project.name, label: project.name }))}
              selectedProject={referenceProject}
              selectedProjects={selectionProjects}
              tags={selectionTags}
              onDraftChange={setDraft}
              onTranscriptChange={setReviewTranscript}
              onClose={close}
              onStartRecording={() => void startRecording()}
              onStopRecording={stopRecording}
              onCancelRecording={cancelRecording}
              onUseTranscript={() => {
                const adopted = adoptedVoiceText(draft, reviewTranscript);
                setDraft(adopted);
                void commit(adopted);
              }}
              onRetry={() => void retry()}
              onDeleteRecording={() => void removeRecording()}
              onPrimary={() => void primary()}
              onProjectChange={(value) => {
                referenceProjectRef.current = value;
                setReferenceProject(value);
                void refreshContext(value).catch(() => undefined);
              }}
              onSelectedProjectsChange={setSelectionProjects}
              onTagsChange={setSelectionTags}
            />
          )}
        </div>
      )}

      {toast && (
        <div className="logue-toast" role="status">
          <Check size={15} /> {toast}
        </div>
      )}
    </>
  );
}

if (!isLogueExtensionDisabledDocument(document, window.location.href) && !document.getElementById("logue-extension-host")) {
  const host = document.createElement("div");
  host.id = "logue-extension-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  document.documentElement.append(host);
  createRoot(mount).render(
    <StrictMode>
      <ExtensionApp />
    </StrictMode>,
  );
}
