export type SelectionSkillSurface = "web" | "extension";

export interface SelectionSkillCandidate {
  id: string;
  name: string;
  enabled: boolean;
  task: string;
  output: string;
  surfaces: string[];
  contexts: string[];
}

export interface SelectionSkillAnchor {
  left: number;
  top: number;
}

/** A completed text replacement whose provenance record can safely be retried. */
export interface SelectionSkillApplyTransaction {
  runId: string;
  replacement: string;
}

export type EditableSelectionSnapshot =
  | {
    kind: "input";
    target: HTMLInputElement | HTMLTextAreaElement;
    start: number;
    end: number;
    text: string;
    anchor: SelectionSkillAnchor;
  }
  | {
    kind: "rich-text";
    target: HTMLElement;
    range: Range;
    text: string;
    anchor: SelectionSkillAnchor;
  };

export function selectionSkillEligibility<T extends SelectionSkillCandidate>(skills: T[], surface: SelectionSkillSurface) {
  return skills.filter((skill) => (
    skill.enabled &&
    skill.task === "generate" &&
    skill.output === "insert" &&
    skill.surfaces.includes(surface) &&
    skill.contexts.includes("selection")
  ));
}

function anchorFromRect(rect: DOMRect, fallback: DOMRect, bounds?: DOMRect): SelectionSkillAnchor {
  const menuWidth = 200;
  const minLeft = Math.max(8, bounds?.left ?? 8);
  const maxLeft = Math.max(
    minLeft,
    Math.min(window.innerWidth - menuWidth - 8, (bounds?.right ?? window.innerWidth) - menuWidth - 8),
  );
  const left = Math.max(minLeft, Math.min(maxLeft, rect.right || fallback.right - 40));
  const below = rect.bottom || fallback.bottom;
  const top = below + 8 + 40 > window.innerHeight ? Math.max(8, rect.top - 40) : below + 8;
  return { left, top };
}

export function captureEditableSelection(target: HTMLElement, menuBounds?: HTMLElement): EditableSelectionSnapshot | undefined {
  const bounds = menuBounds?.getBoundingClientRect();
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start === null || end === null || start === end) return undefined;
    const text = target.value.slice(start, end);
    if (!text.trim()) return undefined;
    return {
      kind: "input",
      target,
      start,
      end,
      text,
      anchor: anchorFromRect(target.getBoundingClientRect(), target.getBoundingClientRect(), bounds),
    };
  }
  if (!target.isContentEditable) return undefined;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !target.contains(range.commonAncestorContainer)) return undefined;
  const text = range.toString();
  if (!text.trim()) return undefined;
  return {
    kind: "rich-text",
    target,
    range: range.cloneRange(),
    text,
    anchor: anchorFromRect(range.getBoundingClientRect(), target.getBoundingClientRect(), bounds),
  };
}

export function editableSelectionSnapshotsMatch(
  first: EditableSelectionSnapshot | undefined,
  second: EditableSelectionSnapshot | undefined,
) {
  if (!first || !second || first.kind !== second.kind || first.target !== second.target || first.text !== second.text) return false;
  if (first.kind === "input" && second.kind === "input") {
    return first.start === second.start && first.end === second.end;
  }
  if (first.kind === "rich-text" && second.kind === "rich-text") {
    return first.range.startContainer === second.range.startContainer &&
      first.range.startOffset === second.range.startOffset &&
      first.range.endContainer === second.range.endContainer &&
      first.range.endOffset === second.range.endOffset;
  }
  return false;
}

/**
 * Repeated browser selection events must not manufacture a new invocation.
 * Keep the existing object while the selected DOM range is logically unchanged.
 */
export function captureStableEditableSelection(
  target: HTMLElement,
  current?: EditableSelectionSnapshot,
  menuBounds?: HTMLElement,
) {
  const next = captureEditableSelection(target, menuBounds);
  return editableSelectionSnapshotsMatch(current, next) ? current : next;
}

export async function saveSelectionSkillHistory(
  transaction: SelectionSkillApplyTransaction,
  adopt: (runId: string, replacement: string) => Promise<unknown>,
) {
  try {
    await adopt(transaction.runId, transaction.replacement);
    return undefined;
  } catch {
    return transaction;
  }
}

export function selectionSnapshotStillMatches(snapshot: EditableSelectionSnapshot) {
  if (!snapshot.target.isConnected) return false;
  if (snapshot.kind === "input") {
    return snapshot.target.value.slice(snapshot.start, snapshot.end) === snapshot.text;
  }
  return snapshot.target.contains(snapshot.range.commonAncestorContainer) && snapshot.range.toString() === snapshot.text;
}

export function replaceSelectionIfUnchanged(snapshot: EditableSelectionSnapshot, replacement: string) {
  if (!selectionSnapshotStillMatches(snapshot)) return false;
  const normalized = replacement.replace(/\r\n?/g, "\n");
  if (snapshot.kind === "input") {
    snapshot.target.focus({ preventScroll: true });
    snapshot.target.setRangeText(normalized, snapshot.start, snapshot.end, "end");
    snapshot.target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: normalized }));
    snapshot.target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  snapshot.target.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(snapshot.range);
  snapshot.range.deleteContents();
  const fragment = document.createDocumentFragment();
  let lastNode: Node | undefined;
  normalized.split("\n").forEach((line, index) => {
    if (index > 0) {
      lastNode = document.createElement("br");
      fragment.append(lastNode);
    }
    if (line || normalized.length === 0) {
      lastNode = document.createTextNode(line);
      fragment.append(lastNode);
    }
  });
  if (!lastNode) lastNode = fragment.appendChild(document.createTextNode(""));
  snapshot.range.insertNode(fragment);
  snapshot.range.setStartAfter(lastNode);
  snapshot.range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(snapshot.range);
  snapshot.target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: normalized }));
  return true;
}
