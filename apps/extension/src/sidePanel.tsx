import { ChevronRight, Mic, Square } from "lucide-react";
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getCaptureContext,
  getExtensionAgents,
  getExtensionSettings,
  createExtensionAgentRun,
  adoptExtensionAgentRun,
  saveMaterial,
  saveSelection,
  transcribeAudio,
  type AppliedContext,
  type CaptureContext,
  type ExtensionAgent,
} from "./api";
import {
  friendlyLocalError,
  type LocalError,
  type PanelCaptureState,
} from "./capturePrimitives";
import { createAudioRecorder, type AudioRecorderController } from "./recorder";
import { createRequestId } from "./requestId";
import { sidePanelShortcutAction } from "./sidePanelShortcuts";
import "./sidePanel.css";

type Phase = "idle" | "starting" | "recording" | "processing" | "error";

interface RuntimeResponse<T> { ok: boolean; value?: T; }

function splitTags(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim().replace(/^#/, "")).filter(Boolean))];
}

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
  const [project, setProject] = useState("");
  const [tags, setTags] = useState("");
  const [context, setContext] = useState<CaptureContext>();
  const [error, setError] = useState<LocalError>();
  const [elapsed, setElapsed] = useState(0);
  const [skills, setSkills] = useState<ExtensionAgent[]>([]);
  const [skillId, setSkillId] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [generationRunId, setGenerationRunId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const recorderRef = useRef<AudioRecorderController | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(createRequestId());
  const lastBlobRef = useRef<Blob | undefined>(undefined);
  const stateRef = useRef<PanelCaptureState | undefined>(undefined);
  const projectRef = useRef("");
  const tagsRef = useRef("");
  const draftRef = useRef("");
  const transcriptRef = useRef("");
  const transcribeAndSaveRef = useRef<(blob: Blob) => Promise<void>>(async () => undefined);
  const startRecordingRef = useRef<() => void>(() => undefined);
  const phaseRef = useRef<Phase>("idle");

  stateRef.current = state;
  projectRef.current = project;
  tagsRef.current = tags;
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

  const appliedContext = useCallback((captureContext: CaptureContext, projectName: string): AppliedContext => {
    const selectedProject = captureContext.projects.find((item) => item.name === projectName);
    return {
      page_url: stateRef.current?.source.url ?? "",
      page_title: stateRef.current?.source.title ?? "",
      reference_project: projectName || undefined,
      personal_context: captureContext.personal_context || undefined,
      project_overview: selectedProject?.overview || undefined,
      glossary: [...captureContext.personal_glossary, ...(selectedProject?.glossary ?? [])],
      recent_adopted_ids: captureContext.recent_adopted_refs?.map((item) => item.id) ?? [],
      recent_adopted_texts: captureContext.recent_adopted_refs?.map((item) => item.text) ?? captureContext.recent_adopted,
    };
  }, []);

  const saveContent = useCallback(async (content: string, captureId?: string, rawTranscript?: string) => {
    const current = stateRef.current;
    if (!current) return;
    const projects = projectRef.current ? [projectRef.current] : [];
    const selectedTags = splitTags(tagsRef.current);
    const currentContext = context ?? await getCaptureContext(current.source.url, projectRef.current);
    const provenance = appliedContext(currentContext, projectRef.current);
    if (current.selectionText) {
      await saveSelection({
        requestId: requestIdRef.current,
        sourceContent: current.selectionText,
        annotation: content.trim() || undefined,
        transcript: captureId ? rawTranscript : undefined,
        source: { ...current.source, selection: current.selectionText },
        projects,
        tags: selectedTags,
        captureId,
        appliedContext: provenance,
      });
    } else {
      const saved = await saveMaterial({
        requestId: requestIdRef.current,
        kind: captureId ? "voice" : "text",
        content,
        transcript: captureId ? rawTranscript : undefined,
        source: current.source,
        projects,
        tags: selectedTags,
        captureId,
        appliedContext: provenance,
      });
      if (current.intent === "input") {
        const response = await chrome.tabs.sendMessage(current.tabId, { type: "logue:insert-text", text: content }) as { ok?: boolean } | undefined;
        if (!response?.ok) throw new Error(`target unavailable:${saved.id}`);
      }
    }
    setDraft("");
    setTranscript("");
    setError(undefined);
    requestIdRef.current = createRequestId();
    persistDraft({ draft: "", transcript: "" });
  }, [appliedContext, context, persistDraft]);

  const transcribeAndSave = useCallback(async (blob: Blob) => {
    const current = stateRef.current;
    if (!current) return;
    setPhase("processing");
    setError(undefined);
    try {
      const currentContext = context ?? await getCaptureContext(current.source.url, projectRef.current);
      const selectedProject = currentContext.projects.find((item) => item.name === projectRef.current);
      const result = await transcribeAudio({
        audio: blob,
        source: current.source,
        targetText: current.intent === "input" ? current.targetText : undefined,
        selectedText: current.selectionText,
        projectContext: [currentContext.personal_context, selectedProject?.overview].filter(Boolean).join("\n\n"),
        glossary: [...currentContext.personal_glossary, ...(selectedProject?.glossary ?? [])].join("\n"),
        instructions: current.selectionText
          ? "Transcribe this as an annotation to the selected source."
          : "Transcribe this as concise text linked to the current page.",
        appliedContext: appliedContext(currentContext, projectRef.current),
      });
      setTranscript(result.text);
      persistDraft({ transcript: result.text });
      await saveContent(result.text, result.capture_id, result.text);
      setPhase("idle");
    } catch (cause) {
      setError(friendlyLocalError(cause, /target unavailable/i.test(String(cause)) ? "target" : "transcription"));
      setPhase("error");
    }
  }, [appliedContext, context, persistDraft, saveContent]);

  transcribeAndSaveRef.current = transcribeAndSave;

  const ensureRecorder = useCallback(() => {
    if (recorderRef.current) return recorderRef.current;
    recorderRef.current = createAudioRecorder({
      getStream: () => navigator.mediaDevices.getUserMedia({ audio: true }),
      onStart: () => {
        setPhase("recording");
        setElapsed(0);
        timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
      },
      onStop: (blob) => {
        stopTimer();
        lastBlobRef.current = blob;
        void transcribeAndSaveRef.current(blob);
      },
      onError: (cause) => {
        stopTimer();
        setError(friendlyLocalError(cause, "microphone"));
        setPhase("error");
      },
    });
    return recorderRef.current;
  }, [stopTimer, transcribeAndSave]);

  const startRecording = useCallback(() => {
    if (phaseRef.current === "starting" || phaseRef.current === "recording" || phaseRef.current === "processing") return;
    setPhase("starting");
    setError(undefined);
    void ensureRecorder().start();
  }, [ensureRecorder]);

  startRecordingRef.current = startRecording;

  const runGeneration = useCallback(async () => {
    const current = stateRef.current;
    if (!current || !skillId || !draft.trim()) return;
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
    } catch (cause) {
      setError(friendlyLocalError(cause, "target"));
    }
  }, [generatedText, generationRunId]);

  const stopRecording = useCallback(() => ensureRecorder().stop(), [ensureRecorder]);
  const cancelRecording = useCallback(() => {
    ensureRecorder().cancel();
    stopTimer();
    setPhase("idle");
    setElapsed(0);
  }, [ensureRecorder, stopTimer]);

  useEffect(() => {
    const hydrate = (next?: PanelCaptureState) => {
      if (!next) return;
      setState(next);
      setDraft(next.draft ?? "");
      setTranscript(next.transcript ?? "");
      setProject(next.projects?.[0] ?? "");
      setTags((next.tags ?? []).join(", "));
      setPhase("idle");
      setError(undefined);
      requestIdRef.current = createRequestId();
      void getCaptureContext(next.source.url, next.projects?.[0] ?? "")
        .then(setContext)
        .catch(() => setContext(undefined));
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
    const listener = (message: { type?: string; state?: PanelCaptureState }) => {
      if (message.type === "logue:panel-state-changed") hydrate(message.state);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

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
      recorderRef.current?.dispose();
      stopTimer();
      persistDraft({
        draft: draftRef.current,
        transcript: transcriptRef.current,
        projects: projectRef.current ? [projectRef.current] : [],
        tags: splitTags(tagsRef.current),
      });
    };
  }, [persistDraft, stopTimer]);

  const organizationCount = (project ? 1 : 0) + splitTags(tags).length;
  const sourceHref = useMemo(() => state?.source.url || undefined, [state]);

  if (!state) return <div className="empty">Open Logue from a page to begin.</div>;

  return (
    <main className="panel">
      <div className="panel-main">
        <p className="eyebrow">{sourceLabel(state)}</p>
        <h1 className="page-title">
          {sourceHref ? <a className="source-link" href={sourceHref} target="_blank" rel="noreferrer" title={state.source.title}>{state.source.title}</a> : state.source.title}
        </h1>

        {state.selectionText && <blockquote className="selection">{state.selectionText}</blockquote>}

        {state.intent === "generate" && generatedText ? (
          <textarea className="text-area" value={generatedText} onChange={(event) => setGeneratedText(event.target.value)} aria-label="Generated reply" />
        ) : phase === "processing" || phase === "starting" ? (
          <div className="processing" role="status"><span className="spinner" />{phase === "starting" ? "Starting microphone…" : "Transcribing…"}</div>
        ) : (
          <textarea
            className="text-area"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); persistDraft({ draft: event.target.value }); }}
            placeholder={state.intent === "generate" ? "What should Logue write?" : state.selectionText ? "Add a note…" : state.intent === "input" ? "Write or record…" : "Add a note to this page…"}
            aria-label={state.intent === "generate" ? "Generation instruction" : state.selectionText ? "Annotation" : "Note"}
          />
        )}

        {state.intent === "generate" ? (
          <label className="field-label generation-skill">Skill
            <select className="field" value={skillId} onChange={(event) => setSkillId(event.target.value)}>
              {skills.length ? skills.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No extension skills</option>}
            </select>
          </label>
        ) : <details className="organization">
          <summary>Organize <span className="organization-meta">{organizationCount ? `${organizationCount} set` : "Automatic"}</span><ChevronRight size={15} /></summary>
          <div className="organization-fields">
            <label className="field-label">Project
              <select className="field" value={project} onChange={(event) => { setProject(event.target.value); persistDraft({ projects: event.target.value ? [event.target.value] : [] }); }}>
                <option value="">Automatic</option>
                {(context?.projects ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label className="field-label">Tags
              <input className="field" value={tags} onChange={(event) => { setTags(event.target.value); persistDraft({ tags: splitTags(event.target.value) }); }} placeholder="Automatic, or add tags separated by commas" />
            </label>
          </div>
        </details>}

        {error && <div className="error" role="alert">{error.message}</div>}

        <div className="actions">
          {state.intent === "generate" ? (
            generatedText ? <button type="button" className="button secondary" onClick={() => { setGeneratedText(""); setGenerationRunId(undefined); }}>Back</button> : null
          ) : phase === "starting" ? (
            <button type="button" className="button secondary" onClick={cancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
          ) : phase === "recording" ? (
            <>
              <button type="button" className="button secondary" onClick={cancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
              <button type="button" className="record-button recording" onClick={stopRecording} aria-keyshortcuts="Enter" title="Stop and save (Enter)"><Square size={14} fill="currentColor" /> Stop <span className="shortcut">{elapsed}s</span></button>
            </>
          ) : (
            <button type="button" className="record-button" onClick={startRecording} disabled={phase === "processing"} aria-keyshortcuts="R" title="Record (R)"><Mic size={17} /> Record <span className="shortcut">R</span></button>
          )}
          <span className="spacer" />
          {state.intent !== "generate" && error && lastBlobRef.current && <button type="button" className="button secondary" onClick={() => void transcribeAndSave(lastBlobRef.current!)}>Retry</button>}
          {state.intent === "generate" ? <button
            type="button"
            className="button"
            disabled={generatedText ? false : !draft.trim() || !skillId || generating}
            onClick={() => generatedText ? void useGeneratedText() : void runGeneration()}
          >{generating ? "Generating…" : generatedText ? "Insert" : "Generate"}</button> : draft.trim() ? <button
            type="button"
            className="button"
            disabled={!draft.trim() || phase === "recording" || phase === "processing" || phase === "starting"}
            onClick={() => void saveContent(draft.trim()).catch((cause) => { setError(friendlyLocalError(cause, "save")); setPhase("error"); })}
          >Save</button> : null}
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><SidePanelApp /></StrictMode>);
