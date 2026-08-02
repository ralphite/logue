import { hasLogueExtensionOptOut } from "./eligibility";

const supportedInputTypes = new Set(["text", "search", "email", "url", "tel"]);

export function isEditableElement(value: EventTarget | null): value is HTMLElement {
  if (!(value instanceof HTMLElement)) return false;
  if (hasLogueExtensionOptOut(value)) return false;
  if (value instanceof HTMLTextAreaElement) return !value.disabled && !value.readOnly;
  if (value instanceof HTMLInputElement) {
    return supportedInputTypes.has(value.type) && !value.disabled && !value.readOnly;
  }
  return value.isContentEditable;
}

export function isEditableTargetAvailable(
  target: HTMLElement | null,
  focusedAtHref: string,
  currentHref: string,
): target is HTMLElement {
  return Boolean(target?.isConnected && focusedAtHref === currentHref && isEditableElement(target));
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
