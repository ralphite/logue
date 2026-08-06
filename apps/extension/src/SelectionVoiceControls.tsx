import { AudioLines, Check, LoaderCircle, X } from "lucide-react";
import type { CSSProperties } from "react";

export type SelectionCommentPhase = "ready" | "starting" | "recording" | "committing" | "error";

export function SelectionVoiceControls({
  phase,
  style,
  error,
  onStart,
  onAccept,
  onCancel,
}: {
  phase: SelectionCommentPhase;
  style?: CSSProperties;
  error?: string;
  onStart: () => void;
  onAccept: () => void;
  onCancel: () => void;
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
      {error && <div className="logue-selection-voice-error" role="alert">{error}</div>}
    </div>
  );
}
