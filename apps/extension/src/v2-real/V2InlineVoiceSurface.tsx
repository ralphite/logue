import { Check, ChevronDown, LoaderCircle, Mic, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { CaptureContext, VoiceProfileOverrides } from "../voiceProfileModels";
import { VoiceProfilePicker } from "../VoiceProfilePicker";

export type InlineVoicePhase = "idle" | "starting" | "recording" | "processing" | "error";

export function V2InlineVoiceSurface({
  phase,
  onStart,
  onStartCommand,
  onCancel,
  onStopAndInsert,
  error,
  pendingCopyText,
  onCopy,
  errorPlacement = { vertical: "above", horizontal: "right" },
  style,
  profileContext,
  profileOverrides = {},
  profilePickerOpen = false,
  onProfileOverridesChange = () => undefined,
  onProfilePickerOpenChange = () => undefined,
}: {
  phase: InlineVoicePhase;
  onStart: () => void;
  onStartCommand?: () => void;
  onCancel: () => void;
  onStopAndInsert: () => void;
  error?: string;
  pendingCopyText?: string;
  onCopy?: () => void;
  errorPlacement?: { vertical: "above" | "below"; horizontal: "left" | "right" };
  style?: CSSProperties;
  profileContext?: CaptureContext;
  profileOverrides?: VoiceProfileOverrides;
  profilePickerOpen?: boolean;
  onProfileOverridesChange?: (value: VoiceProfileOverrides) => void;
  onProfilePickerOpenChange?: (value: boolean) => void;
}) {
  const captureActive = phase === "starting" || phase === "recording" || phase === "processing";
  const profileLabel = profileContext?.resolved_voice_profile.label || "Default voice";
  return <div className={`v2-inline-voice is-${phase}`} style={style} role="group" aria-label="Logue voice input">
    {phase === "recording" ? <>
      <span className="v2-selection-recording" role="status"><span />Recording</span>
      <button type="button" className="v2-inline-action is-primary" aria-label="Stop voice input" aria-keyshortcuts="Enter" title="Accept (Enter)" onPointerDown={(event) => event.preventDefault()} onClick={onStopAndInsert}><Check size={15} />Accept <kbd>↵</kbd></button>
      <button type="button" className="v2-inline-action" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={onCancel}><X size={14} />Cancel</button>
    </> : captureActive ? <>
      <LoaderCircle size={15} className="v2-inline-spinner" />
      <span className="v2-inline-busy" role="status">{phase === "starting" ? "Starting microphone…" : "Transcribing…"}</span>
      <button type="button" className="v2-inline-action" onPointerDown={(event) => event.preventDefault()} onClick={onCancel}>Cancel</button>
    </> : <>
      <button type="button" className="v2-inline-mic" aria-label="Start voice input" title={phase === "error" ? "Try voice input again" : `Voice write · ${profileLabel}`} onPointerDown={(event) => event.preventDefault()} onClick={onStart}><Mic size={16} /></button>
      {onStartCommand ? <button type="button" className="v2-inline-command" aria-label="Start voice command" title="Voice command" onPointerDown={(event) => event.preventDefault()} onClick={onStartCommand}><Sparkles size={15} /></button> : null}
      <button type="button" className="v2-inline-profile" aria-expanded={profilePickerOpen} aria-label={`Voice profile: ${profileLabel}`} onPointerDown={(event) => event.preventDefault()} onClick={() => onProfilePickerOpenChange(!profilePickerOpen)}><span>{profileLabel}</span><ChevronDown size={11} /></button>
    </>}
    {profilePickerOpen && !captureActive ? <div className="v2-inline-profile-popover"><VoiceProfilePicker context={profileContext} overrides={profileOverrides} onChange={onProfileOverridesChange} onClose={() => onProfilePickerOpenChange(false)} /></div> : null}
    {error ? <div className={`v2-inline-error is-${errorPlacement.vertical} is-${errorPlacement.horizontal}`} role="alert"><span>{error}</span>{pendingCopyText && onCopy ? <button type="button" onClick={onCopy}>Copy saved text</button> : null}</div> : null}
  </div>;
}
