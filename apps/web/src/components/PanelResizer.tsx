import { cn } from "@logue/ui";
import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type PanelResizerEdge = "left" | "right";

export interface PersistentPanelSizeOptions {
  storageKey: string;
  defaultSize: number;
  min: number;
  max: number;
}

export function clampPanelSize(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function usePersistentPanelSize({
  storageKey,
  defaultSize,
  min,
  max,
}: PersistentPanelSizeOptions): {
  size: number;
  setSize: Dispatch<SetStateAction<number>>;
  resetSize: () => void;
} {
  const customizedRef = useRef(false);
  const [preferredSize, setPreferredSize] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      const stored = storedValue === null ? Number.NaN : Number(storedValue);
      customizedRef.current = storedValue !== null && Number.isFinite(stored);
      return customizedRef.current ? stored : defaultSize;
    } catch {
      return defaultSize;
    }
  });
  const size = clampPanelSize(preferredSize, min, max);

  const setSize = useCallback<Dispatch<SetStateAction<number>>>((next) => {
    customizedRef.current = true;
    setPreferredSize((current) => clampPanelSize(
      typeof next === "function" ? next(clampPanelSize(current, min, max)) : next,
      min,
      max,
    ));
  }, [max, min]);

  const resetSize = useCallback(() => {
    customizedRef.current = false;
    setPreferredSize(defaultSize);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Reset still works when browser storage is unavailable.
    }
  }, [defaultSize, storageKey]);

  useEffect(() => {
    if (!customizedRef.current) setPreferredSize(defaultSize);
  }, [defaultSize]);

  useEffect(() => {
    if (!customizedRef.current) return;
    try {
      window.localStorage.setItem(storageKey, String(preferredSize));
    } catch {
      // Resizing remains available when browser storage is unavailable.
    }
  }, [preferredSize, storageKey]);

  return { size, setSize, resetSize };
}

export function PanelResizer({
  value,
  min,
  max,
  defaultValue,
  onChange,
  edge = "right",
  label,
  className,
  onDraggingChange,
}: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (value: number) => void;
  edge?: PanelResizerEdge;
  label: string;
  className?: string;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerId: number; x: number; value: number } | undefined>(undefined);
  const previousBodyStyleRef = useRef<{ cursor: string; userSelect: string } | undefined>(undefined);

  const updateDragging = useCallback((next: boolean) => {
    setDragging(next);
    onDraggingChange?.(next);
  }, [onDraggingChange]);

  const restoreBodyStyle = useCallback(() => {
    const previous = previousBodyStyleRef.current;
    if (!previous) return;
    document.body.style.cursor = previous.cursor;
    document.body.style.userSelect = previous.userSelect;
    previousBodyStyleRef.current = undefined;
  }, []);

  const finishDrag = useCallback(() => {
    dragStartRef.current = undefined;
    restoreBodyStyle();
    updateDragging(false);
  }, [restoreBodyStyle, updateDragging]);

  useEffect(() => finishDrag, [finishDrag]);

  const resizeFromBoundaryDelta = useCallback((boundaryDelta: number, startValue = value) => {
    const sizeDelta = edge === "right" ? boundaryDelta : -boundaryDelta;
    onChange(clampPanelSize(startValue + sizeDelta, min, max));
  }, [edge, max, min, onChange, value]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, value };
    previousBodyStyleRef.current = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    updateDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    resizeFromBoundaryDelta(event.clientX - start.x, start.value);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") resizeFromBoundaryDelta(-step);
    else if (event.key === "ArrowRight") resizeFromBoundaryDelta(step);
    else if (event.key === "Home") onChange(min);
    else if (event.key === "End") onChange(max);
    else return;
    event.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)} pixels`}
      tabIndex={0}
      data-dragging={dragging ? "true" : "false"}
      className={cn(
        "group relative z-20 h-full w-px shrink-0 touch-none bg-[#e7e7e4] outline-none",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onChange(clampPanelSize(defaultValue, min, max))}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize touch-none" />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150 group-hover:bg-[#777dd9] group-focus-visible:bg-[#5b64f4]",
          dragging && "bg-[#5b64f4]",
        )}
      />
    </div>
  );
}
