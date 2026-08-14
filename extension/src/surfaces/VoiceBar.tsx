import { Check, ChevronDown, Mic, Sparkles, Undo2, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { ErrorBubble, IconButton, RecordingDot, Spinner, cn } from "@logue/ui";
import { FloatingBar, type Draggable } from "./FloatingBar";
import { ProfilePicker } from "./ProfilePicker";
import type { Context } from "../api";
import type { VoiceOverrides } from "../overrides";

export type Phase = "idle" | "starting" | "recording" | "working" | "error";

/** The bar must never take focus from the editor it is sitting beside. */
const keepFocus = (event: React.SyntheticEvent) => event.preventDefault();


/**
 * The bar that follows the caret. At rest it is a microphone, a sparkle, and a
 * chevron — three icons, nothing to read. Everything it can do beyond starting
 * a recording is behind that chevron.
 */
/** Seconds as a clock, which is how anyone reads a duration. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceBar({
  phase,
  style,
  error,
  context,
  seconds = 0,
  long = false,
  pending = 0,
  keptCapture,
  onRetry,
  inserted = false,
  onUndo,
  onStart,
  onCommand,
  onStop,
  onCancel,
  onMove,
  onResetPosition,
  moved,
  overrides,
  onOverrides,
}: Draggable & {
  phase: Phase;
  style?: CSSProperties;
  error?: string;
  context?: Context;
  /** How long this recording has run. */
  seconds?: number;
  /** Past a minute. A long recording must not run silently. */
  long?: boolean;
  /** Recordings captured and still settling — the microphone is already free. */
  pending?: number;
  /** A recording the Host kept when the words failed. */
  keptCapture?: string;
  onRetry?: () => void;
  /** Words just landed in the editor, and can still be taken back. */
  inserted?: boolean;
  onUndo?: () => void;
  onStart: () => void;
  onCommand: () => void;
  onStop: () => void;
  onCancel: () => void;

  overrides: VoiceOverrides;
  onOverrides: (value: VoiceOverrides) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <FloatingBar
      label="Logue voice"
      style={style}
      onMove={onMove}
      onResetPosition={onResetPosition}
      moved={moved}
    >

      {/* Said and placed. This lives on the bar rather than in a strip of its
          own: that strip sat over the very words it was reporting, could not
          be moved, and was a second floating thing where one was enough. */}
      {inserted && phase === "idle" ? (
        // Undo, and nothing else. The tick reported something already on
        // screen — the words are in the field, which is the receipt — and the
        // cross existed only to close a bar that existed only to show the
        // tick. Two controls each proving the other was needed.
        <IconButton label="Undo" onPointerDown={keepFocus} onClick={onUndo}>
          <Undo2 size={14} />
        </IconButton>
      ) : phase === "recording" ? (
        <>
          {/*
            The tick takes the microphone's own slot, so the pointer that just
            pressed record is already on the control that ends it. It used to
            sit at the far right behind the clock, which made every recording
            end with a sideways journey across the bar.
          */}
          <IconButton
            label="Transcribe and insert (Enter)"
            variant="primary"
            onPointerDown={keepFocus}
            onClick={onStop}
          >
            <Check size={15} />
          </IconButton>
          <IconButton label="Cancel (Esc)" onPointerDown={keepFocus} onClick={onCancel}>
            <X size={14} />
          </IconButton>
          <RecordingDot className="mx-1" />
          {/* The clock, because ten minutes of speech and ten seconds of it
              look identical on a bar that only shows a dot. Past a minute it
              also says what the end will be, so nobody discovers the ceiling
              by hitting it. */}
          <span
            role="timer"
            aria-label={`Recording, ${seconds} seconds`}
            className={cn("mr-1.5 font-mono text-xs tabular-nums", long ? "text-warning" : "text-muted")}
          >
            {clock(seconds)}
          </span>
          {long && <span className="mr-1.5 text-xs text-muted">stops at 10:00</span>}
        </>
      ) : phase === "starting" || phase === "working" ? (
        <>
          <Spinner className="mx-1 text-muted" />
          <span className="pr-1 text-xs text-muted" role="status">
            {phase === "starting" ? "Starting mic…" : "Transcribing…"}
          </span>
          <IconButton label="Cancel" onPointerDown={keepFocus} onClick={onCancel}>
            <X size={14} />
          </IconButton>
        </>
      ) : (
        <>
          <IconButton
            label={error ? "Try voice again" : `Voice · ${context?.voice_profile.label ?? "Default voice"}`}
            className="text-accent hover:bg-accent-soft hover:text-accent-hover"
            onPointerDown={keepFocus}
            onClick={onStart}
          >
            <Mic size={15} />
          </IconButton>
          <IconButton label="Ask Logue" onPointerDown={keepFocus} onClick={onCommand}>
            <Sparkles size={14} />
          </IconButton>
          {pending > 0 && (
            <span
              role="status"
              title={`${pending} recording${pending === 1 ? "" : "s"} still transcribing — you can keep going`}
              className="mr-0.5 inline-flex items-center gap-1 text-xs text-muted"
            >
              <Spinner size={11} />
              {pending}
            </span>
          )}
          <IconButton
            label="Voice options"
            aria-expanded={pickerOpen}
            className="w-4.5 min-w-4.5 text-muted"
            onPointerDown={keepFocus}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <ChevronDown size={12} />
          </IconButton>
        </>
      )}

      {pickerOpen && phase === "idle" && (
        <div className="logue-float absolute right-0 bottom-[calc(100%+6px)] z-popover w-[280px] p-2.5">
          <ProfilePicker context={context} overrides={overrides} onChange={onOverrides} />
        </div>
      )}

      {/* The shared bubble, not a hand-typed one — same failure, same shape,
          wherever it happens. */}
      {error && (
        <ErrorBubble className="right-0 bottom-[calc(100%+6px)]">
          {error}
          {keptCapture && onRetry && (
            <button
              type="button"
              onPointerDown={keepFocus}
              onClick={onRetry}
              className="mt-1 block rounded-md font-[560] underline decoration-danger-line underline-offset-2 hover:text-ink"
            >
              Try again on the kept recording
            </button>
          )}
        </ErrorBubble>
      )}
    </FloatingBar>
  );
}
