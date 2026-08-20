/** Placing a floating control beside the caret without leaving the viewport. */

export interface Point {
  left: number;
  top: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Caret {
  left: number;
  top: number;
  bottom: number;
}

const INSET = 8;
/** Keeps the control off the caret's own line without drifting away from it. */
const GAP = 10;

/** Rendered sizes, so placement can be computed before the control mounts. */
export const BAR = { idle: { width: 96, height: 32 }, busy: { width: 168, height: 32 } };

export function clamp(point: Point, viewport: Viewport, width: number, height: number): Point {
  return {
    left: Math.min(Math.max(INSET, viewport.width - width - INSET), Math.max(INSET, point.left)),
    top: Math.min(Math.max(INSET, viewport.height - height - INSET), Math.max(INSET, point.top)),
  };
}

/**
 * A box the bar must stay off — the composer it is being typed into, chrome
 * and all. Only small ones count: see `besideCaret`.
 */
export interface Box {
  top: number;
  bottom: number;
}

/**
 * A field taller than this is a page being written, not a box being filled in.
 * The bar stays beside the caret there, because "outside the field" would mean
 * the far end of a document.
 */
const SHORT_FIELD = 120;

const covers = (top: number, height: number, box: Box) => top < box.bottom && top + height > box.top;

/**
 * Sit just under the caret, and flip above it when the caret is near the
 * bottom of the viewport.
 *
 * `avoid` is the composer the caret is in. On a one-line box — chatgpt.com's
 * ask field, Gemini's, a comment field — "just under the caret" is on top of
 * the field's own buttons: measured on chatgpt.com, the bar covered the last
 * six pixels of the field and sat over the send row. So when the field is
 * short enough to see all of, the bar goes outside it: under it if it fits,
 * over it if not, and only then back to the caret rule.
 */
export function besideCaret(
  caret: Caret,
  viewport: Viewport,
  width: number,
  height: number,
  avoid?: Box,
): Point {
  const left = caret.left + GAP;
  const onScreen = (top: number) => top >= INSET && top + height + INSET <= viewport.height;
  const below = caret.bottom + GAP;

  const box = avoid && avoid.bottom - avoid.top <= SHORT_FIELD ? avoid : undefined;
  if (box) {
    for (const top of [box.bottom + GAP, box.top - GAP - height]) {
      if (onScreen(top)) return clamp({ left, top }, viewport, width, height);
    }
  }
  if (box && covers(below, height, box)) {
    // Nowhere clears the field on screen. Above the caret still hides less of
    // it than under, because the caret is on the field's last visible line.
    const above = caret.top - GAP - height;
    if (onScreen(above)) return clamp({ left, top: above }, viewport, width, height);
  }

  const top = onScreen(below) ? below : caret.top - GAP - height;
  return clamp({ left, top }, viewport, width, height);
}

/** Above a selection, centred on it — the shape of an editor's selection toolbar. */
export function aboveSelection(
  selection: { left: number; right: number; top: number; bottom: number },
  viewport: Viewport,
  width: number,
  height: number,
): Point {
  const centred = (selection.left + selection.right) / 2 - width / 2;
  const above = selection.top - GAP - height;
  const top = above >= INSET ? above : selection.bottom + GAP;
  return clamp({ left: centred, top }, viewport, width, height);
}
