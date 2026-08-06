import { AudioLines, Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { CaptureContext, VoiceProfileOverrides } from "./voiceProfileModels";
import { VoiceProfilePicker } from "./VoiceProfilePicker";

export type SelectionCommentPhase = "ready" | "starting" | "recording" | "committing" | "error";

export function SelectionVoiceControls({
  phase,
  style,
  error,
  onStart,
  onAccept,
  onCancel,
  profileContext,
  profileOverrides = {},
  profilePickerOpen = false,
  onProfileOverridesChange = () => undefined,
  onProfilePickerOpenChange = () => undefined,
}: {
  phase: SelectionCommentPhase;
  style?: CSSProperties;
  error?: string;
  onStart: () => void;
  onAccept: () => void;
  onCancel: () => void;
  profileContext?: CaptureContext;
  profileOverrides?: VoiceProfileOverrides;
  profilePickerOpen?: boolean;
  onProfileOverridesChange?: (value: VoiceProfileOverrides) => void;
  onProfilePickerOpenChange?: (value: boolean) => void;
}) {
  const busy = phase === "starting" || phase === "committing";
  return (
    <div
      className={`logue-selection-voice is-${phase}`}
      style={style}
      role="group"
      aria-label="Voice comment"
    >
      {phase === "recording" ? <>
        <button
          type="button"
          className="logue-selection-voice-button is-cancel"
          aria-label="Cancel voice comment"
          aria-keyshortcuts="Escape"
          title="Cancel (Esc)"
          onPointerDown={(event) => event.preventDefault()}
          onClick={onCancel}
        ><X size={17} /></button>
        <button
          type="button"
          className="logue-selection-voice-button is-accept"
          aria-label="Accept voice comment"
          aria-keyshortcuts="Enter"
          title="Accept (Enter)"
          onPointerDown={(event) => event.preventDefault()}
          onClick={onAccept}
        ><Check size={18} strokeWidth={2.3} /></button>
      </> : busy ? <>
        {phase === "starting" && <button
          type="button"
          className="logue-selection-voice-button is-cancel"
          aria-label="Cancel voice comment"
          aria-keyshortcuts="Escape"
          title="Cancel (Esc)"
          onPointerDown={(event) => event.preventDefault()}
          onClick={onCancel}
        ><X size={17} /></button>}
        <span className="logue-selection-voice-status" role="status" aria-label={phase === "starting" ? "Starting microphone" : "Saving voice comment"}>
          <LoaderCircle size={17} className="logue-inline-spinner" />
        </span>
      </> : <button
        type="button"
        className="logue-selection-voice-button is-mic"
        aria-label={phase === "error" ? "Try voice comment again" : "Add voice comment"}
        title={phase === "error" ? "Try voice comment again" : "Add voice comment"}
        onPointerDown={(event) => event.preventDefault()}
        onClick={onStart}
      ><AudioLines size={17} strokeWidth={2.1} /></button>}
      {!busy && phase !== "recording" && <button type="button" className="logue-profile-trigger" aria-expanded={profilePickerOpen} onPointerDown={(event) => event.preventDefault()} onClick={() => onProfilePickerOpenChange(!profilePickerOpen)} title={profileContext?.resolved_voice_profile.label || "Default voice profile"}><span>{profileContext?.resolved_voice_profile.label || "Default"}</span><ChevronDown size={12} /></button>}
      {profilePickerOpen && !busy && phase !== "recording" && <VoiceProfilePicker context={profileContext} overrides={profileOverrides} onChange={onProfileOverridesChange} onClose={() => onProfilePickerOpenChange(false)} />}
      {error && <div className="logue-selection-voice-error" role="alert">{error}</div>}
    </div>
  );
}
