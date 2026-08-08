/**
 * Reading and writing the page's own editors.
 *
 * Insertion goes through the browser's own editing commands wherever possible,
 * so the host app sees a normal edit and its undo stack keeps working.
 */

export type Editable = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "email", "tel", "password", ""]);

export function isEditable(node: unknown): node is Editable {
  if (node instanceof HTMLTextAreaElement) return !node.disabled && !node.readOnly;
  if (node instanceof HTMLInputElement) {
    return !node.disabled && !node.readOnly && TEXT_INPUT_TYPES.has(node.type);
  }
  // `?? false` because `isContentEditable` is missing in some DOM
  // implementations, and this function promises a boolean.
  return node instanceof HTMLElement && (node.isContentEditable ?? false);
}

/** The extension's own surfaces must never be treated as a target. */
export function isOurs(node: Node | null): boolean {
  return node instanceof Element && Boolean(node.closest("#logue-host"));
}

export function activeEditable(root: Document = document): Editable | undefined {
  const active = root.activeElement;
  if (!active || isOurs(active)) return undefined;
  // A focused element inside a shadow root reports its host here.
  const inner = active instanceof HTMLElement ? active.shadowRoot?.activeElement : null;
  const candidate = inner ?? active;
  return isEditable(candidate) ? candidate : undefined;
}

export function readValue(target: Editable): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
  return target.innerText || target.textContent || "";
}

/**
 * Insert at the caret. Returns what was there before, so the caller can undo
 * without depending on the host page's history.
 */
export function insertAtCaret(target: Editable, text: string): { undo: () => void } | undefined {
  if (!text) return undefined;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const before = target.value;
    const start = target.selectionStart ?? before.length;
    const end = target.selectionEnd ?? start;
    target.focus();
    target.setRangeText(text, start, end, "end");
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return {
      undo: () => {
        target.value = before;
        target.setSelectionRange(start, end);
        target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
      },
    };
  }

  target.focus();
  const before = target.innerHTML;
  // insertText keeps the host editor's own model in sync; writing innerHTML
  // directly makes rich editors like Notion lose the change on their next render.
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    if (!range) return undefined;
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }
  return {
    undo: () => {
      target.innerHTML = before;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
    },
  };
}

/**
 * Where the caret was, so it can be restored later.
 *
 * Focusing an element puts the caret at its start, which would insert a
 * transcript at the top of whatever the person was writing.
 */
export interface CaretPosition {
  start: number;
  end: number;
  range?: Range;
}

export function readCaret(target: Editable): CaretPosition | undefined {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return { start: target.selectionStart ?? 0, end: target.selectionEnd ?? 0 };
  }
  const selection = window.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  return target.contains(range.endContainer) ? { start: 0, end: 0, range: range.cloneRange() } : undefined;
}

export function restoreCaret(target: Editable, caret: CaretPosition | undefined): void {
  target.focus();
  if (!caret) return;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.setSelectionRange(caret.start, caret.end);
    return;
  }
  if (!caret.range) return;
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(caret.range);
}

export interface SelectionSnapshot {
  text: string;
  /** The paragraph the quote sits in, so a citation can be read in context. */
  context: string;
  rect: { left: number; right: number; top: number; bottom: number };
}

/** The block the selection belongs to, trimmed to something readable. */
function surroundingText(range: Range): string {
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;
  const block = element?.closest("p, li, blockquote, td, h1, h2, h3, h4, article, main") ?? element;
  const text = block instanceof HTMLElement ? block.innerText : "";
  return text.replace(/\s+/g, " ").trim().slice(0, 2000);
}

/** The current page selection, ignoring anything inside our own surfaces. */
export function pageSelection(): SelectionSnapshot | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return undefined;
  const text = selection.toString().trim();
  if (!text) return undefined;
  const range = selection.getRangeAt(0);
  if (isOurs(range.commonAncestorContainer) || isOurs(range.commonAncestorContainer.parentElement)) return undefined;
  const box = range.getBoundingClientRect();
  if (!box.width && !box.height) return undefined;
  return {
    text,
    context: surroundingText(range),
    rect: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
  };
}

export function pageSource() {
  return {
    url: location.href,
    title: document.title,
    domain: location.hostname,
  };
}
