import { Check, ChevronDown, Copy, History, LoaderCircle, Undo2, X } from "lucide-react";
import { ProductStatus } from "@logue/ui";
import { useState, type CSSProperties } from "react";
import type { CaptureContext, CorrectionScope, VoiceProfileOverrides } from "../api";
import { VoiceProfilePicker } from "../VoiceProfilePicker";
import { actionButton, closeButton, cornerClose, fieldInput, floatingPanel, primaryAction, spinner } from "./surfaceStyles";

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

/**
 * The transcript on its way into the page. One editable block, one primary
 * action; profile and corrections stay folded until asked for. Once the text
 * lands, the panel collapses to a single confirmation row.
 */
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
  const profileLabel = context?.resolved_voice_profile.label || candidate.profileLabel;
  const settled = candidate.inserted || candidate.copied;

  const frame = embedded
    ? "relative w-full overflow-visible rounded-[10px] border border-line bg-white text-ink"
    : `${floatingPanel} overflow-visible`;

  const status = candidate.busy
    ? candidate.adoptionPending === "insert"
      ? "Inserting transcript…"
      : candidate.adoptionPending === "undo"
        ? "Undoing transcript insert…"
        : "Updating transcript…"
    : candidate.inserted
      ? "Transcript inserted."
      : candidate.copied
        ? "Transcript copied."
        : "Transcript ready.";

  // Settled: a single quiet row — confirmation, undo, done.
  if (settled) {
    return <section className={`${frame} ${embedded ? "" : "w-max max-w-[min(340px,calc(100vw-16px))]"}`} style={style} aria-label="Voice input candidate">
      <ProductStatus message={status} />
      <div className="flex h-9 items-center gap-0.5 p-1 pl-2">
        <Check size={14} className="text-[#347847]" />
        <span className="pr-1.5 pl-1 text-xs text-ink-soft">{candidate.copied ? "Copied" : "Inserted"}</span>
        {candidate.adoptionPending && onRetryAdoption ? <button type="button" className={actionButton} onClick={onRetryAdoption} disabled={candidate.busy}>Retry save</button> : null}
        {candidate.canUndo ? <button type="button" className={actionButton} disabled={candidate.busy} onClick={onUndo}>{candidate.busy && candidate.adoptionPending === "undo" ? <LoaderCircle className={spinner} size={13} /> : <Undo2 size={13} />}Undo</button> : null}
        <button type="button" className={closeButton} onClick={onDismiss} aria-label="Done"><X size={14} /></button>
      </div>
      {candidate.error && <p className="mx-2 mb-1.5 text-xs text-danger" role="alert">{candidate.error}</p>}
    </section>;
  }

  return <section
    className={`${frame} ${embedded ? "" : "w-[min(340px,calc(100vw-16px))]"}`}
    style={style}
    aria-label="Voice input candidate"
  >
    <ProductStatus message={status} />
    <button type="button" className={`${closeButton} ${cornerClose}`} onClick={onDismiss} aria-label="Close candidate" title={`Close — revision ${candidate.revision} stays in Library`}><X size={14} /></button>
    <textarea
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
      className="block max-h-52 min-h-20 w-full resize-y border-0 bg-transparent py-2 pr-8 pl-2.5 text-[13px] leading-[1.5] text-ink outline-0"
      aria-label="Text to insert"
    />
    {candidate.error && <p className="mx-2.5 mb-1.5 text-xs text-danger" role="alert">{candidate.error}</p>}
    {optionsOpen && <div className="mx-2.5 mb-1.5 grid gap-1.5 border-t border-line pt-2">
      <VoiceProfilePicker context={context} overrides={overrides} onChange={onOverridesChange} onClose={() => setOptionsOpen(false)} embedded />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 text-muted">
        <input className={fieldInput} value={spoken} onChange={(event) => setSpoken(event.target.value)} placeholder="Heard" aria-label="Heard term" />
        <span>→</span>
        <input className={fieldInput} value={preferred} onChange={(event) => setPreferred(event.target.value)} placeholder="Preferred" aria-label="Preferred spelling" />
      </div>
      <div className="flex items-center gap-1">
        <select className={`${fieldInput} flex-1`} value={scope} onChange={(event) => setScope(event.target.value as CorrectionScope)} aria-label="Remember correction">
          <option value="only">Only this time</option>
          <option value="topic" disabled={!selectedTopic}>Remember for Topic</option>
          <option value="project" disabled={!selectedProject || projectProfileDisabled}>Remember for Project</option>
          <option value="global">Remember globally</option>
        </select>
        <button type="button" className={actionButton} disabled={candidate.busy || correctionIncomplete || invalidScope} onClick={() => onRetranscribe(spoken.trim() && preferred.trim() ? { correction: { spoken: spoken.trim(), preferred: preferred.trim(), scope } } : {})}>{candidate.busy ? <LoaderCircle className={spinner} size={13} /> : <History size={13} />}Re-transcribe</button>
      </div>
    </div>}
    <footer className="flex h-9 items-center gap-0.5 border-t border-line p-1">
      <button type="button" className={`${actionButton} max-w-[45%] font-normal text-muted`} aria-expanded={optionsOpen} aria-label={`Voice options · ${profileLabel}`} onClick={() => setOptionsOpen((value) => !value)}><span className="truncate">{profileLabel}</span><ChevronDown size={11} className="shrink-0" /></button>
      {candidate.error && onCopy ? <button type="button" className={actionButton} onClick={onCopy} disabled={candidate.busy}><Copy size={13} />Copy</button> : null}
      <span className="flex-1" />
      {candidate.adoptionPending && onRetryAdoption ? <button type="button" className={actionButton} onClick={onRetryAdoption} disabled={candidate.busy}>Retry save</button> : null}
      {candidate.canUndo
        ? <button type="button" className={`${actionButton} ${primaryAction}`} disabled={candidate.busy} onClick={onUndo}><Undo2 size={13} />Undo</button>
        : <button type="button" className={`${actionButton} ${primaryAction}`} disabled={candidate.busy || !candidate.text.trim() || Boolean(candidate.adoptionPending)} onClick={onInsert}>Insert <kbd>⌘↵</kbd></button>}
    </footer>
  </section>;
}
