/**
 * Google Docs draws its page on a canvas, so the usual "focused editable
 * element" never appears in the top document. What does exist is a hidden
 * contenteditable inside an iframe that receives every keystroke — Docs' own
 * input sink. Writing into that is writing into the document.
 *
 * This is the only site-specific code in the extension. It exists because Docs
 * is where people write, not because special-casing is acceptable in general.
 */

const EDITABLE = 'div[contenteditable="true"][aria-label="Document content"], textarea[aria-label="Document content"]';

export function isGoogleDocs(url: string = location.href): boolean {
  try {
    return new URL(url).hostname === "docs.google.com";
  } catch {
    return false;
  }
}

/** The input sink, whether this frame is the top page or the editor iframe. */
export function editorTarget(root: Document = document): HTMLElement | undefined {
  const direct = root.querySelector<HTMLElement>(EDITABLE);
  if (direct) return direct;
  for (const frame of root.querySelectorAll("iframe")) {
    try {
      const inside = frame.contentDocument?.querySelector<HTMLElement>(EDITABLE);
      if (inside) return inside;
    } catch {
      // A cross-origin frame is not ours to read; the editor frame is same-origin.
    }
  }
  return undefined;
}

/**
 * Where the caret is, which Docs draws itself.
 *
 * "A canvas gives no caret" was true of the text, not of the cursor: Docs
 * paints its own blinking caret as an element and keeps it positioned. So
 * the bar can sit beside the cursor on Docs exactly as it does everywhere
 * else, which is what was asked for — and what anchoring to the page surface
 * could never do.
 */
export function caretRect(root: Document = document): DOMRect | undefined {
  for (const caret of root.querySelectorAll(".kix-cursor-caret")) {
    const box = caret.getBoundingClientRect();
    // Docs keeps carets for other people in a shared document, and parks
    // spent ones off-screen at zero height.
    if (box.height > 0 && box.top > 0) return box;
  }
  return undefined;
}

/**
 * The rectangle to anchor a control against when there is no caret.
 *
 * The text surface, not the editor region: `.kix-appview-editor` starts at
 * x=0 because it *contains* the outline panel, so anchoring to it put the
 * bar on top of the outline, 250 pixels from the nearest word — measured on
 * a real document, where a mimic page with no outline panel had passed.
 */
export function anchorRect(root: Document = document): DOMRect | undefined {
  const surface =
    root.querySelector(".kix-rotatingtilemanager") ??
    root.querySelector(".kix-appview-editor") ??
    root.querySelector('[role="document"]') ??
    editorTarget(root)?.ownerDocument.defaultView?.frameElement;
  const box = surface instanceof Element ? surface.getBoundingClientRect() : undefined;
  return box && (box.width || box.height) ? box : undefined;
}

/**
 * Type text into Docs by dispatching real keyboard input at its sink.
 *
 * `execCommand` and `setRangeText` both do nothing here — Docs only trusts
 * beforeinput/input events on the element it is listening to.
 */
export function insert(text: string): boolean {
  const target = editorTarget();
  if (!target) return false;
  target.focus();
  const view = target.ownerDocument.defaultView;
  if (!view) return false;

  const event = new view.InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: text,
  });
  target.dispatchEvent(event);
  if (event.defaultPrevented) return true;

  // Docs did not claim the event; fall back to the DOM path so a plain
  // contenteditable (Docs in a degraded mode, say) still receives the text.
  const selection = view.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!range) return false;
  range.deleteContents();
  range.insertNode(target.ownerDocument.createTextNode(text));
  target.dispatchEvent(new view.InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  return true;
}
