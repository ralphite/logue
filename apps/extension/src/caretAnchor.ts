/**
 * The inline launcher belongs beside the text the user is actually writing.
 * A field's bounding box only says where the editor is, so measure the caret
 * itself and let the launcher follow it.
 */
export interface CaretRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * A mirror is laid out again on every caret move. Skip pathological values
 * rather than make typing feel heavy in a very long editor.
 */
const MIRROR_VALUE_LIMIT = 20000;

const MIRRORED_PROPERTIES = [
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
  "font-variant",
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

/**
 * A scrolled editor can put its caret outside the visible field. Keep the
 * anchor on the part of the editor the user can still see.
 */
export function caretWithinField(caret: CaretRect, field: CaretRect): CaretRect {
  const left = Math.min(Math.max(caret.left, field.left), field.right);
  const top = Math.min(Math.max(caret.top, field.top), field.bottom);
  return {
    left,
    top,
    right: Math.min(Math.max(caret.right, left), field.right),
    bottom: Math.min(Math.max(caret.bottom, top), field.bottom),
  };
}

export function mirroredCaretRect(
  field: { rect: CaretRect; scrollLeft: number; scrollTop: number },
  mirror: { left: number; top: number },
  marker: { left: number; top: number; height: number },
  lineHeight: number,
): CaretRect {
  const left = field.rect.left + (marker.left - mirror.left) - field.scrollLeft;
  const top = field.rect.top + (marker.top - mirror.top) - field.scrollTop;
  return { left, top, right: left, bottom: top + (marker.height || lineHeight) };
}

function rectOf(element: Element): CaretRect {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
}

function styleLength(computed: CSSStyleDeclaration, property: string) {
  const value = Number.parseFloat(computed.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}

function lineHeightOf(computed: CSSStyleDeclaration) {
  const declared = Number.parseFloat(computed.lineHeight);
  if (Number.isFinite(declared) && declared > 0) return declared;
  const fontSize = Number.parseFloat(computed.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.4 : 18;
}

/** An empty editor still has a caret: it sits at the start of the content box. */
function emptyFieldCaret(target: HTMLElement): CaretRect {
  const box = rectOf(target);
  const computed = window.getComputedStyle(target);
  const left = box.left + styleLength(computed, "border-left-width") + styleLength(computed, "padding-left");
  const top = box.top + styleLength(computed, "border-top-width") + styleLength(computed, "padding-top");
  return { left, top, right: left, bottom: top + lineHeightOf(computed) };
}

function inputCaretRect(target: HTMLInputElement | HTMLTextAreaElement): CaretRect | undefined {
  const index = target.selectionEnd ?? target.selectionStart;
  if (index === null || index === undefined) return undefined;
  const value = target.value;
  if (value.length > MIRROR_VALUE_LIMIT || !document.body) return undefined;
  const computed = window.getComputedStyle(target);
  const mirror = document.createElement("div");
  for (const property of MIRRORED_PROPERTIES) mirror.style.setProperty(property, computed.getPropertyValue(property));
  mirror.style.setProperty("position", "absolute");
  mirror.style.setProperty("top", "0");
  mirror.style.setProperty("left", "-9999px");
  mirror.style.setProperty("visibility", "hidden");
  mirror.style.setProperty("pointer-events", "none");
  mirror.style.setProperty("overflow", "hidden");
  if (target instanceof HTMLInputElement) mirror.style.setProperty("white-space", "pre");
  mirror.textContent = value.slice(0, index);
  // A zero-width marker measures the caret; the trailing text keeps wrapping
  // identical to the real field.
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker, document.createTextNode(value.slice(index)));
  document.body.append(mirror);
  const mirrorBox = mirror.getBoundingClientRect();
  const markerBox = marker.getClientRects()[0] ?? marker.getBoundingClientRect();
  mirror.remove();
  return mirroredCaretRect(
    { rect: rectOf(target), scrollLeft: target.scrollLeft, scrollTop: target.scrollTop },
    { left: mirrorBox.left, top: mirrorBox.top },
    { left: markerBox.left, top: markerBox.top, height: markerBox.height },
    lineHeightOf(computed),
  );
}

function measuredRect(rect: DOMRect | undefined) {
  return rect && (rect.width || rect.height) ? rect : undefined;
}

function editableCaretRect(target: HTMLElement): CaretRect | undefined {
  const selection = target.ownerDocument.defaultView?.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (!target.contains(range.endContainer)) return undefined;
  const caret = range.cloneRange();
  caret.collapse(false);
  const rects = caret.getClientRects();
  const direct = measuredRect(rects[rects.length - 1]) ?? measuredRect(caret.getBoundingClientRect());
  if (direct) return { left: direct.left, top: direct.top, right: direct.left, bottom: direct.bottom };
  // A collapsed range can measure empty. Borrow the box of the character on
  // either side of the caret instead.
  const container = caret.endContainer;
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container as Text;
    const offset = caret.endOffset;
    const widened = target.ownerDocument.createRange();
    if (offset > 0) {
      widened.setStart(text, offset - 1);
      widened.setEnd(text, offset);
      const before = measuredRect(widened.getBoundingClientRect());
      if (before) return { left: before.right, top: before.top, right: before.right, bottom: before.bottom };
    }
    if (offset < text.length) {
      widened.setStart(text, offset);
      widened.setEnd(text, offset + 1);
      const after = measuredRect(widened.getBoundingClientRect());
      if (after) return { left: after.left, top: after.top, right: after.left, bottom: after.bottom };
    }
  }
  return target.textContent?.trim() ? undefined : emptyFieldCaret(target);
}

/**
 * Returns the caret's viewport rect for the focused editor, or undefined when
 * the browser cannot measure it. Callers fall back to the field's own box.
 */
export function caretAnchorRect(target: HTMLElement | null | undefined): CaretRect | undefined {
  if (!target || !target.isConnected) return undefined;
  try {
    const caret = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? inputCaretRect(target)
      : target.isContentEditable
        ? editableCaretRect(target)
        : undefined;
    return caret ? caretWithinField(caret, rectOf(target)) : undefined;
  } catch {
    return undefined;
  }
}
