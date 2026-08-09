import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/**
 * The shell both of Logue's page bars are built from.
 *
 * There are two of them — the one beside your cursor and the one over a
 * selection — and they had been written twice. They drifted, exactly as
 * duplicated things do: only one had a handle, the buttons sat in different
 * orders, the tooltips said different words. The owner's instruction was
 * "都应该一致的,不能只改一个地方": one design, and a change lands on both.
 *
 * So everything the two share lives here — the frame, the handle, dragging,
 * nudging with the arrow keys, snapping back — and each bar supplies only
 * what is actually its own: the controls inside.
 */

/** A pointer nudge, and the bigger one Shift asks for. */
const NUDGE = 8;
const NUDGE_FAR = 32;

export interface Draggable {
  /** Where to put it, in viewport coordinates. Absent means it cannot move. */
  onMove?: (point: { left: number; top: number }) => void;
  /** Put it back where it belongs beside the caret or the selection. */
  onResetPosition?: () => void;
  /** True once a person has dragged it somewhere of their own choosing. */
  moved?: boolean;
}

export function FloatingBar({
  label,
  style,
  children,
  onPointerDown,
  className,
  onMove,
  onResetPosition,
  moved,
}: Draggable & {
  /** What a screen reader calls this bar. */
  label: string;
  style?: CSSProperties;
  children: ReactNode;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number }>(undefined);

  const begin = useCallback(
    (event: PointerEvent) => {
      if (!onMove || event.button !== 0) return;
      // Never let the bar steal focus: it is only on screen while the page's
      // own editor or selection holds it.
      event.preventDefault();
      event.stopPropagation();
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      drag.current = { pointerId: event.pointerId, dx: event.clientX - box.left, dy: event.clientY - box.top };
      setDragging(true);
    },
    [onMove],
  );

  /**
   * Hold the bar itself and it moves.
   *
   * The handle is 14 pixels wide and can end up under a menu, a tooltip or
   * whatever the page floats over it — so the bar's own background is a
   * second way to pick it up. Only the background: a press that started on a
   * button belongs to that button.
   */
  const beginFromBody = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      // Deliberately not gated on defaultPrevented: the selection bar cancels
      // every press so the page keeps its selection, which would have meant
      // that bar — the one with no handle in the first place — was the one
      // that could not be dragged by its body either.
      //
      // A press that started on a control belongs to that control; only the
      // bar's own background picks the bar up.
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, textarea, select, [role='button']")) return;
      begin(event);
    },
    [begin, onPointerDown],
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
      aria-label={label}
      onPointerDown={beginFromBody}
      className={`logue-float group fixed z-surface flex h-bar max-w-[calc(100vw-16px)] items-center gap-0.5 p-0.5 ${
        dragging ? "cursor-grabbing" : ""
      } ${className ?? ""}`}
    >
      {onMove && (
        // Always visible, never on hover. A handle nobody can see is a handle
        // nobody finds, and both bars have one for the same reason.
        <button
          type="button"
          aria-label={moved ? "Move — Escape puts it back" : "Move"}
          title={moved ? "Drag to move · double-click to snap back" : "Drag to move"}
          onPointerDown={begin}
          onKeyDown={nudge}
          onDoubleClick={() => onResetPosition?.()}
          className={`inline-flex h-control w-3.5 min-w-3.5 items-center justify-center rounded-sm text-line-strong hover:bg-surface-muted hover:!text-muted focus-visible:text-muted [touch-action:none] ${
            dragging ? "cursor-grabbing !text-muted" : "cursor-grab"
          }`}
        >
          <GripVertical size={13} />
        </button>
      )}
      {children}
    </div>
  );
}
