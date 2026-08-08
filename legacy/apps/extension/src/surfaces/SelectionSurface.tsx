import { Bookmark, ChevronDown, CornerDownLeft, LoaderCircle, MessageSquarePlus, Mic, MoreHorizontal, Sparkles, X } from "lucide-react";
import { OverlayMenu, ProductStatus } from "@logue/ui";
import { useState, type CSSProperties, type SyntheticEvent } from "react";
import type { CaptureContext, VoiceProfileOverrides } from "../voiceProfileModels";
import { VoiceProfilePicker } from "../VoiceProfilePicker";
import { actionButton, closeButton, cornerClose, disclosureButton, errorBubble, iconButton, menuSurface, primaryAction, profilePopover, recordingDot, spinner } from "./surfaceStyles";

export type SelectionCommentPhase = "ready" | "starting" | "recording" | "committing" | "error";

interface SelectionSkillOption {
  id: string;
  name: string;
}

/**
 * The toolbar over a text selection: capture it, annotate it, or run a Skill
 * on it. Icons with tooltips, one divider, overflow behind "…" — the shape of
 * an editor's selection toolbar, because that is what it is.
 */
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

  return <div
    className={`fixed z-surface flex items-center gap-0.5 rounded-[10px] bg-white p-0.5 text-ink shadow-[0_0_0_1px_rgb(15_15_15/6%),0_3px_6px_rgb(15_15_15/8%),0_9px_24px_rgb(15_15_15/12%)] ${textOpen ? "w-[min(320px,calc(100vw-16px))] items-stretch" : "h-8 max-w-[calc(100vw-16px)]"}`}
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
    {textOpen ? <div className="relative w-full p-1.5">
      <button type="button" className={`${closeButton} ${cornerClose}`} aria-label="Cancel text comment" onClick={onCancel}><X size={14} /></button>
      <textarea autoFocus value={textValue} onChange={(event) => onTextChange(event.target.value)} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); onCancel(); }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); onTextSave(); }
      }} className="block min-h-16 w-full resize-y border-0 bg-transparent py-1 pr-7 pl-1 text-[13px] leading-[1.5] text-ink outline-0" placeholder="Comment on this selection…" aria-label="Text comment" />
      <div className="flex justify-end pt-0.5">
        <button type="button" className={`${actionButton} ${primaryAction}`} disabled={!textValue.trim() || textSaving} onClick={onTextSave} aria-keyshortcuts="Meta+Enter" title="Add comment (⌘↵)">{textSaving ? <LoaderCircle className={spinner} size={13} /> : <CornerDownLeft size={13} />}Add</button>
      </div>
    </div> : phase === "recording" ? <>
      <span className={recordingDot} role="status" aria-label="Recording" />
      <button type="button" className={`${actionButton} ${primaryAction}`} aria-keyshortcuts="Enter" title="Accept (Enter)" onClick={onAccept}>Accept <kbd>↵</kbd></button>
      <button type="button" className={iconButton} aria-label="Cancel voice comment" aria-keyshortcuts="Escape" title="Cancel (Esc)" onClick={onCancel}><X size={14} /></button>
    </> : busy ? <>
      <LoaderCircle className={`${spinner} mx-1 text-muted`} size={14} />
      <span className="min-w-0 flex-1 pr-1 text-xs text-muted" role="status">{phase === "starting" ? "Starting mic…" : "Saving…"}</span>
      {phase === "starting" ? <button type="button" className={iconButton} aria-label="Cancel" onClick={onCancel}><X size={14} /></button> : null}
    </> : <>
      <button type="button" className={`${iconButton} text-accent hover:bg-accent-soft hover:text-accent-hover`} aria-label={phase === "error" ? "Retry voice comment" : "Add voice comment"} title={phase === "error" ? "Retry voice comment" : `Voice comment · ${profileLabel}`} onClick={onStart}><Mic size={15} /></button>
      <button type="button" className={disclosureButton} aria-expanded={profilePickerOpen} aria-label={`Voice profile: ${profileLabel}`} title={`Voice profile · ${profileLabel}`} onClick={() => onProfilePickerOpenChange(!profilePickerOpen)}><ChevronDown size={12} /></button>
      <button type="button" className={iconButton} aria-label="Write comment" title="Write comment" onClick={onTextOpen}><MessageSquarePlus size={15} /></button>
      <button type="button" className={iconButton} aria-label="Save selection" title="Save selection" onClick={onSaveSelection}><Bookmark size={15} /></button>
      {directSkills.length ? <span className="mx-0.5 h-4.5 w-px bg-line" aria-hidden="true" /> : null}
      {directSkills.map((skill) => <button key={skill.id} type="button" className={actionButton} disabled={Boolean(runningSkillId)} onClick={() => void runSkill(skill.id)} title={skill.name}>{runningSkillId === skill.id ? <LoaderCircle size={12} className={spinner} /> : <Sparkles size={12} />}<span className="max-w-20 truncate">{skill.name}</span></button>)}
      {moreSkills.length ? <OverlayMenu open={moreOpen} onOpenChange={setMoreOpen} placement="bottom-end" ariaLabel="More Selection Skills" menuClassName={menuSurface} trigger={(props) => <button {...props} type="button" className={iconButton} title="More Skills"><MoreHorizontal size={15} /></button>}>{moreSkills.map((skill) => <button key={skill.id} type="button" role="menuitem" disabled={Boolean(runningSkillId)} onClick={() => void runSkill(skill.id)}>{runningSkillId === skill.id ? <LoaderCircle size={13} className={spinner} /> : <Sparkles size={13} />}{skill.name}</button>)}</OverlayMenu> : null}
    </>}
    {profilePickerOpen && !busy && !textOpen && phase !== "recording" ? <div className={`${profilePopover} left-0`}><VoiceProfilePicker context={profileContext} overrides={profileOverrides} onChange={onProfileOverridesChange} onClose={() => onProfilePickerOpenChange(false)} /></div> : null}
    {error || skillError ? <div className={`${errorBubble} right-0 bottom-[calc(100%+6px)]`} role="alert">{error || skillError}</div> : null}
  </div>;
}
