import { Bookmark, Check, ChevronDown, LoaderCircle, MessageSquarePlus, Mic, Sparkles, X } from "lucide-react";
import { OverlayMenu, ProductStatus } from "@logue/ui";
import { useState, type CSSProperties, type SyntheticEvent } from "react";
import type { CaptureContext, VoiceProfileOverrides } from "../voiceProfileModels";
import { VoiceProfilePicker } from "../VoiceProfilePicker";
import { actionButton, closeButton, errorBubble, iconButton, menuSurface, primaryAction, profileButton, profilePopover, recordingChip, recordingDot, spinner } from "./surfaceStyles";

export type SelectionCommentPhase = "ready" | "starting" | "recording" | "committing" | "error";

interface SelectionSkillOption {
  id: string;
  name: string;
}

export function SelectionSurface({
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

  const width = textOpen ? "w-[min(360px,calc(100vw-16px))] items-stretch !p-0"
    : phase === "recording" ? "w-[286px]"
      : phase === "starting" || phase === "committing" ? "w-56"
        : "w-auto";
  return <div
    className={`fixed z-surface flex min-h-11 max-w-[calc(100vw-16px)] items-center gap-[5px] rounded-xl border border-[rgb(32_33_31/13%)] bg-[rgb(255_255_255/97%)] p-[5px] text-ink shadow-[0_10px_30px_rgb(25_27_23/14%)] backdrop-blur-[14px] ${width}`}
    style={style}
    role="group"
    aria-label="Actions for selected text"
    onPointerDown={textOpen ? undefined : preserveSelection}
  >
    <ProductStatus
      message={
        runningSkillId
          ? `Running ${skills.find((skill) => skill.id === runningSkillId)?.name ?? "Skill"}…`
          : undefined
      }
    />
    {textOpen ? <div className="w-full p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted"><span>Comment on selected text</span><button type="button" className={closeButton} aria-label="Cancel text comment" onClick={onCancel}><X size={15} /></button></div>
      <textarea autoFocus value={textValue} onChange={(event) => onTextChange(event.target.value)} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); onCancel(); }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); onTextSave(); }
      }} className="w-full min-h-[82px] resize-y border-0 bg-transparent px-px py-2 text-sm leading-[1.55] text-ink outline-0" placeholder="Add your thought" aria-label="Text comment" />
      <div className="flex justify-end gap-1.5 border-t border-line pt-2"><button type="button" className={actionButton} onClick={onCancel}>Cancel</button><button type="button" className={`${actionButton} ${primaryAction}`} disabled={!textValue.trim() || textSaving} onClick={onTextSave}>{textSaving ? <LoaderCircle className={spinner} size={14} /> : null}Add comment</button></div>
    </div> : phase === "recording" ? <>
      <span className={recordingChip} role="status"><span className={recordingDot} />Recording</span>
      <button type="button" className={`${actionButton} ${primaryAction}`} aria-keyshortcuts="Enter" title="Accept (Enter)" onClick={onAccept}><Check size={15} />Accept <kbd>↵</kbd></button>
      <button type="button" className={actionButton} aria-keyshortcuts="Escape" title="Cancel (Esc)" onClick={onCancel}>Cancel <kbd>Esc</kbd></button>
    </> : busy ? <><LoaderCircle className={spinner} size={15} /><span className="min-w-0 flex-1 text-xs text-muted" role="status">{phase === "starting" ? "Starting microphone…" : "Saving comment…"}</span>{phase === "starting" ? <button type="button" className={actionButton} onClick={onCancel}>Cancel</button> : null}</> : <>
      <button type="button" className={`${iconButton} bg-accent-soft text-accent hover:bg-[#e4e6fc] hover:text-accent-hover`} aria-label={phase === "error" ? "Retry voice comment" : "Add voice comment"} title={phase === "error" ? "Retry voice comment" : `Voice comment · ${profileLabel}`} onClick={onStart}><Mic size={16} /></button>
      <button type="button" className={`${profileButton} h-8 w-29 shrink-0`} aria-expanded={profilePickerOpen} aria-label={`Voice profile: ${profileLabel}`} onClick={() => onProfilePickerOpenChange(!profilePickerOpen)}><span>{profileLabel}</span><ChevronDown size={11} /></button>
      <button type="button" className={`${iconButton} hover:bg-surface-muted hover:text-ink`} aria-label="Write comment" title="Write comment" onClick={onTextOpen}><MessageSquarePlus size={16} /></button>
      <button type="button" className={`${iconButton} hover:bg-surface-muted hover:text-ink`} aria-label="Save selection" title="Save selection" onClick={onSaveSelection}><Bookmark size={16} /></button>
      {directSkills.length ? <span className="h-5.5 w-px bg-line" aria-hidden="true" /> : null}
      {directSkills.map((skill) => <button key={skill.id} type="button" className={actionButton} disabled={Boolean(runningSkillId)} onClick={() => void runSkill(skill.id)} title={skill.name}>{runningSkillId === skill.id ? <LoaderCircle size={13} className={spinner} /> : <Sparkles size={13} />}<span className="max-w-[94px] truncate">{skill.name}</span></button>)}
      {moreSkills.length ? <OverlayMenu open={moreOpen} onOpenChange={setMoreOpen} placement="bottom-end" ariaLabel="More Selection Skills" menuClassName={menuSurface} trigger={(props) => <button {...props} type="button" className={actionButton}><Sparkles size={13} />More…</button>}>{moreSkills.map((skill) => <button key={skill.id} type="button" role="menuitem" disabled={Boolean(runningSkillId)} onClick={() => void runSkill(skill.id)}>{runningSkillId === skill.id ? <LoaderCircle size={14} className={spinner} /> : <Sparkles size={14} />}{skill.name}</button>)}</OverlayMenu> : null}
    </>}
    {profilePickerOpen && !busy && !textOpen && phase !== "recording" ? <div className={`${profilePopover} left-0`}><VoiceProfilePicker context={profileContext} overrides={profileOverrides} onChange={onProfileOverridesChange} onClose={() => onProfilePickerOpenChange(false)} /></div> : null}
    {error || skillError ? <div className={`${errorBubble} right-0 bottom-[calc(100%+8px)]`} role="alert">{error || skillError}</div> : null}
  </div>;
}
