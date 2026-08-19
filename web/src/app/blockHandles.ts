import type { EditorView } from "@codemirror/view";
import { EditorSelection, type EditorState } from "@codemirror/state";

/**
 * A block, as a person means it.
 *
 * Markdown has no block objects — it has lines — but nobody thinks of a
 * three-line list item and its wrapped text as three things. So a block is
 * the run of lines that move together: a paragraph up to its blank line, a
 * fenced code block including its fences, a list item including whatever is
 * nested under it, a table including every row.
 */
export interface Block {
  from: number;
  to: number;
  /** The first line's number, which is what the handle is drawn against. */
  line: number;
}

const FENCE = /^\s*(```|~~~)/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+/;
const TABLE_ROW = /^\s*\|/;

/** Where the block containing this position starts and ends. */
export function blockAt(state: EditorState, pos: number): Block {
  const line = state.doc.lineAt(pos);
  const text = (at: number) => state.doc.line(at).text;

  // A fence owns everything up to its closing fence, blank lines and all —
  // splitting a code block at a blank line would move half of someone's
  // function.
  const openedAt = fenceAround(state, line.number);
  if (openedAt) {
    return { from: state.doc.line(openedAt.from).from, to: state.doc.line(openedAt.to).to, line: openedAt.from };
  }

  if (TABLE_ROW.test(line.text)) {
    let first = line.number;
    let last = line.number;
    while (first > 1 && TABLE_ROW.test(text(first - 1))) first -= 1;
    while (last < state.doc.lines && TABLE_ROW.test(text(last + 1))) last += 1;
    return { from: state.doc.line(first).from, to: state.doc.line(last).to, line: first };
  }

  // A list item: this line if it carries the marker, else the marked line
  // above it, and then everything indented under it.
  let first = line.number;
  while (first > 1 && !ITEM.test(text(first)) && text(first).trim() && !isHeading(text(first))) {
    if (ITEM.test(text(first - 1)) || indentOf(text(first - 1)) < indentOf(text(first))) {
      first -= 1;
      continue;
    }
    if (!text(first - 1).trim()) break;
    first -= 1;
  }
  let last = first;
  if (ITEM.test(text(first))) {
    const own = indentOf(text(first));
    while (last < state.doc.lines) {
      const next = text(last + 1);
      if (!next.trim()) break;
      if (ITEM.test(next) && indentOf(next) <= own) break;
      if (!ITEM.test(next) && indentOf(next) <= own) break;
      last += 1;
    }
  } else {
    // A paragraph or a heading: to the blank line, or one line for a heading.
    if (isHeading(text(first))) {
      last = first;
    } else {
      while (last < state.doc.lines && text(last + 1).trim() && !ITEM.test(text(last + 1)) && !isHeading(text(last + 1))) {
        last += 1;
      }
    }
  }
  return { from: state.doc.line(first).from, to: state.doc.line(last).to, line: first };
}

function isHeading(text: string): boolean {
  return /^\s*#{1,6}\s/.test(text) || /^\s*(---|\*\*\*|___)\s*$/.test(text);
}

function indentOf(text: string): number {
  return /^\s*/.exec(text)?.[0].length ?? 0;
}

/** The fence this line is inside, counted from the top of the document. */
function fenceAround(state: EditorState, line: number): { from: number; to: number } | undefined {
  let open: number | undefined;
  for (let at = 1; at <= state.doc.lines; at += 1) {
    const text = state.doc.line(at).text;
    if (!FENCE.test(text)) continue;
    if (open === undefined) {
      open = at;
      continue;
    }
    if (line >= open && line <= at) return { from: open, to: at };
    open = undefined;
  }
  // An unclosed fence still owns the rest of the document.
  if (open !== undefined && line >= open) return { from: open, to: state.doc.lines };
  return undefined;
}

/** Every block in the document, in order — what a drag lands between. */
export function blocks(state: EditorState): Block[] {
  const found: Block[] = [];
  let at = 1;
  while (at <= state.doc.lines) {
    if (!state.doc.line(at).text.trim()) {
      at += 1;
      continue;
    }
    const block = blockAt(state, state.doc.line(at).from);
    found.push(block);
    at = state.doc.lineAt(block.to).number + 1;
  }
  return found;
}

/** Take a block out and put it back somewhere else. */
export function moveBlock(view: EditorView, from: Block, toLine: number): void {
  const { state } = view;
  const text = state.sliceDoc(from.from, from.to);
  const landing = state.doc.line(Math.max(1, Math.min(state.doc.lines, toLine)));
  if (landing.from >= from.from && landing.from <= from.to) return;

  // Cut first, then place — computed against the document as it will be, so a
  // block moving down does not land at a position the cut has shifted.
  const cutTo = Math.min(state.doc.length, from.to + 1);
  const above = landing.from < from.from;
  const anchor = above ? landing.from : landing.from - (cutTo - from.from);
  view.dispatch({
    changes: [
      { from: from.from, to: cutTo },
      { from: anchor, insert: `${text}\n` },
    ],
    selection: EditorSelection.cursor(anchor),
    userEvent: "move.block",
  });
}

/** Delete a block, the way its menu offers to. */
export function removeBlock(view: EditorView, block: Block): void {
  view.dispatch({
    changes: { from: block.from, to: Math.min(view.state.doc.length, block.to + 1) },
    userEvent: "delete.block",
  });
  view.focus();
}

/** A second copy directly below the first. */
export function duplicateBlock(view: EditorView, block: Block): void {
  const text = view.state.sliceDoc(block.from, block.to);
  view.dispatch({
    changes: { from: block.to, insert: `\n${text}` },
    selection: EditorSelection.cursor(block.to + 1),
    userEvent: "input.duplicate",
  });
  view.focus();
}

/** An empty line under this block, where the next thing goes. */
export function insertAfter(view: EditorView, block: Block): void {
  view.dispatch({
    changes: { from: block.to, insert: "\n" },
    selection: EditorSelection.cursor(block.to + 1),
    userEvent: "input",
  });
  view.focus();
}
