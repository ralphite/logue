import { ChevronDown, Mic, Send, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { commandIcon, commandPrimary, commandSelect, errorAction, floatingPanel } from "./surfaceStyles";

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
    <section className={`${floatingPanel} w-[min(420px,calc(100vw-16px))]`} style={style} role="dialog" aria-label="Logue Voice Command">
      <header className="flex min-h-11.5 items-center gap-2.5 border-b border-line py-[7px] pr-2 pl-[13px]">
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[13px] font-[650]">Ask Logue</strong>
          <span className="mt-0.5 block truncate text-[11px] text-muted">{scopeLabel} · {targetLabel}</span>
        </div>
        <button type="button" className={commandIcon} aria-label={phase === "running" ? "Cancel Voice Command Run" : "Close Voice Command"} onClick={onClose}>
          <X size={15} />
        </button>
      </header>

      {phase === "recording" || phase === "starting" ? (
        <div className="flex min-h-23 items-center gap-2 px-[13px] py-3 text-[13px] text-ink-soft" role="status">
          <span className="size-2 animate-[logue-recording-pulse_1.4s_ease-in-out_infinite] rounded-full bg-danger" />
          <span>{phase === "starting" ? "Starting microphone…" : "Listening…"}</span>
          {phase === "recording" ? (
            <><button type="button" className={`${commandIcon} w-auto px-2`} onClick={onCancelVoice}>Type</button><button type="button" className={`${commandPrimary} ml-auto`} onClick={onStopVoice} aria-keyshortcuts="Enter"><Square size={12} fill="currentColor" /> Run</button></>
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
          className="block max-h-45 min-h-23 w-full resize-y border-0 bg-transparent px-[13px] py-3 text-sm leading-[1.55] text-ink outline-0"
          aria-label="Voice Command instruction"
          disabled={busy}
        />
      )}

      <div className="flex min-h-11 items-center gap-[5px] border-t border-line px-[7px] py-[5px]">
        <label className={commandSelect}>
          <span className="sr-only">Scope</span>
          <select value={scope} onChange={(event) => onScopeChange(event.target.value as "selection" | "page" | "project")} disabled={busy}>
            {selectionAvailable ? <option value="selection">Selection</option> : null}
            <option value="page">Page</option>
            <option value="project">Project</option>
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </label>
        <label className={commandSelect}>
          <span className="sr-only">Project</span>
          <select value={project} onChange={(event) => onProjectChange(event.target.value)} disabled={busy}>
            <option value="">Choose Project</option>
            {projects.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </label>
        <span className="flex-1" />
        {phase === "editing" ? (
          <>
            <button type="button" className={commandIcon} aria-label="Speak Voice Command" onClick={onStartVoice}>
              <Mic size={16} />
            </button>
            <button type="button" className={commandPrimary} onClick={onSubmit} disabled={!instruction.trim() || (scope === "project" && !project)} aria-label="Run Voice Command">
              <Send size={14} /> Run
            </button>
          </>
        ) : phase === "transcribing" || phase === "running" ? (
          <><span className="px-[7px] text-xs text-muted" role="status">{phase === "transcribing" ? "Transcribing…" : "Working…"}</span>{phase === "running" ? <button type="button" className={`${commandIcon} w-auto px-2`} onClick={onClose}>Cancel</button> : null}</>
        ) : null}
      </div>
      {scope === "project" && !project && phase === "editing" ? <p className="border-t border-line px-[13px] py-2 text-[11px] leading-[1.4] text-muted">Choose the Project whose Sources Logue should use.</p> : null}
      {error ? <div className="flex items-center justify-between gap-2.5 border-t border-line px-[13px] py-2 text-[11px] leading-[1.4] text-danger" role="alert"><span>{error}</span><span className="inline-flex flex-none gap-2">{onSwitchToVoiceWrite ? <button type="button" className={errorAction} onClick={onSwitchToVoiceWrite}>Voice Write</button> : null}{onRetry ? <button type="button" className={errorAction} onClick={onRetry}>Retry</button> : null}</span></div> : null}
    </section>
  );
}
