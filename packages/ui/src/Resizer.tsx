import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
} from "react";
import { cn } from "./cn";

export function clampSize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * A panel width the person set, remembered.
 *
 * Kept out of the Host: this is how someone likes their window arranged on
 * this screen, not something about their work, and it should not travel in a
 * backup or need a round trip to read.
 */
export function usePersistentSize({
  storageKey,
  defaultSize,
  min,
  max,
}: {
  storageKey: string;
  defaultSize: number;
  min: number;
  max: number;
}): { size: number; setSize: Dispatch<SetStateAction<number>> } {
  const [stored, setStored] = useState(() => {
    try {
      const found = Number(window.localStorage.getItem(storageKey));
      return Number.isFinite(found) && found > 0 ? found : defaultSize;
    } catch {
      return defaultSize;
    }
  });
  const size = clampSize(stored, min, max);

  const setSize = useCallback<Dispatch<SetStateAction<number>>>(
    (next) => {
      setStored((current) => {
        const value = clampSize(
          typeof next === "function" ? next(clampSize(current, min, max)) : next,
          min,
          max,
        );
        try {
          window.localStorage.setItem(storageKey, String(value));
        } catch {
          // Resizing still works when storage is unavailable.
        }
        return value;
      });
    },
    [max, min, storageKey],
  );

  return { size, setSize };
}

/**
 * The hairline between two panels, draggable.
 *
 * It is one pixel wide because a visible gutter would be a piece of furniture
 * on every screen; the grab area is wider than the line so it is still easy to
 * catch. Double-click restores the default, and the arrow keys move it — a
 * divider that only responds to a drag is unusable to anyone who cannot drag.
 */
export function Resizer({
  value,
  min,
  max,
  defaultValue,
  onChange,
  edge = "right",
  label,
  className,
}: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (value: number) => void;
  /** Which side of the divider the panel is on. */
  edge?: "left" | "right";
  label: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const from = useRef<{ pointerId: number; x: number; value: number }>(undefined);
  const bodyStyle = useRef<{ cursor: string; userSelect: string }>(undefined);

  const release = useCallback(() => {
    from.current = undefined;
    if (bodyStyle.current) {
      document.body.style.cursor = bodyStyle.current.cursor;
      document.body.style.userSelect = bodyStyle.current.userSelect;
      bodyStyle.current = undefined;
    }
    setDragging(false);
  }, []);

  // A pointer lost outside the window would otherwise leave the page stuck
  // with a resize cursor and no text selection.
  useEffect(() => release, [release]);

  const moveBy = (delta: number, startValue = value) =>
    onChange(clampSize(startValue + (edge === "right" ? delta : -delta), min, max));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") moveBy(-step);
    else if (event.key === "ArrowRight") moveBy(step);
    else if (event.key === "Home") onChange(min);
    else if (event.key === "End") onChange(max);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      data-dragging={dragging ? "true" : "false"}
      className={cn("group relative z-10 w-px shrink-0 touch-none bg-line outline-none", className)}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        from.current = { pointerId: event.pointerId, x: event.clientX, value };
        bodyStyle.current = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        setDragging(true);
      }}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
        const start = from.current;
        if (!start || start.pointerId !== event.pointerId) return;
        moveBy(event.clientX - start.x, start.value);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(clampSize(defaultValue, min, max))}
      title="Drag to resize · double-click to reset"
    >
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize touch-none" />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
          "group-hover:bg-accent group-focus-visible:bg-accent",
          dragging && "bg-accent",
        )}
      />
    </div>
  );
}
