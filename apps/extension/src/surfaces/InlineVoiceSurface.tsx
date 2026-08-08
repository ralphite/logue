import { Check, ChevronDown, GripVertical, LoaderCircle, Mic, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { CaptureContext, VoiceProfileOverrides } from "../voiceProfileModels";
import { VoiceProfilePicker } from "../VoiceProfilePicker";
import { actionButton, errorAction, errorBubble, iconButton, primaryAction, profileButton, profilePopover, recordingChip, recordingDot, spinner } from "./surfaceStyles";

export type InlineVoicePhase = "idle" | "starting" | "recording" | "processing" | "error";

const NUDGE_STEP = 12;
const NUDGE_STEP_LARGE = 48;

export function InlineVoiceSurface({
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
  onMove,
  onResetPosition,
  moved = false,
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
  onMove?: (position: { left: number; top: number }) => void;
  onResetPosition?: () => void;
  moved?: boolean;
}) {
  const captureActive = phase === "starting" || phase === "recording" || phase === "processing";
  const profileLabel = profileContext?.resolved_voice_profile.label || "Default voice";
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetLeft: number; offsetTop: number } | undefined>(undefined);
  const [dragging, setDragging] = useState(false);

  const dragStart = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!onMove || event.button !== 0) return;
    // Never let the grip steal focus from the page's editor: the control is
    // only visible while that editor holds focus.
    event.preventDefault();
    event.stopPropagation();
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetLeft: event.clientX - box.left,
      offsetTop: event.clientY - box.top,
    };
    setDragging(true);
  }, [onMove]);

  useEffect(() => {
    // Only listen while a drag is live: this control sits on every page the
    // user types on.
    if (!onMove || !dragging) return undefined;
    const onPointerMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      onMove({ left: event.clientX - drag.offsetLeft, top: event.clientY - drag.offsetTop });
    };
    const onPointerUp = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = undefined;
      setDragging(false);
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
    };
  }, [dragging, onMove]);

  const nudge = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (!onMove) return;
    if (event.key === "Escape" && moved && onResetPosition) {
      event.preventDefault();
      onResetPosition();
      return;
    }
    const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    const delta = event.key === "ArrowLeft" ? { left: -step, top: 0 }
      : event.key === "ArrowRight" ? { left: step, top: 0 }
        : event.key === "ArrowUp" ? { left: 0, top: -step }
          : event.key === "ArrowDown" ? { left: 0, top: step }
            : undefined;
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!delta || !box) return;
    event.preventDefault();
    onMove({ left: box.left + delta.left, top: box.top + delta.top });
  }, [moved, onMove, onResetPosition]);

  const width = phase === "recording" ? "w-[308px]" : phase === "starting" || phase === "processing" ? "w-[236px]" : "w-[242px]";
  return <div
    ref={surfaceRef}
    className={`fixed z-surface flex min-h-11 items-center gap-[5px] rounded-xl border border-[rgb(32_33_31/13%)] bg-[rgb(255_255_255/97%)] p-[5px] text-ink backdrop-blur-[14px] ${width} ${dragging ? "shadow-[0_16px_38px_rgb(25_27_23/22%)]" : "shadow-[0_10px_30px_rgb(25_27_23/14%)]"}`}
    style={style}
    role="group"
    aria-label="Logue voice input"
  >
    {onMove ? <button
      type="button"
      className={`inline-flex h-8.5 w-4 min-w-4 items-center justify-center rounded-sm text-line-strong hover:bg-surface-muted hover:text-muted [touch-action:none] ${dragging ? "cursor-grabbing text-muted" : "cursor-grab"}`}
      aria-label={moved ? "Move Logue voice input · Escape resets it beside the cursor" : "Move Logue voice input"}
      title={moved ? "Drag to move · double-click to snap back to the cursor" : "Drag to move"}
      onPointerDown={dragStart}
      onKeyDown={nudge}
      onDoubleClick={() => onResetPosition?.()}
    ><GripVertical size={14} /></button> : null}
    {phase === "recording" ? <>
      <span className={recordingChip} role="status"><span className={recordingDot} />Recording</span>
      <button type="button" className={`${actionButton} ${primaryAction}`} aria-label="Stop voice input" aria-keyshortcuts="Enter" title="Accept (Enter)" onPointerDown={(event) => event.preventDefault()} onClick={onStopAndInsert}><Check size={15} />Accept <kbd>↵</kbd></button>
      <button type="button" className={actionButton} aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={onCancel}><X size={14} />Cancel</button>
    </> : captureActive ? <>
      <LoaderCircle size={15} className={spinner} />
      <span className="min-w-0 flex-1 text-xs text-muted" role="status">{phase === "starting" ? "Starting microphone…" : "Transcribing…"}</span>
      <button type="button" className={actionButton} onPointerDown={(event) => event.preventDefault()} onClick={onCancel}>Cancel</button>
    </> : <>
      <button type="button" className={`${iconButton} bg-accent-soft text-accent hover:bg-[#e4e6fc] hover:text-accent-hover`} aria-label="Start voice input" title={phase === "error" ? "Try voice input again" : `Voice write · ${profileLabel}`} onPointerDown={(event) => event.preventDefault()} onClick={onStart}><Mic size={16} /></button>
      {onStartCommand ? <button type="button" className={`${iconButton} text-muted hover:bg-surface-muted hover:text-ink`} aria-label="Start voice command" title="Voice command" onPointerDown={(event) => event.preventDefault()} onClick={onStartCommand}><Sparkles size={15} /></button> : null}
      <button type="button" className={`${profileButton} h-8 flex-1`} aria-expanded={profilePickerOpen} aria-label={`Voice profile: ${profileLabel}`} onPointerDown={(event) => event.preventDefault()} onClick={() => onProfilePickerOpenChange(!profilePickerOpen)}><span>{profileLabel}</span><ChevronDown size={11} /></button>
    </>}
    {profilePickerOpen && !captureActive ? <div className={`${profilePopover} right-0`}><VoiceProfilePicker context={profileContext} overrides={profileOverrides} onChange={onProfileOverridesChange} onClose={() => onProfilePickerOpenChange(false)} /></div> : null}
    {error ? <div
      className={`${errorBubble} ${errorPlacement.vertical === "below" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]"} ${errorPlacement.horizontal === "left" ? "left-0" : "right-0"}`}
      role="alert"
    ><span>{error}</span>{pendingCopyText && onCopy ? <button type="button" className={errorAction} onClick={onCopy}>Copy saved text</button> : null}</div> : null}
  </div>;
}
