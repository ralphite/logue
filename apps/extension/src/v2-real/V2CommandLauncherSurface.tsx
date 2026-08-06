import { ChevronDown, Mic, Send, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";

export type CommandLauncherPhase =
  | "editing"
  | "starting"
  | "recording"
  | "transcribing"
  | "running";

export interface V2CommandLauncherSurfaceProps {
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

export function V2CommandLauncherSurface({
  phase,
  instruction,
  project,
  scope,
  selectionAvailable,
  projects,
  scopeLabel,
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
}: V2CommandLauncherSurfaceProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = phase !== "editing";

  useEffect(() => {
    if (phase === "editing") inputRef.current?.focus({ preventScroll: true });
  }, [phase]);

  return (
    <section className="v2-command-launcher" style={style} role="dialog" aria-label="Logue Voice Command">
      <header className="v2-command-header">
        <div>
          <strong>Ask Logue</strong>
          <span>{scopeLabel} · {targetLabel}</span>
        </div>
        <button type="button" className="v2-command-icon" aria-label={phase === "running" ? "Cancel Voice Command Run" : "Close Voice Command"} onClick={onClose}>
          <X size={15} />
        </button>
      </header>

      {phase === "recording" || phase === "starting" ? (
        <div className="v2-command-recording" role="status">
          <span className="v2-command-live-dot" />
          <span>{phase === "starting" ? "Starting microphone…" : "Listening…"}</span>
          {phase === "recording" ? (
            <><button type="button" className="v2-command-icon v2-command-keyboard" onClick={onCancelVoice}>Type</button><button type="button" className="v2-command-primary" onClick={onStopVoice} aria-keyshortcuts="Enter"><Square size={12} fill="currentColor" /> Run</button></>
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
          placeholder="What should Logue do?"
          aria-label="Voice Command instruction"
          disabled={busy}
        />
      )}

      <div className="v2-command-context">
        <label>
          <span className="sr-only">Scope</span>
          <select value={scope} onChange={(event) => onScopeChange(event.target.value as "selection" | "page" | "project")} disabled={busy}>
            {selectionAvailable ? <option value="selection">Selection</option> : null}
            <option value="page">Page</option>
            <option value="project">Project</option>
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </label>
        <label>
          <span className="sr-only">Project</span>
          <select value={project} onChange={(event) => onProjectChange(event.target.value)} disabled={busy}>
            <option value="">Choose Project</option>
            {projects.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </label>
        <span className="v2-command-spacer" />
        {phase === "editing" ? (
          <>
            <button type="button" className="v2-command-icon" aria-label="Speak Voice Command" onClick={onStartVoice}>
              <Mic size={16} />
            </button>
            <button type="button" className="v2-command-primary" onClick={onSubmit} disabled={!instruction.trim() || (scope === "project" && !project)} aria-label="Run Voice Command">
              <Send size={14} /> Run
            </button>
          </>
        ) : phase === "transcribing" || phase === "running" ? (
          <><span className="v2-command-progress" role="status">{phase === "transcribing" ? "Transcribing…" : "Working…"}</span>{phase === "running" ? <button type="button" className="v2-command-icon v2-command-keyboard" onClick={onClose}>Cancel</button> : null}</>
        ) : null}
      </div>
      {scope === "project" && !project && phase === "editing" ? <p className="v2-command-hint">Choose the Project whose Sources Logue should use.</p> : null}
      {error ? <div className="v2-command-error" role="alert"><span>{error}</span><span className="v2-command-error-actions">{onSwitchToVoiceWrite ? <button type="button" onClick={onSwitchToVoiceWrite}>Voice Write</button> : null}{onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}</span></div> : null}
    </section>
  );
}
