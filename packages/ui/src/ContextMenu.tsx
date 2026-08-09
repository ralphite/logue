import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Where a cursor menu was asked for, and what to hand focus back to. */
export interface MenuPoint {
  x: number;
  y: number;
  /** The row that opened it, so focus has somewhere to return. */
  returnTo?: HTMLElement | null;
}

/** How close the panel may come to the window's edge. */
const EDGE = 8;

function items(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
    // Not `offsetParent !== null`, the usual shorthand for "visible": inside a
    // `position: fixed` panel every child reports a null offsetParent, so that
    // test threw away the whole menu — nothing took focus and the arrow keys
    // moved through an empty list.
    (item) => !item.hasAttribute("disabled") && item.checkVisibility(),
  );
}

/**
 * A row's own actions, at the cursor.
 *
 * The same list a row shows on hover, reachable by right-click and by the
 * keyboard — otherwise the actions exist only for people who can find a 20px
 * target that appears when hovered.
 */
export function ContextMenu({
  at,
  onClose,
  label,
  children,
}: {
  /** Open when given; closed when not. */
  at?: MenuPoint;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number }>();

  const close = useCallback(() => {
    // Handed back explicitly: the element that opened the menu is often gone
    // by the time the menu closes (the row moved, the list re-sorted), and a
    // browser with nowhere to put focus puts it on <body> — where the next
    // Tab starts over at the top of the page.
    const back = at?.returnTo;
    onClose();
    if (back?.isConnected) back.focus();
  }, [at, onClose]);

  // Measured before paint. Drawing at the raw cursor and correcting after
  // would make every open near an edge visibly jump.
  useLayoutEffect(() => {
    if (!at) {
      setBox(undefined);
      return;
    }
    const node = panel.current;
    if (!node) return;
    const place = () => {
      const rect = node.getBoundingClientRect();
      setBox({
        left: Math.max(EDGE, Math.min(at.x, window.innerWidth - rect.width - EDGE)),
        top: Math.max(EDGE, Math.min(at.y, window.innerHeight - rect.height - EDGE)),
      });
    };
    place();
    // An item that appears late — a count that loads, an entry that un-hides —
    // changes the height the clamp was computed from.
    const observer = new ResizeObserver(place);
    observer.observe(node);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [at]);

  useEffect(() => {
    if (!at) return;
    // A frame late, on purpose. The click that opens the menu also gives the
    // browser its own focus to place — on the row that was right-clicked — and
    // that lands after this effect. Focusing immediately left the menu open
    // with focus back on the row, so the arrow keys went nowhere.
    const frame = requestAnimationFrame(() => items(panel.current)[0]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && panel.current?.contains(target)) return;
      close();
    };
    // Any scroll invalidates the cursor position the panel was placed at, so
    // dismiss rather than float somewhere stale.
    const onScroll = () => close();
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [at, close]);

  if (!at) return null;

  return (
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      // Fixed, not absolute: an ancestor with `overflow` would clip the panel,
      // and a clipped panel is not just cut off — the hidden half stops taking
      // clicks at all.
      style={{ position: "fixed", left: box?.left ?? at.x, top: box?.top ?? at.y, visibility: box ? undefined : "hidden" }}
      className="logue-float z-popover min-w-44 max-w-72 p-1"
      onClick={(event) => {
        // After an item runs the menu has said what it had to say.
        if (event.target instanceof Element && event.target.closest('[role="menuitem"]')) close();
      }}
      onKeyDown={(event) => {
        const list = items(panel.current);
        const focused = document.activeElement;
        const here = focused instanceof HTMLElement ? list.indexOf(focused) : -1;
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          list[(here + 1) % list.length]?.focus();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          list[(here - 1 + list.length) % list.length]?.focus();
        } else if (event.key === "Home") {
          event.preventDefault();
          list[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          list[list.length - 1]?.focus();
        } else if (event.key === "Tab") {
          // Tab leaves the menu rather than cycling inside it: someone tabbing
          // is trying to get past this, not to read it again.
          close();
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * The line above a group of items, naming what they act on.
 *
 * A cursor menu opens away from the row it belongs to, so without this there
 * is nothing on screen saying which of twelve near-identical rows is about to
 * be deleted.
 */
export function MenuHeading({ children }: { children: ReactNode }) {
  return <p className="truncate px-2 pt-1 pb-1.5 text-[11px] text-faint">{children}</p>;
}

/** A hairline between two kinds of action — the destructive one below it. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
