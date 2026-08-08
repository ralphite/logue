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
 * Sit just under the caret, and flip above it when the caret is near the
 * bottom of the viewport.
 */
export function besideCaret(caret: Caret, viewport: Viewport, width: number, height: number): Point {
  const below = caret.bottom + GAP;
  const top = below + height + INSET <= viewport.height ? below : caret.top - GAP - height;
  return clamp({ left: caret.left + GAP, top }, viewport, width, height);
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
