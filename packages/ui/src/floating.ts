import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Where a floating thing goes, measured rather than guessed.
 *
 * His report, 2026-08-13: *"dropdown/popup position. should fix base component
 * to handle all cases"* — a panel dropdown whose list ran off the screen. The
 * two components that float over a trigger were each placing themselves with
 * `absolute` and one rule: flip up if there is no room below. That misses the
 * two things that actually happen:
 *
 *  * **An ancestor with `overflow` clips it.** A side panel scrolls, so the
 *    list is cut off — and the hidden half stops taking clicks as well as
 *    stops being visible. `ContextMenu` had already learned this and moved to
 *    `fixed`; the other two learned it separately, which is how the same hole
 *    gets patched twice and stays open in the third place.
 *  * **It can be wider than what opened it.** Choosing between left-aligned
 *    and right-aligned is not the same as staying on the screen.
 *
 * So: one hook, `fixed` coordinates, clamped to the window on both axes,
 * measured before paint and re-measured whenever the content or the window
 * changes size. Everything that floats over a trigger uses it.
 */

/** How close to the edge of the window a floating panel may sit. */
const EDGE = 8;

/** How far from its trigger it sits. */
const GAP = 4;

export interface Placement {
  left: number;
  top: number;
  /** What the panel may grow to before it needs to scroll itself. */
  maxHeight: number;
  /** Whether it ended up above its trigger, for anything that cares. */
  above: boolean;
}

export function usePlacement({
  open,
  anchor,
  panel,
  align = "start",
  match = false,
}: {
  open: boolean;
  /** What it hangs off. */
  anchor: RefObject<HTMLElement | null>;
  /** The thing being placed. Measured, so it must be rendered to be placed. */
  panel: RefObject<HTMLElement | null>;
  /** Which edge to line up with when there is room. */
  align?: "start" | "end";
  /** Whether it should be at least as wide as its trigger — a select does. */
  match?: boolean;
}): { at?: Placement; width?: number } {
  const [at, setAt] = useState<Placement>();
  const [width, setWidth] = useState<number>();

  // Before paint: drawing in the wrong place and correcting afterwards is a
  // visible jump on every open near an edge.
  useLayoutEffect(() => {
    if (!open) {
      setAt(undefined);
      return;
    }
    const trigger = anchor.current;
    const floating = panel.current;
    if (!trigger || !floating) return;

    const place = () => {
      const from = trigger.getBoundingClientRect();
      const size = floating.getBoundingClientRect();
      const below = window.innerHeight - from.bottom - EDGE - GAP;
      const above = from.top - EDGE - GAP;
      // Up only when there is genuinely more room up there: flipping into a
      // smaller space to avoid a scrollbar helps nobody.
      const goesUp = size.height > below && above > below;
      const wanted = align === "end" ? from.right - size.width : from.left;
      setWidth(match ? Math.max(from.width, size.width) : undefined);
      setAt({
        left: Math.max(EDGE, Math.min(wanted, window.innerWidth - size.width - EDGE)),
        top: goesUp ? Math.max(EDGE, from.top - size.height - GAP) : from.bottom + GAP,
        maxHeight: Math.max(120, goesUp ? above : below),
        above: goesUp,
      });
    };

    place();
    // A list that loads late, a window that changes, a page that scrolls under
    // a panel that is still open: each of them moves the trigger.
    const watching = new ResizeObserver(place);
    watching.observe(floating);
    watching.observe(trigger);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      watching.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, panel, align, match]);

  return { at, width };
}

/**
 * The style a placed panel takes.
 *
 * Hidden until it has been measured — one frame with the panel in the wrong
 * corner is exactly the flicker the measurement exists to avoid.
 */
export function floatingStyle(at: Placement | undefined, width?: number): React.CSSProperties {
  return {
    position: "fixed",
    left: at?.left ?? 0,
    top: at?.top ?? 0,
    maxHeight: at?.maxHeight,
    minWidth: width,
    visibility: at ? undefined : "hidden",
  };
}
