import { Bookmark, Check, ChevronDown, LoaderCircle, MessageSquarePlus, Mic, Sparkles, X } from "lucide-react";
import { OverlayMenu } from "@logue/ui";
import { useState, type CSSProperties, type SyntheticEvent } from "react";
import type { CaptureContext, VoiceProfileOverrides } from "../voiceProfileModels";
import { VoiceProfilePicker } from "../VoiceProfilePicker";

export type SelectionCommentPhase = "ready" | "starting" | "recording" | "committing" | "error";

interface SelectionSkillOption {
  id: string;
  name: string;
}

export function V2SelectionSurface({
  phase,
  style,
  error,
  textOpen = false,
  textValue = "",
  textSaving = false,
  skills = [],
  onStart,
  onAccept,
  onCancel,
  onTextOpen = () => undefined,
  onTextChange = () => undefined,
  onTextSave = () => undefined,
  onSaveSelection = () => undefined,
  onUseSkill = async () => undefined,
  profileContext,
  profileOverrides = {},
  profilePickerOpen = false,
  onProfileOverridesChange = () => undefined,
  onProfilePickerOpenChange = () => undefined,
}: {
  phase: SelectionCommentPhase;
  style?: CSSProperties;
  error?: string;
  textOpen?: boolean;
  textValue?: string;
  textSaving?: boolean;
  skills?: SelectionSkillOption[];
  onStart: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onTextOpen?: () => void;
  onTextChange?: (value: string) => void;
  onTextSave?: () => void;
  onSaveSelection?: () => void;
  onUseSkill?: (skillId: string) => Promise<void>;
  profileContext?: CaptureContext;
  profileOverrides?: VoiceProfileOverrides;
  profilePickerOpen?: boolean;
  onProfileOverridesChange?: (value: VoiceProfileOverrides) => void;
  onProfilePickerOpenChange?: (value: boolean) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [runningSkillId, setRunningSkillId] = useState<string>();
  const [skillError, setSkillError] = useState("");
  const busy = phase === "starting" || phase === "committing" || textSaving;
  const profileLabel = profileContext?.resolved_voice_profile.label || "Default voice";
  const directSkills = skills.slice(0, 2);
  const moreSkills = skills.slice(2);
  const preserveSelection = (event: SyntheticEvent) => event.preventDefault();

  async function runSkill(id: string) {
    setRunningSkillId(id);
    setSkillError("");
    try { await onUseSkill(id); } catch (cause) { setSkillError(cause instanceof Error ? cause.message : "Could not apply this Skill."); } finally { setRunningSkillId(undefined); }
  }

  return <div
    className={`v2-selection-toolbar is-${textOpen ? "text" : phase}`}
    style={style}
    role="group"
    aria-label="Actions for selected text"
    onPointerDown={textOpen ? undefined : preserveSelection}
  >
    {textOpen ? <div className="v2-selection-text-comment">
      <div className="v2-selection-text-heading"><span>Comment on selected text</span><button type="button" aria-label="Cancel text comment" onClick={onCancel}><X size={15} /></button></div>
      <textarea autoFocus value={textValue} onChange={(event) => onTextChange(event.target.value)} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); onCancel(); }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); onTextSave(); }
      }} placeholder="Add your thought" aria-label="Text comment" />
      <div className="v2-selection-text-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="is-primary" disabled={!textValue.trim() || textSaving} onClick={onTextSave}>{textSaving ? <LoaderCircle className="v2-inline-spinner" size={14} /> : null}Add comment</button></div>
    </div> : phase === "recording" ? <>
      <span className="v2-selection-recording" role="status"><span />Recording</span>
      <button type="button" className="v2-selection-action is-primary" aria-keyshortcuts="Enter" title="Accept (Enter)" onClick={onAccept}><Check size={15} />Accept <kbd>↵</kbd></button>
      <button type="button" className="v2-selection-action" aria-keyshortcuts="Escape" title="Cancel (Esc)" onClick={onCancel}>Cancel <kbd>Esc</kbd></button>
    </> : busy ? <><LoaderCircle className="v2-inline-spinner" size={15} /><span className="v2-selection-busy" role="status">{phase === "starting" ? "Starting microphone…" : textSaving ? "Saving comment…" : "Saving comment…"}</span>{phase === "starting" ? <button type="button" className="v2-selection-action" onClick={onCancel}>Cancel</button> : null}</> : <>
      <button type="button" className="v2-selection-icon is-primary" aria-label={phase === "error" ? "Retry voice comment" : "Add voice comment"} title={phase === "error" ? "Retry voice comment" : `Voice comment · ${profileLabel}`} onClick={onStart}><Mic size={16} /></button>
      <button type="button" className="v2-selection-profile" aria-expanded={profilePickerOpen} aria-label={`Voice profile: ${profileLabel}`} onClick={() => onProfilePickerOpenChange(!profilePickerOpen)}><span>{profileLabel}</span><ChevronDown size={11} /></button>
      <button type="button" className="v2-selection-icon" aria-label="Write comment" title="Write comment" onClick={onTextOpen}><MessageSquarePlus size={16} /></button>
      <button type="button" className="v2-selection-icon" aria-label="Save selection" title="Save selection" onClick={onSaveSelection}><Bookmark size={16} /></button>
      {directSkills.length ? <span className="v2-selection-divider" aria-hidden="true" /> : null}
      {directSkills.map((skill) => <button key={skill.id} type="button" className="v2-selection-action" disabled={Boolean(runningSkillId)} onClick={() => void runSkill(skill.id)} title={skill.name}>{runningSkillId === skill.id ? <LoaderCircle size={13} className="v2-inline-spinner" /> : <Sparkles size={13} />}<span>{skill.name}</span></button>)}
      {moreSkills.length ? <OverlayMenu open={moreOpen} onOpenChange={setMoreOpen} placement="bottom-end" ariaLabel="More Selection Skills" menuClassName="v2-selection-skill-menu" trigger={(props) => <button {...props} type="button" className="v2-selection-action"><Sparkles size={13} />More…</button>}>{moreSkills.map((skill) => <button key={skill.id} type="button" role="menuitem" disabled={Boolean(runningSkillId)} onClick={() => void runSkill(skill.id)}>{runningSkillId === skill.id ? <LoaderCircle size={14} className="v2-inline-spinner" /> : <Sparkles size={14} />}{skill.name}</button>)}</OverlayMenu> : null}
    </>}
    {profilePickerOpen && !busy && !textOpen && phase !== "recording" ? <div className="v2-selection-profile-popover"><VoiceProfilePicker context={profileContext} overrides={profileOverrides} onChange={onProfileOverridesChange} onClose={() => onProfilePickerOpenChange(false)} /></div> : null}
    {error || skillError ? <div className="v2-selection-error" role="alert">{error || skillError}</div> : null}
  </div>;
}
