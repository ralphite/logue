import { ChevronDown, Mic, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { actionButton, barSelect, closeButton, cornerClose, errorAction, floatingPanel, iconButton, primaryAction, recordingDot } from "./surfaceStyles";

export type CommandLauncherPhase =
  | "editing"
  | "starting"
  | "recording"
  | "transcribing"
  | "running";

export interface CommandLauncherSurfaceProps {
  phase: CommandLauncherPhase;
  instruction: string;
  project: string;
  scope: "selection" | "page" | "project";
  selectionAvailable: boolean;
  projects: string[];
  scopeLabel: string;
  targetLabel: string;
  error?: string;
  style?: { top?: number; left?: number };
  onInstructionChange(value: string): void;
  onProjectChange(value: string): void;
  onScopeChange(value: "selection" | "page" | "project"): void;
  onSubmit(): void;
  onStartVoice(): void;
  onStopVoice(): void;
  onCancelVoice(): void;
  onRetry?(): void;
  onSwitchToVoiceWrite?(): void;
  onClose(): void;
}

/**
 * An instruction box, like an editor's AI prompt: type or speak, pick what it
 * runs against in the footer, one Run. No header — the placeholder says what
 * this is, and the scope selects say what it will read.
 */
export function CommandLauncherSurface({
  phase,
  instruction,
  project,
  scope,
  selectionAvailable,
  projects,
  targetLabel,
  error,
  style,
  onInstructionChange,
  onProjectChange,
  onScopeChange,
  onSubmit,
  onStartVoice,
  onStopVoice,
  onCancelVoice,
  onRetry,
  onSwitchToVoiceWrite,
  onClose,
}: CommandLauncherSurfaceProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = phase !== "editing";

  useEffect(() => {
    if (phase === "editing") inputRef.current?.focus({ preventScroll: true });
  }, [phase]);

  return (
    <section className={`${floatingPanel} w-[min(360px,calc(100vw-16px))]`} style={style} role="dialog" aria-label="Logue Voice Command">
      <button type="button" className={`${closeButton} ${cornerClose}`} aria-label={phase === "running" ? "Cancel Voice Command Run" : "Close Voice Command"} onClick={onClose}>
        <X size={14} />
      </button>

      {phase === "recording" || phase === "starting" ? (
        <div className="flex min-h-16 items-center px-2.5 py-2 text-[13px] text-ink-soft" role="status">
          <span className={recordingDot} />
          <span className="flex-1">{phase === "starting" ? "Starting mic…" : "Listening…"}</span>
          {phase === "recording" ? (
            <span className="mr-6 inline-flex gap-0.5">
              <button type="button" className={actionButton} onClick={onCancelVoice}>Type</button>
              <button type="button" className={`${actionButton} ${primaryAction}`} onClick={onStopVoice} aria-keyshortcuts="Enter"><Square size={11} fill="currentColor" /> Run</button>
            </span>
          ) : null}
        </div>
      ) : (
        <textarea
          ref={inputRef}
          value={instruction}
          onChange={(event) => onInstructionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !busy) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={`Ask about ${targetLabel || "this page"}…`}
          className="block max-h-40 min-h-16 w-full resize-y border-0 bg-transparent py-2 pr-8 pl-2.5 text-[13px] leading-[1.5] text-ink outline-0"
          aria-label="Voice Command instruction"
          disabled={busy}
        />
      )}

      <div className="flex h-9 items-center gap-0.5 border-t border-line p-1">
        <label className={barSelect}>
          <span className="sr-only">Scope</span>
          <select value={scope} onChange={(event) => onScopeChange(event.target.value as "selection" | "page" | "project")} disabled={busy}>
            {selectionAvailable ? <option value="selection">Selection</option> : null}
            <option value="page">Page</option>
            <option value="project">Project</option>
          </select>
          <ChevronDown aria-hidden="true" size={12} />
        </label>
        <label className={barSelect}>
          <span className="sr-only">Project</span>
          <select value={project} onChange={(event) => onProjectChange(event.target.value)} disabled={busy}>
            <option value="">Project…</option>
            {projects.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={12} />
        </label>
        <span className="flex-1" />
        {phase === "editing" ? (
          <>
            <button type="button" className={iconButton} aria-label="Speak Voice Command" onClick={onStartVoice}>
              <Mic size={15} />
            </button>
            <button type="button" className={`${actionButton} ${primaryAction}`} onClick={onSubmit} disabled={!instruction.trim() || (scope === "project" && !project)} aria-label="Run Voice Command">
              Run <kbd>↵</kbd>
            </button>
          </>
        ) : phase === "transcribing" || phase === "running" ? (
          <>
            <span className="px-1.5 text-xs text-muted" role="status">{phase === "transcribing" ? "Transcribing…" : "Working…"}</span>
            {phase === "running" ? <button type="button" className={actionButton} onClick={onClose}>Cancel</button> : null}
          </>
        ) : null}
      </div>
      {error ? <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5 text-[11px] leading-[1.4] text-danger" role="alert"><span>{error}</span><span className="inline-flex flex-none gap-1.5">{onSwitchToVoiceWrite ? <button type="button" className={errorAction} onClick={onSwitchToVoiceWrite}>Voice Write</button> : null}{onRetry ? <button type="button" className={errorAction} onClick={onRetry}>Retry</button> : null}</span></div> : null}
    </section>
  );
}
