import { ChevronDown, GripVertical, Mic, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Button, IconButton, RecordingDot, Spinner, cn } from "@logue/ui";
import { ProfilePicker } from "./ProfilePicker";
import type { Context } from "../api";
import type { VoiceOverrides } from "../overrides";

export type Phase = "idle" | "starting" | "recording" | "working" | "error";

/** The bar must never take focus from the editor it is sitting beside. */
const keepFocus = (event: React.SyntheticEvent) => event.preventDefault();

const NUDGE = 12;
const NUDGE_FAR = 48;

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
  keptCapture,
  onRetry,
  onStart,
  onCommand,
  onStop,
  onCancel,
  onMove,
  onResetPosition,
  moved,
  overrides,
  onOverrides,
}: {
  phase: Phase;
  style?: CSSProperties;
  error?: string;
  context?: Context;
  /** How long this recording has run. */
  seconds?: number;
  /** Past a minute. A long recording must not run silently. */
  long?: boolean;
  /** A recording the Host kept when the words failed. */
  keptCapture?: string;
  onRetry?: () => void;
  onStart: () => void;
  onCommand: () => void;
  onStop: () => void;
  onCancel: () => void;
  onMove?: (point: { left: number; top: number }) => void;
  onResetPosition?: () => void;
  moved?: boolean;
  overrides: VoiceOverrides;
  onOverrides: (value: VoiceOverrides) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number }>(undefined);

  const startDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!onMove || event.button !== 0) return;
      // Never let the grip steal focus: the bar is only visible while the
      // page's own editor holds it.
      event.preventDefault();
      event.stopPropagation();
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      drag.current = { pointerId: event.pointerId, dx: event.clientX - box.left, dy: event.clientY - box.top };
      setDragging(true);
    },
    [onMove],
  );

  useEffect(() => {
    if (!onMove || !dragging) return;
    const move = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      onMove({ left: event.clientX - current.dx, top: event.clientY - current.dy });
    };
    const up = () => {
      drag.current = undefined;
      setDragging(false);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, [dragging, onMove]);

  const nudge = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!onMove) return;
    if (event.key === "Escape" && moved) {
      event.preventDefault();
      onResetPosition?.();
      return;
    }
    const step = event.shiftKey ? NUDGE_FAR : NUDGE;
    const delta =
      event.key === "ArrowLeft"
        ? { left: -step, top: 0 }
        : event.key === "ArrowRight"
          ? { left: step, top: 0 }
          : event.key === "ArrowUp"
            ? { left: 0, top: -step }
            : event.key === "ArrowDown"
              ? { left: 0, top: step }
              : undefined;
    const box = root.current?.getBoundingClientRect();
    if (!delta || !box) return;
    event.preventDefault();
    onMove({ left: box.left + delta.left, top: box.top + delta.top });
  };

  return (
    <div
      ref={root}
      style={style}
      role="group"
      aria-label="Logue voice"
      className="logue-float group fixed z-surface flex h-bar items-center gap-0.5 p-0.5"
    >
      {onMove && (
        <button
          type="button"
          aria-label={moved ? "Move — Escape puts it back beside the cursor" : "Move"}
          title={moved ? "Drag to move · double-click to snap back" : "Drag to move"}
          onPointerDown={startDrag}
          onKeyDown={nudge}
          onDoubleClick={() => onResetPosition?.()}
          className={`inline-flex h-control w-3.5 min-w-3.5 items-center justify-center rounded-sm text-transparent group-hover:text-line-strong hover:bg-surface-muted hover:!text-muted focus-visible:text-muted [touch-action:none] ${
            dragging ? "cursor-grabbing !text-muted" : "cursor-grab"
          }`}
        >
          <GripVertical size={13} />
        </button>
      )}

      {phase === "recording" ? (
        <>
          <RecordingDot className="mx-1.5" />
          {/* The clock, because ten minutes of speech and ten seconds of it
              look identical on a bar that only shows a dot. Past a minute it
              also says what the end will be, so nobody discovers the ceiling
              by hitting it. */}
          <span
            role="timer"
            aria-label={`Recording, ${seconds} seconds`}
            className={cn("mr-1 font-mono text-xs tabular-nums", long ? "text-warning" : "text-muted")}
          >
            {clock(seconds)}
          </span>
          {long && <span className="mr-1 text-[11px] text-muted">stops at 10:00</span>}
          <Button variant="primary" onPointerDown={keepFocus} onClick={onStop} title="Accept (Enter)">
            Accept <kbd>↵</kbd>
          </Button>
          <IconButton label="Cancel" onPointerDown={keepFocus} onClick={onCancel}>
            <X size={14} />
          </IconButton>
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
          <IconButton
            label="Voice options"
            aria-expanded={pickerOpen}
            className="w-4.5 min-w-4.5 text-faint"
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

      {error && (
        <div
          role="alert"
          className="absolute right-0 bottom-[calc(100%+6px)] w-max max-w-64 rounded-lg border border-[#efc9c4] bg-white px-2 py-1.5 text-xs leading-[1.4] text-[#9b3e35] shadow-[0_6px_18px_rgb(15_15_15/10%)]"
        >
          {error}
          {keptCapture && onRetry && (
            <button
              type="button"
              onPointerDown={keepFocus}
              onClick={onRetry}
              className="mt-1 block rounded-md font-[560] underline decoration-[#efc9c4] underline-offset-2 hover:text-[#7d3129]"
            >
              Try again on the kept recording
            </button>
          )}
        </div>
      )}
    </div>
  );
}
