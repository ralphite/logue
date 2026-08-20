/**
 * Where the caret is, in viewport coordinates.
 *
 * The launcher belongs beside the words being written, not at the corner of the
 * editor. A field's bounding box only says where the editor is, so measure the
 * caret itself.
 */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A mirror is laid out again on every caret move; skip pathological values. */
const MIRROR_LIMIT = 20000;

const MIRRORED = [
  "box-sizing",
  "width",
  "height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "word-spacing",
  "line-height",
  "text-transform",
  "text-indent",
  "text-align",
  "tab-size",
  "direction",
  "white-space",
  "word-break",
  "overflow-wrap",
];

/** A scrolled editor can put its caret outside the visible field. */
export function clampToField(caret: Rect, field: Rect): Rect {
  const left = Math.min(Math.max(caret.left, field.left), field.right);
  const top = Math.min(Math.max(caret.top, field.top), field.bottom);
  return {
    left,
    top,
    right: Math.min(Math.max(caret.right, left), field.right),
    bottom: Math.min(Math.max(caret.bottom, top), field.bottom),
  };
}

export function fromMirror(
  field: { rect: Rect; scrollLeft: number; scrollTop: number },
  mirror: { left: number; top: number },
  marker: { left: number; top: number; height: number },
  lineHeight: number,
): Rect {
  const left = field.rect.left + (marker.left - mirror.left) - field.scrollLeft;
  const top = field.rect.top + (marker.top - mirror.top) - field.scrollTop;
  return { left, top, right: left, bottom: top + (marker.height || lineHeight) };
}

function rectOf(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
}

function lengthOf(style: CSSStyleDeclaration, property: string) {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}

function lineHeightOf(style: CSSStyleDeclaration) {
  const declared = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(declared) && declared > 0) return declared;
  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.4 : 18;
}

/** An empty element still has a caret: at the start of its content box. */
function contentStart(target: HTMLElement): Rect {
  const box = rectOf(target);
  const style = window.getComputedStyle(target);
  const left = box.left + lengthOf(style, "border-left-width") + lengthOf(style, "padding-left");
  const top = box.top + lengthOf(style, "border-top-width") + lengthOf(style, "padding-top");
  return { left, top, right: left, bottom: top + lineHeightOf(style) };
}

function inputCaret(target: HTMLInputElement | HTMLTextAreaElement): Rect | undefined {
  const index = target.selectionEnd ?? target.selectionStart;
  if (index === null || index === undefined) return undefined;
  const value = target.value;
  if (value.length > MIRROR_LIMIT || !document.body) return undefined;

  const style = window.getComputedStyle(target);
  const mirror = document.createElement("div");
  for (const property of MIRRORED) mirror.style.setProperty(property, style.getPropertyValue(property));
  mirror.style.cssText += ";position:absolute;top:0;left:-9999px;visibility:hidden;pointer-events:none;overflow:hidden";
  if (target instanceof HTMLInputElement) mirror.style.setProperty("white-space", "pre");
  mirror.textContent = value.slice(0, index);

  // A zero-width marker measures the caret; the trailing text keeps wrapping
  // identical to the real field.
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.append(marker, document.createTextNode(value.slice(index)));
  document.body.append(mirror);
  const mirrorBox = mirror.getBoundingClientRect();
  const markerBox = marker.getClientRects()[0] ?? marker.getBoundingClientRect();
  mirror.remove();

  return fromMirror(
    { rect: rectOf(target), scrollLeft: target.scrollLeft, scrollTop: target.scrollTop },
    { left: mirrorBox.left, top: mirrorBox.top },
    { left: markerBox.left, top: markerBox.top, height: markerBox.height },
    lineHeightOf(style),
  );
}

function measured(rect: DOMRect | undefined) {
  return rect && (rect.width || rect.height) ? rect : undefined;
}

function editableCaret(target: HTMLElement): Rect | undefined {
  const selection = target.ownerDocument.defaultView?.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (!target.contains(range.endContainer)) return undefined;

  const caret = range.cloneRange();
  caret.collapse(false);
  const rects = caret.getClientRects();
  const direct = measured(rects[rects.length - 1]) ?? measured(caret.getBoundingClientRect());
  if (direct) return { left: direct.left, top: direct.top, right: direct.left, bottom: direct.bottom };

  // A collapsed range can measure empty. Borrow the box of the character on
  // either side of the caret instead.
  const container = caret.endContainer;
  if (container instanceof Text) {
    const text = container;
    const offset = caret.endOffset;
    const widened = target.ownerDocument.createRange();
    if (offset > 0) {
      widened.setStart(text, offset - 1);
      widened.setEnd(text, offset);
      const before = measured(widened.getBoundingClientRect());
      if (before) return { left: before.right, top: before.top, right: before.right, bottom: before.bottom };
    }
    if (offset < text.length) {
      widened.setStart(text, offset);
      widened.setEnd(text, offset + 1);
      const after = measured(widened.getBoundingClientRect());
      if (after) return { left: after.left, top: after.top, right: after.left, bottom: after.bottom };
    }
  }

  // A fresh paragraph in a multi-block editor is empty even when the editor as
  // a whole is not. The caret's own block still knows where its line is.
  const block = container instanceof HTMLElement ? container : container.parentElement;
  if (block && block !== target && target.contains(block)) return contentStart(block);
  return target.textContent?.trim() ? undefined : contentStart(target);
}

/** The caret's viewport rect, or undefined when the browser cannot measure it. */
export function caretRect(target: HTMLElement | null | undefined): Rect | undefined {
  if (!target?.isConnected) return undefined;
  try {
    const caret =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        ? inputCaret(target)
        : target.isContentEditable
          ? editableCaret(target)
          : undefined;
    return caret ? clampToField(caret, rectOf(target)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The box the field sits in, chrome and all.
 *
 * A page's composer is rarely the editable alone: chatgpt.com and Gemini both
 * wrap theirs in a rounded container that carries the send button, the model
 * picker and the attach control. Anchoring to the editable puts our bar on top
 * of those. So walk out while the ancestor is still recognisably the same box
 * — it must contain the field and be no more than a control's worth bigger —
 * and stop the moment it starts to look like the page.
 */
const SLACK = 96;
/**
 * Deep enough for the wrappers a framework leaves behind. Gemini stacks five
 * elements with the field's exact rect before the box that is actually drawn,
 * so a walk that stopped at four never saw the composer at all.
 */
const LEVELS = 10;

export function fieldBox(target: HTMLElement | null | undefined): Rect | undefined {
  if (!target?.isConnected) return undefined;
  const field = rectOf(target);
  let box = field;
  let node = target.parentElement;
  for (let level = 0; node && level < LEVELS; level += 1, node = node.parentElement) {
    const rect = rectOf(node);
    const contains =
      rect.left <= field.left + 1 &&
      rect.right >= field.right - 1 &&
      rect.top <= field.top + 1 &&
      rect.bottom >= field.bottom - 1;
    if (!contains) break;
    // Height alone says whether this is still the composer. Width does not: a
    // composer is wider than its text — Gemini's pill is 660px around a 445px
    // field — while the page containers we must not take are tall.
    if (rect.bottom - rect.top > field.bottom - field.top + SLACK) break;
    box = rect;
  }
  return box;
}
