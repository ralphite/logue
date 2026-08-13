import { cloneElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The word for a control that is only a picture.
 *
 * Held back 350ms so it never flickers across a pointer passing through, then
 * pinned to the trigger with `position: fixed` — a tooltip clipped by an
 * `overflow` ancestor is a tooltip that might as well not exist. One line,
 * dark, small: it answers "what is this", it does not paragraph.
 */
const DELAY_MS = 350;
/** Once one tooltip has shown, its neighbours show at once — the tour effect. */
const WARM_MS = 500;

let lastHiddenAt = 0;

export function Tooltip({
  label,
  keys,
  side = "bottom",
  children,
}: {
  label: string;
  /** A shortcut, shown after the words the way menus show theirs. */
  keys?: string;
  side?: "top" | "bottom";
  children: ReactElement<{
    onPointerEnter?: (e: React.PointerEvent) => void;
    onPointerLeave?: (e: React.PointerEvent) => void;
    onPointerDown?: (e: React.PointerEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    ref?: React.Ref<HTMLElement>;
  }>;
}) {
  const [at, setAt] = useState<{ x: number; y: number; above: boolean }>();
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<number>(undefined);

  const place = () => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    // Flip rather than clip: near the window's edge the label moves to the
    // other side of the control instead of leaving the screen.
    const above = side === "top" ? box.top > 40 : box.bottom > window.innerHeight - 40;
    setAt({
      x: Math.min(Math.max(box.left + box.width / 2, 12), window.innerWidth - 12),
      y: above ? box.top - 6 : box.bottom + 6,
      above,
    });
  };

  const show = () => {
    window.clearTimeout(timer.current);
    // A pointer wandering a toolbar should read each label without waiting
    // out the delay again — but only within a short memory.
    timer.current = window.setTimeout(place, Date.now() - lastHiddenAt < WARM_MS ? 0 : DELAY_MS);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    if (at) lastHiddenAt = Date.now();
    setAt(undefined);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      {cloneElement(children, {
        ref: (node: HTMLElement | null) => {
          anchor.current = node;
        },
        onPointerEnter: (e) => {
          children.props.onPointerEnter?.(e);
          show();
        },
        onPointerLeave: (e) => {
          children.props.onPointerLeave?.(e);
          hide();
        },
        // Pressing is answering the question; the label would only hover
        // over whatever the press revealed.
        onPointerDown: (e) => {
          children.props.onPointerDown?.(e);
          hide();
        },
        onFocus: (e) => {
          children.props.onFocus?.(e);
          show();
        },
        onBlur: (e) => {
          children.props.onBlur?.(e);
          hide();
        },
      })}
      {at &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: at.x, top: at.y }}
            className={
              "pointer-events-none fixed z-popover flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-ink px-2 py-1 text-[11px] leading-none font-[500] whitespace-nowrap text-surface shadow-md " +
              (at.above ? "-translate-y-full" : "")
            }
          >
            {label}
            {keys && <kbd className="font-sans text-[10px] text-surface/60">{keys}</kbd>}
          </span>,
          document.body,
        )}
    </>
  );
}

/** The one wrapper most call sites want: an icon button with its word. */
export function Labeled({ label, keys, children }: { label: string; keys?: string; children: ReactNode }) {
  return (
    <Tooltip label={label} keys={keys}>
      <span className="inline-flex">{children}</span>
    </Tooltip>
  );
}
