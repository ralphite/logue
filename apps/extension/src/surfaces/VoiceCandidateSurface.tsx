import { Check, ChevronDown, Copy, History, LoaderCircle, Undo2, X } from "lucide-react";
import { ProductStatus } from "@logue/ui";
import { useState, type CSSProperties } from "react";
import type { CaptureContext, CorrectionScope, VoiceProfileOverrides } from "../api";
import { VoiceProfilePicker } from "../VoiceProfilePicker";
import { candidateAction, closeButton, fieldInput, floatingPanel, primaryAction, spinner } from "./surfaceStyles";

export interface VoiceCandidateState {
  materialId: string;
  text: string;
  revision: number;
  profileLabel: string;
  referenceProject?: string;
  purpose?: "write" | "comment";
  busy?: boolean;
  inserted?: boolean;
  copied?: boolean;
  canUndo?: boolean;
  error?: string;
  adoptionId?: string;
  adoptionPending?: "copy" | "insert" | "undo";
  adoptionTarget?: { surface?: string; url?: string; target_key?: string };
  undoNeedsInsert?: boolean;
}

export interface VoiceCandidateRetranscribeInput {
  correction?: { spoken: string; preferred: string; scope: CorrectionScope };
}

export function VoiceCandidateSurface({
  candidate,
  context,
  overrides,
  onOverridesChange,
  onTextChange,
  onRetranscribe,
  onInsert,
  onCopy,
  onUndo,
  onRetryAdoption,
  onDismiss,
  style,
  embedded = false,
}: {
  candidate: VoiceCandidateState;
  context?: CaptureContext;
  overrides: VoiceProfileOverrides;
  onOverridesChange: (value: VoiceProfileOverrides) => void;
  onTextChange: (value: string) => void;
  onRetranscribe: (input: VoiceCandidateRetranscribeInput) => void;
  onInsert: () => void;
  onCopy?: () => void;
  onUndo: () => void;
  onRetryAdoption?: () => void;
  onDismiss: () => void;
  style?: CSSProperties;
  embedded?: boolean;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [spoken, setSpoken] = useState("");
  const [preferred, setPreferred] = useState("");
  const [scope, setScope] = useState<CorrectionScope>("only");
  const selectedProject = overrides.use_default_profile
    ? ""
    : overrides.profile_project ?? context?.resolved_voice_profile.project_name ?? "";
  const selectedTopic = overrides.topic_vocabulary_id ?? context?.resolved_voice_profile.topic_vocabulary_id ?? "";
  const correctionIncomplete = Boolean(spoken.trim()) !== Boolean(preferred.trim());
  const projectProfileDisabled = overrides.disable_project_profile || context?.resolved_voice_profile.project_mode === "disabled";
  const invalidScope = (scope === "project" && (!selectedProject || projectProfileDisabled)) || (scope === "topic" && !selectedTopic);

  return <section
    className={embedded
      ? "relative w-full overflow-visible rounded-[13px] border border-[rgb(35_37_31/13%)] bg-[rgb(255_255_255/98%)] text-ink"
      : `${floatingPanel} w-[min(380px,calc(100vw-16px))] overflow-visible`}
    style={style}
    aria-label="Voice input candidate"
  >
    <ProductStatus
      message={
        candidate.busy
          ? candidate.adoptionPending === "insert"
            ? "Inserting transcript…"
            : candidate.adoptionPending === "undo"
              ? "Undoing transcript insert…"
              : "Updating transcript…"
          : candidate.inserted
            ? "Transcript inserted."
            : candidate.copied
              ? "Transcript copied."
              : "Transcript ready."
      }
    />
    <header className="flex min-h-9.5 items-center justify-between gap-2.5 border-b border-line pr-2 pl-3 text-xs text-muted [&>span]:truncate"><span>Voice · {context?.resolved_voice_profile.label || candidate.profileLabel} · revision {candidate.revision}</span><button type="button" className={closeButton} onClick={onDismiss} aria-label="Close candidate" title={`Close — revision ${candidate.revision} stays in Library`}><X size={15} /></button></header>
    {candidate.inserted || candidate.copied ? <div className="flex min-h-24 items-center justify-center gap-[7px] text-sm text-[#347847]"><Check size={16} /><span>{candidate.copied ? "Copied" : "Inserted"}</span></div> : <textarea
      value={candidate.text}
      autoFocus
      onChange={(event) => onTextChange(event.target.value)}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onInsert();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
      className="block max-h-55 min-h-27.5 w-full resize-y border-0 bg-transparent p-3 text-sm leading-[1.55] text-ink outline-0"
      aria-label="Text to insert"
    />}
    {candidate.error && <p className="mx-3 mb-2.5 text-xs text-danger" role="alert">{candidate.error}</p>}
    {!candidate.inserted && !candidate.copied && optionsOpen && <div className="mx-3 mb-2.5 border-t border-line pt-[5px]">
      <VoiceProfilePicker context={context} overrides={overrides} onChange={onOverridesChange} onClose={() => setOptionsOpen(false)} embedded />
      <div className="mt-[9px] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-muted">
        <input className={fieldInput} value={spoken} onChange={(event) => setSpoken(event.target.value)} placeholder="Heard term" aria-label="Heard term" />
        <span>→</span>
        <input className={fieldInput} value={preferred} onChange={(event) => setPreferred(event.target.value)} placeholder="Preferred spelling" aria-label="Preferred spelling" />
      </div>
      <div className="mt-2 flex items-center gap-[7px]">
        <select className={`${fieldInput} flex-1`} value={scope} onChange={(event) => setScope(event.target.value as CorrectionScope)} aria-label="Remember correction">
          <option value="only">Only this time</option>
          <option value="topic" disabled={!selectedTopic}>Remember for Topic</option>
          <option value="project" disabled={!selectedProject || projectProfileDisabled}>Remember for Project</option>
          <option value="global">Remember globally</option>
        </select>
        <button type="button" className="inline-flex min-h-8.5 items-center gap-[5px] rounded-[7px] bg-surface-muted px-2.5 text-ink-soft disabled:opacity-[0.46]" disabled={candidate.busy || correctionIncomplete || invalidScope} onClick={() => onRetranscribe(spoken.trim() && preferred.trim() ? { correction: { spoken: spoken.trim(), preferred: preferred.trim(), scope } } : {})}>{candidate.busy ? <LoaderCircle className={spinner} size={14} /> : <History size={14} />}Re-transcribe</button>
      </div>
    </div>}
    <footer className="flex min-h-11 items-center gap-[3px] border-t border-line px-[7px] py-[5px]">
      {!candidate.inserted && !candidate.copied && <button type="button" className={`${candidateAction} ${optionsOpen ? "bg-surface-muted text-ink" : ""}`} aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)}><span>Voice · {context?.resolved_voice_profile.label || candidate.profileLabel}</span><ChevronDown size={12} /></button>}
      {!candidate.inserted && !candidate.copied && candidate.error && onCopy ? <button type="button" className={candidateAction} onClick={onCopy} disabled={candidate.busy}><Copy size={14} />Copy saved text</button> : null}
      <span className="flex-1" />
      {candidate.adoptionPending && onRetryAdoption ? <button type="button" className={candidateAction} onClick={onRetryAdoption} disabled={candidate.busy}>Retry save</button> : null}
      {candidate.canUndo ? <button type="button" className={`${candidateAction} ${primaryAction}`} disabled={candidate.busy} onClick={onUndo}><Undo2 size={14} />Undo</button> : candidate.inserted || candidate.copied ? <button type="button" className={`${candidateAction} ${primaryAction}`} disabled={candidate.busy} onClick={onDismiss}>Done</button> : <button type="button" className={`${candidateAction} ${primaryAction}`} disabled={candidate.busy || !candidate.text.trim() || Boolean(candidate.adoptionPending)} onClick={onInsert}>Insert <kbd className="font-sans text-[10px] opacity-70">⌘↵</kbd></button>}
    </footer>
  </section>;
}
