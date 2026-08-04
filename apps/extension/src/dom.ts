import { hasLogueExtensionOptOut } from "./eligibility";

const supportedInputTypes = new Set(["text", "search", "email", "url", "tel"]);

export const googleDocsEditableSelector = 'div[contenteditable="true"][aria-label="Document content"], textarea[aria-label="Document content"]';

export function googleDocsEditableTarget(document: Document) {
  return document.querySelector<HTMLElement>(googleDocsEditableSelector);
}

/**
 * Google Docs keeps its editable text event target in a tiny same-origin
 * about:blank frame. It is currently a contenteditable div, while older Docs
 * versions use a textarea; both share the same target contract.
 */
export function isGoogleDocsDocumentTarget(value: EventTarget | null) {
  // The Docs text-event target crosses an about:blank frame boundary. Its DOM
  // constructor is not guaranteed to equal this script realm's
  // HTMLTextAreaElement, so use the shared selector instead of a cross-realm
  // instanceof gate.
  return Boolean(
    value && typeof value === "object" &&
    typeof (value as { matches?: unknown }).matches === "function" &&
    (value as Element).matches(googleDocsEditableSelector),
  );
}

/**
 * The Google Docs caret lives in a small event-target iframe. Its class is
 * stable in Docs, while the editable target check keeps the lookup resilient when
 * Docs changes incidental frame markup.
 */
export function googleDocsEditorFrame(document: Document) {
  const frames = [...document.querySelectorAll<HTMLIFrameElement>("iframe")];
  const active = document.activeElement;
  return (active instanceof HTMLIFrameElement ? active : undefined)
    ?? frames.find((frame) => frame.classList.contains("docs-texteventtarget-iframe"))
    ?? frames.find((frame) => {
      try {
        return isGoogleDocsDocumentTarget(frame.contentDocument?.activeElement ?? null)
          || Boolean(frame.contentDocument && googleDocsEditableTarget(frame.contentDocument));
      } catch {
        return false;
      }
    })
    ?? frames.find((frame) => frame.src === "about:blank");
}

/**
 * The hidden text-event iframe handles keyboard input, but it is not a visual
 * anchor. Keep the launcher inside the visible Docs editor surface instead.
 */
export function googleDocsEditorSurface(document: Document) {
  return document.querySelector<HTMLElement>(".kix-appview-editor")
    ?? googleDocsEditorFrame(document);
}

/**
 * Docs can keep keyboard focus inside its event-target frame without making
 * that iframe the parent document's activeElement. Check the real textarea as
 * well, so the top-frame launcher follows the actual editor focus.
 */
export function isGoogleDocsEditorFocused(document: Document) {
  const frame = googleDocsEditorFrame(document);
  if (!frame) return false;
  if (document.activeElement === frame) return true;
  try {
    return isGoogleDocsDocumentTarget(frame.contentDocument?.activeElement ?? null);
  } catch {
    return false;
  }
}

export function isEditableElement(value: EventTarget | null): value is HTMLElement {
  if (!(value instanceof HTMLElement)) return false;
  if (hasLogueExtensionOptOut(value)) return false;
  if (value instanceof HTMLTextAreaElement) return !value.disabled && !value.readOnly;
  if (value instanceof HTMLInputElement) {
    return supportedInputTypes.has(value.type) && !value.disabled && !value.readOnly;
  }
  return value.isContentEditable;
}

/** Finds an editor that was already focused before the content script mounted. */
export function activeEditableElement(document: Document): HTMLElement | undefined {
  const active = document.activeElement;
  return isEditableElement(active) ? active : undefined;
}

export function isEditableTargetAvailable(
  target: HTMLElement | null,
): target is HTMLElement {
  return Boolean(target?.isConnected && isEditableElement(target));
}

export function insertIntoElement(target: HTMLElement, text: string) {
  if (!target.isConnected) return false;

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    target.focus();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, "end");
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (target.isContentEditable) {
    const selection = window.getSelection();
    if (!selection) return false;
    const selectedRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
    const preservedRange = selectedRange && target.contains(selectedRange.commonAncestorContainer)
      ? selectedRange.cloneRange()
      : undefined;
    target.focus();
    selection.removeAllRanges();
    if (preservedRange) {
      selection.addRange(preservedRange);
    } else {
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      selection.addRange(range);
    }
    const inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
    if (!inserted && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return Boolean(inserted || target.contains(selection.anchorNode));
  }

  return false;
}

export function getEditableText(target: HTMLElement | null) {
  if (!target?.isConnected) return "";
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return target.value;
  }
  if (target.isContentEditable) return target.innerText || target.textContent || "";
  return "";
}
