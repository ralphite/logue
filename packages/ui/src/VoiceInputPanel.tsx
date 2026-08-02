import { AlertCircle, CircleStop, Copy, LoaderCircle, RotateCcw, X } from "lucide-react";

export type VoiceInputPhase = "starting" | "recording" | "processing" | "error";
export type VoiceInputErrorKind = "transcription" | "microphone" | "save" | "target";

export interface VoiceInputPanelProps {
  phase: VoiceInputPhase;
  elapsedSeconds?: number;
  errorMessage?: string;
  errorKind?: VoiceInputErrorKind;
  onStopAndInsert: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onCopy?: () => void;
}

function formatDuration(value = 0) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function Waveform() {
  return (
    <span className="flex h-7 items-center gap-[3px]" aria-hidden="true">
      {[8, 14, 20, 12, 18, 10, 16, 7, 13].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="logue-wave block w-[3px] rounded-full bg-current motion-reduce:animate-none"
          style={{ height, animationDelay: `${index * 70}ms` }}
        />
      ))}
    </span>
  );
}

function errorTitle(kind: VoiceInputErrorKind) {
  if (kind === "target") return "Input field unavailable";
  if (kind === "save") return "Not saved yet";
  if (kind === "microphone") return "Could not start recording";
  return "Transcription failed";
}

export function VoiceInputPanel({
  phase,
  elapsedSeconds,
  errorMessage,
  errorKind = "transcription",
  onStopAndInsert,
  onCancel,
  onRetry,
  onCopy,
}: VoiceInputPanelProps) {
  if (phase === "recording") {
    return (
      <aside className="w-full bg-white p-3 text-[#242522]" aria-label="Logue voice input">
        <div className="flex items-center justify-between rounded-lg bg-[#fff4f1] px-4 py-3.5 text-[#cc493d]" role="status">
          <span className="flex items-center gap-3">
            <span className="relative flex size-9 items-center justify-center rounded-full bg-white">
              <span className="absolute size-3 animate-ping rounded-full bg-[#e44c3f]/35 motion-reduce:animate-none" />
              <span className="relative size-3 rounded-full bg-[#e44c3f]" />
            </span>
            <span>
              <span className="block text-[12.5px] font-semibold">Recording</span>
              <span className="mt-0.5 block font-mono text-[11px] text-[#a75a52]">{formatDuration(elapsedSeconds)}</span>
            </span>
          </span>
          <Waveform />
        </div>
        <div className="mt-3 grid grid-cols-[1fr_1.45fr] gap-2">
          <button type="button" onClick={onCancel} aria-keyshortcuts="Escape" title="Cancel recording (Esc)" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#deded9] text-[11px] font-medium text-[#6b6c67] hover:bg-[#f6f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]">
            <X size={13} /> Cancel <kbd className="ml-0.5 text-[9px] font-normal text-[#a0a19c]">Esc</kbd>
          </button>
          <button type="button" onClick={onStopAndInsert} aria-keyshortcuts="Enter" title="Stop and insert (Enter)" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#d94b3f] text-[11px] font-medium text-white hover:bg-[#c84237] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d94b3f]">
            <CircleStop size={13} /> Stop and insert <kbd className="ml-0.5 text-[9px] font-normal text-white/70">↵</kbd>
          </button>
        </div>
      </aside>
    );
  }

  if (phase === "starting" || phase === "processing") {
    return (
      <aside className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-[#242522]" aria-label="Logue voice input" aria-live="polite">
        <LoaderCircle size={18} className="shrink-0 animate-spin text-[#5b64f4] motion-reduce:animate-none" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#454642]">{phase === "starting" ? "Starting microphone…" : "Transcribing and inserting…"}</p>
          {phase === "processing" && <p className="mt-0.5 text-[10px] text-[#92938e]">Automatically saved to Stream when complete</p>}
        </div>
        {phase === "starting" && (
          <button type="button" onClick={onCancel} aria-keyshortcuts="Escape" title="Cancel (Esc)" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[10.5px] font-medium text-[#6b6c67] hover:bg-[#f3f3ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]">
            Cancel <kbd className="text-[9px] font-normal text-[#a0a19c]">Esc</kbd>
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-full bg-white p-3 text-[#242522]" aria-label="Logue voice input">
      <div className="rounded-md bg-[#fbefec] p-3">
        <div className="flex gap-2.5 text-[#a9473e]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[11.5px] font-semibold">{errorTitle(errorKind)}</p>
            <p className="mt-0.5 text-[10.5px] leading-4 text-[#8d625d]">{errorMessage || "Your recording is preserved. Try again."}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-1.5">
          {errorKind === "target" && onCopy && (
            <button type="button" onClick={onCopy} className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[10.5px] text-[#696a65] hover:bg-white/60">
              <Copy size={12} /> Copy text
            </button>
          )}
          <button type="button" onClick={onCancel} className="h-8 rounded-md px-2.5 text-[10.5px] text-[#855d58] hover:bg-white/60">Cancel</button>
          <button type="button" onClick={onRetry} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#242522] px-3 text-[10.5px] font-medium text-white">
            <RotateCcw size={12} /> {errorKind === "target" ? "Insert again" : errorKind === "microphone" ? "Record again" : "Retry"}
          </button>
        </div>
      </div>
    </aside>
  );
}
