import { Check, ChevronDown, Copy, History, LoaderCircle, Undo2, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { CaptureContext, CorrectionScope, VoiceProfileOverrides } from "../api";
import { VoiceProfilePicker } from "../VoiceProfilePicker";

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
}

export interface VoiceCandidateRetranscribeInput {
  correction?: { spoken: string; preferred: string; scope: CorrectionScope };
}

export function V2VoiceCandidateSurface({
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

  return <section className={`v2-voice-candidate${embedded ? " is-embedded" : ""}`} style={style} aria-label="Voice input candidate">
    <header className="v2-candidate-heading"><span>Voice · {context?.resolved_voice_profile.label || candidate.profileLabel} · revision {candidate.revision}</span><button type="button" onClick={onDismiss} aria-label="Close candidate" title={`Close — revision ${candidate.revision} stays in Library`}><X size={15} /></button></header>
    {candidate.inserted || candidate.copied ? <div className="v2-candidate-inserted"><Check size={16} /><span>{candidate.copied ? "Copied" : "Inserted"}</span></div> : <textarea
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
      aria-label="Text to insert"
    />}
    {candidate.error && <p className="v2-candidate-error" role="alert">{candidate.error}</p>}
    {!candidate.inserted && !candidate.copied && optionsOpen && <div className="v2-candidate-options">
      <VoiceProfilePicker context={context} overrides={overrides} onChange={onOverridesChange} onClose={() => setOptionsOpen(false)} embedded />
      <div className="v2-candidate-correction">
        <input value={spoken} onChange={(event) => setSpoken(event.target.value)} placeholder="Heard term" aria-label="Heard term" />
        <span>→</span>
        <input value={preferred} onChange={(event) => setPreferred(event.target.value)} placeholder="Preferred spelling" aria-label="Preferred spelling" />
      </div>
      <div className="v2-candidate-retranscribe-row">
        <select value={scope} onChange={(event) => setScope(event.target.value as CorrectionScope)} aria-label="Remember correction">
          <option value="only">Only this time</option>
          <option value="topic" disabled={!selectedTopic}>Remember for Topic</option>
          <option value="project" disabled={!selectedProject || projectProfileDisabled}>Remember for Project</option>
          <option value="global">Remember globally</option>
        </select>
        <button type="button" className="v2-candidate-retranscribe" disabled={candidate.busy || correctionIncomplete || invalidScope} onClick={() => onRetranscribe(spoken.trim() && preferred.trim() ? { correction: { spoken: spoken.trim(), preferred: preferred.trim(), scope } } : {})}>{candidate.busy ? <LoaderCircle className="v2-inline-spinner" size={14} /> : <History size={14} />}Re-transcribe</button>
      </div>
    </div>}
    <footer className="v2-candidate-actions">
      {!candidate.inserted && !candidate.copied && <button type="button" className={optionsOpen ? "is-active" : ""} aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)}><span>Voice · {context?.resolved_voice_profile.label || candidate.profileLabel}</span><ChevronDown size={12} /></button>}
      {!candidate.inserted && !candidate.copied && candidate.error && onCopy ? <button type="button" onClick={onCopy} disabled={candidate.busy}><Copy size={14} />Copy saved text</button> : null}
      <span />
      {candidate.adoptionPending && onRetryAdoption ? <button type="button" onClick={onRetryAdoption} disabled={candidate.busy}>Retry save</button> : null}
      {candidate.canUndo ? <button type="button" className="is-primary" disabled={candidate.busy} onClick={onUndo}><Undo2 size={14} />Undo</button> : candidate.inserted || candidate.copied ? <button type="button" className="is-primary" disabled={candidate.busy} onClick={onDismiss}>Done</button> : <button type="button" className="is-primary" disabled={candidate.busy || !candidate.text.trim() || Boolean(candidate.adoptionPending)} onClick={onInsert}>Insert <kbd>⌘↵</kbd></button>}
    </footer>
  </section>;
}
