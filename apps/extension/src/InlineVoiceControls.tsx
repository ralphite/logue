import { AudioLines, Check, LoaderCircle, X } from "lucide-react";
import type { CSSProperties } from "react";

export type InlineVoicePhase = "idle" | "starting" | "recording" | "processing" | "error";

export function InlineVoiceControls({
  phase,
  onStart,
  onCancel,
  onStopAndInsert,
  error,
  pendingCopyText,
  onCopy,
  errorPlacement = { vertical: "above", horizontal: "right" },
  style,
}: {
  phase: InlineVoicePhase;
  onStart: () => void;
  onCancel: () => void;
  onStopAndInsert: () => void;
  error?: string;
  pendingCopyText?: string;
  onCopy?: () => void;
  errorPlacement?: { vertical: "above" | "below"; horizontal: "left" | "right" };
  style?: CSSProperties;
}) {
  const captureActive = phase === "starting" || phase === "recording" || phase === "processing";

  return (
    <div
      className={`logue-launcher-group is-${phase}${captureActive ? " is-capturing" : ""}`}
      style={style}
      role="group"
      aria-label="Logue voice input"
    >
      {phase === "recording" ? <>
        <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={onCancel}><X size={17} /></button>
        <button type="button" className="logue-launcher logue-inline-accept" aria-label="Stop and insert voice input" aria-keyshortcuts="Enter" title="Stop and insert (Enter)" onPointerDown={(event) => event.preventDefault()} onClick={onStopAndInsert}><Check size={18} strokeWidth={2.3} /></button>
      </> : captureActive ? <>
        <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={onCancel}><X size={17} /></button>
        <span className="logue-inline-status" role="status" aria-label={phase === "starting" ? "Starting microphone" : "Transcribing and inserting"}><LoaderCircle size={17} className="logue-inline-spinner" /></span>
      </> : <button
        type="button"
        className="logue-launcher logue-launcher-voice"
        aria-label="Start voice input"
        title={phase === "error" ? "Try voice input again" : "Start voice input"}
        onPointerDown={(event) => event.preventDefault()}
        onClick={onStart}
      >
        <AudioLines size={17} strokeWidth={2.1} />
      </button>}
      {error && <div className={`logue-launcher-error is-${errorPlacement.vertical} is-${errorPlacement.horizontal}`} role="alert"><span>{error}</span>{pendingCopyText && onCopy && <button type="button" onClick={onCopy}>Copy</button>}</div>}
    </div>
  );
}
