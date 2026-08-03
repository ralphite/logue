import { ArrowLeft, Mic, Sparkles, Square } from "lucide-react";
import type { Ref } from "react";
import type { ExtensionSkill, LocalError, PageMaterial, PanelCaptureState, PendingInsert } from "./sidePanelModels";
import { capturePhasePresentation, type CapturePhase } from "./sidePanelPresentation";
import { shouldShowPageHistory } from "./sidePanelPageHistory";

function sourceLabel(state: PanelCaptureState) {
  if (state.intent === "selection") return "Selection";
  if (state.intent === "input") return "Current editor";
  if (state.intent === "generate") return "Generate";
  return "Current page";
}

export function SidePanelView({
  state,
  phase,
  draft,
  generatedText,
  skills,
  skillId,
  pageMaterials,
  error,
  elapsed,
  pendingInsert,
  insertingPending,
  generating,
  canRetry,
  panelRef,
  onDraftChange,
  onGeneratedTextChange,
  onSkillIdChange,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onRetryTranscription,
  onSave,
  onRequestGeneration,
  onReturnToPage,
  onGenerate,
  onInsertGenerated,
  onRetryInsert,
  onCopyPendingInsert,
}: {
  state?: PanelCaptureState;
  phase: CapturePhase;
  draft: string;
  generatedText: string;
  skills: ExtensionSkill[];
  skillId: string;
  pageMaterials: PageMaterial[];
  error?: LocalError;
  elapsed: number;
  pendingInsert?: PendingInsert;
  insertingPending: boolean;
  generating: boolean;
  canRetry: boolean;
  panelRef?: Ref<HTMLElement>;
  onDraftChange: (value: string) => void;
  onGeneratedTextChange: (value: string) => void;
  onSkillIdChange: (value: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onRetryTranscription: () => void;
  onSave: () => void;
  onRequestGeneration: () => void;
  onReturnToPage: () => void;
  onGenerate: () => void;
  onInsertGenerated: () => void;
  onRetryInsert: () => void;
  onCopyPendingInsert: () => void;
}) {
  if (!state) return <div className="empty">Open Logue from a page to begin.</div>;

  const sourceHref = state.source.url || undefined;
  const presentation = capturePhasePresentation(phase);

  return (
    <main ref={panelRef} className="panel" tabIndex={-1}>
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
          <textarea className="text-area" value={generatedText} onChange={(event) => onGeneratedTextChange(event.target.value)} aria-label="Generated reply" />
        ) : (
          <textarea
            className="text-area"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={state.intent === "generate" ? "What should Logue write?" : state.selectionText ? "Add a note…" : state.intent === "input" ? "Write or record…" : "Add a note to this page…"}
            aria-label={state.intent === "generate" ? "Generation instruction" : state.selectionText ? "Annotation" : "Note"}
          />
        ))}

        {presentation.showEditor && state.intent === "generate" && !generatedText && (
          <label className="field-label generation-skill">Skill
            <select className="field" value={skillId} onChange={(event) => onSkillIdChange(event.target.value)}>
              {skills.length ? skills.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No extension skills</option>}
            </select>
          </label>
        )}

        {presentation.showErrors && error && <div className="error" role="alert">{error.message}</div>}

        {presentation.showActions && <div className="actions">
          {phase === "starting" ? (
            <button type="button" className="button secondary" onClick={onCancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
          ) : phase === "recording" ? (
            <>
              <button type="button" className="button secondary" onClick={onCancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
              <button type="button" className="record-button recording" onClick={onStopRecording} aria-keyshortcuts="Enter" title="Stop and save (Enter)"><Square size={14} fill="currentColor" /> Stop <span className="shortcut">{elapsed}s</span></button>
            </>
          ) : state.intent === "generate" ? (
            <button type="button" className="icon-button" onClick={onReturnToPage} aria-label="Back to page capture" title="Back to page capture"><ArrowLeft size={17} /></button>
          ) : pendingInsert ? null : (
            <>
              <button type="button" className="record-button" onClick={onStartRecording} aria-keyshortcuts="R" title="Record — R when this sidebar is focused"><Mic size={17} /> Record</button>
              {state.targetAvailable && <button type="button" className="icon-button" onClick={onRequestGeneration} aria-label="Generate reply" title="Generate reply"><Sparkles size={17} /></button>}
            </>
          )}
          {!presentation.captureActive && <>
            <span className="spacer" />
            {state.intent !== "generate" && error && canRetry && !pendingInsert && <button type="button" className="button secondary" onClick={onRetryTranscription}>Retry</button>}
            {state.intent !== "generate" && pendingInsert && <>
              <button type="button" className="button secondary" onClick={onCopyPendingInsert}>Copy</button>
              {state.targetAvailable && state.source.url === pendingInsert.sourceURL && <button type="button" className="button" disabled={insertingPending} onClick={onRetryInsert}>{insertingPending ? "Inserting…" : "Insert again"}</button>}
            </>}
            {state.intent === "generate" ? <button
              type="button"
              className="button"
              disabled={generatedText ? false : !draft.trim() || !skillId || generating}
              onClick={generatedText ? onInsertGenerated : onGenerate}
            >{generating ? "Generating…" : generatedText ? "Insert" : "Generate"}</button> : draft.trim() && !pendingInsert ? <button type="button" className="button" onClick={onSave}>Save</button> : null}
          </>}
        </div>}

        {shouldShowPageHistory(presentation.showSavedMaterials, state.intent, pageMaterials.length) && (
          <section className="page-materials" aria-label="Notes from this page">
            <h2 className="page-materials-heading">On this page</h2>
            <ol className="page-materials-list">
              {pageMaterials.map((material) => <li key={material.id} className="page-material"><p className="page-material-text">{material.annotation?.trim() || material.content}</p></li>)}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
