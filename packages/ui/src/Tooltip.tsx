import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

/**
 * The word for a control that is only a picture.
 *
 * Held back 350ms so it never flickers across a pointer passing through, then
 * pinned with `position: fixed` — a tooltip clipped by an `overflow` ancestor
 * is a tooltip that might as well not exist. It answers "what is this"; it
 * does not paragraph. Scrolling, pressing, or Escape dismisses it at once,
 * because a label that chases a moving screen is noise.
 */
const DELAY_MS = 350;
/** Once one tooltip has shown, its neighbours show at once — the tour effect. */
const WARM_MS = 500;

let lastHiddenAt = 0;

interface AnchorProps {
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  "aria-describedby"?: string;
  ref?: Ref<HTMLElement>;
  disabled?: boolean;
  /**
   * The browser's own tooltip.
   *
   * Cleared on anything this component wraps: an `IconButton` sets `title`
   * from its label, so a wrapped one showed the product's black label and the
   * operating system's yellow strip at the same time, saying two different
   * things about one button. The word is this component's job while it is on.
   */
  title?: string;
}

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
  children: ReactElement<AnchorProps>;
}) {
  const [at, setAt] = useState<{ x: number; y: number; above: boolean }>();
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<number>(undefined);
  const id = useId();

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
    setAt((was) => {
      if (was) lastHiddenAt = Date.now();
      return undefined;
    });
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The screen moved or the person said no: the label is stale either way.
  useEffect(() => {
    if (!at) return;
    const onScroll = () => hide();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKeyDown, true);
    };
    // `hide` is stable in behaviour; `at` gates the listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(at)]);

  /**
   * A disabled element fires no pointer events, so its word would never show —
   * the one moment a label is most wanted. The standard remedy, kept from
   * every framework that met this first: a neutral wrapper carries the events.
   */
  const child =
    isValidElement(children) && children.props.disabled ? (
      <span className="inline-flex">{cloneElement(children, { title: undefined })}</span>
    ) : (
      children
    );

  // The original element's own handlers and ref, kept working. When the
  // anchor is the neutral wrapper these belong to the child inside it, which
  // is untouched — so only the unwrapped case forwards.
  const wrapped = child !== children;
  const own = wrapped ? ({} as AnchorProps) : children.props;
  const handlers: AnchorProps = {
    ref: (node: HTMLElement | null) => {
      anchor.current = node;
      const inner = own.ref;
      if (typeof inner === "function") inner(node);
      else if (inner && typeof inner === "object") inner.current = node;
    },
    onPointerEnter: (e) => {
      own.onPointerEnter?.(e);
      show();
    },
    onPointerLeave: (e) => {
      own.onPointerLeave?.(e);
      hide();
    },
    // Pressing is answering the question; the label would only hover over
    // whatever the press revealed.
    onPointerDown: (e) => {
      own.onPointerDown?.(e);
      hide();
    },
    onFocus: (e) => {
      own.onFocus?.(e);
      show();
    },
    onBlur: (e) => {
      own.onBlur?.(e);
      hide();
    },
    "aria-describedby": at ? id : undefined,
    title: undefined,
  };

  return (
    <>
      {cloneElement(child as ReactElement<AnchorProps>, handlers)}
      {at &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            style={{ left: at.x, top: at.y }}
            className={
              "pointer-events-none fixed z-popover flex max-w-72 -translate-x-1/2 items-center gap-1.5 rounded-md bg-ink px-2 py-1 text-[11px] leading-[1.35] font-[500] text-surface shadow-md " +
              (at.above ? "-translate-y-full" : "")
            }
          >
            {label}
            {keys && <kbd className="font-sans text-[10px] whitespace-nowrap text-surface/60">{keys}</kbd>}
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
