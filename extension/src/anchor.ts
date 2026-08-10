/**
 * Finding a saved passage again, on a page that has moved on.
 *
 * A selection is kept as three strings: the words themselves, and a little of
 * what came before and after. Nothing about the page's structure is recorded —
 * no CSS path, no node index, no character offset — because those are what
 * break first. A site can be redesigned, re-rendered by a different framework,
 * or wrapped in one more div, and the sentence is still the same sentence.
 *
 * What this cannot survive is the text itself being edited or removed. That is
 * the honest limit, and it is why the snapshot is kept too: the words are in
 * the Source whether or not the page still has them.
 */

/** How much either side to remember. Long enough to tell two copies apart. */
const FLANK = 48;

export interface TextAnchor {
  /** The words, exactly as they were selected. */
  exact: string;
  /** What ran up to them, and what followed. */
  before: string;
  after: string;
  /** Where it was down the page when saved, 0…1 — a tie-breaker, never a locator. */
  progress?: number;
}

/** The page's text as one string, with a map back to where each character lives. */
function pageText(): { text: string; nodes: Text[]; starts: number[] } {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = "";
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Text)) continue;
    // Our own surfaces are not the page, and a script or style tag is not
    // words anyone selected.
    const parent = node.parentElement;
    if (!parent || parent.closest("#logue-host") || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
    const value = node.nodeValue ?? "";
    if (!value) continue;
    starts.push(text.length);
    nodes.push(node);
    text += value;
  }
  return { text, nodes, starts };
}

/** Whitespace differences are not differences: pages re-wrap, text does not. */
function loosely(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function anchorFor(range: Range): TextAnchor | undefined {
  const exact = loosely(range.toString());
  if (!exact) return undefined;
  const { text, nodes, starts } = pageText();
  const at = offsetOf(range.startContainer, range.startOffset, nodes, starts);
  if (at === undefined) return { exact, before: "", after: "" };
  return {
    exact,
    before: loosely(text.slice(Math.max(0, at - FLANK), at)),
    after: loosely(text.slice(at + range.toString().length, at + range.toString().length + FLANK)),
    progress: text.length ? Number((at / text.length).toFixed(4)) : 0,
  };
}

function offsetOf(container: Node, offset: number, nodes: Text[], starts: number[]): number | undefined {
  if (!(container instanceof Text)) return undefined;
  const node = container;
  const index = nodes.indexOf(node);
  const start = starts[index];
  return index === -1 || start === undefined ? undefined : start + offset;
}

export type Found = { range: Range; exactly: boolean } | undefined;

/**
 * Look for the anchored passage on this page.
 *
 * Tries the whole quote first. If the page has been edited around it, the
 * neighbours are what tell two identical sentences apart, so a quote that
 * appears more than once is resolved by whichever copy has the remembered
 * words beside it.
 */
export function locate(anchor: TextAnchor): Found {
  const { text, nodes, starts } = pageText();
  const flat = loosely(text);
  const needle = loosely(anchor.exact);
  if (!needle) return undefined;

  const hits: number[] = [];
  for (let at = flat.indexOf(needle); at !== -1; at = flat.indexOf(needle, at + 1)) hits.push(at);
  if (hits.length === 0) return undefined;

  let best = hits[0] ?? 0;
  if (hits.length > 1) {
    // More than one copy. Score each by how much of the remembered
    // surroundings it still has beside it, and take the best.
    let bestScore = -1;
    for (const at of hits) {
      const before = flat.slice(Math.max(0, at - FLANK), at);
      const after = flat.slice(at + needle.length, at + needle.length + FLANK);
      const score = overlap(before, anchor.before) + overlap(after, anchor.after);
      if (score > bestScore) {
        bestScore = score;
        best = at;
      }
    }
  }

  const range = rangeAt(best, needle.length, text, nodes, starts);
  return range ? { range, exactly: hits.length === 1 } : undefined;
}

/** How many characters the two ends share, counting from the join. */
function overlap(mine: string, remembered: string): number {
  if (!remembered) return 0;
  let same = 0;
  for (let i = 1; i <= Math.min(mine.length, remembered.length); i += 1) {
    if (mine.slice(-i) === remembered.slice(-i)) same = i;
  }
  return same;
}

/**
 * Turn an offset in the loosened text back into a Range in the real one.
 *
 * The loosening collapsed runs of whitespace, so the two strings do not line
 * up character for character. Walking both at once and stepping the raw index
 * past collapsed space is what keeps them in step.
 */
function rangeAt(looseAt: number, length: number, raw: string, nodes: Text[], starts: number[]): Range | undefined {
  let loose = 0;
  let rawStart = -1;
  let rawEnd = -1;
  let previousWasSpace = true;
  for (let i = 0; i < raw.length; i += 1) {
    const space = /\s/.test(raw[i] ?? "");
    if (space && previousWasSpace) continue;
    if (loose === looseAt && rawStart === -1) rawStart = i;
    loose += 1;
    previousWasSpace = space;
    if (loose === looseAt + length) {
      rawEnd = i + 1;
      break;
    }
  }
  if (rawStart === -1) return undefined;
  if (rawEnd === -1) rawEnd = raw.length;

  const point = (offset: number): { node: Text; at: number } | undefined => {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const start = starts[i];
      const node = nodes[i];
      if (start === undefined || node === undefined) continue;
      if (start <= offset) return { node, at: Math.min(offset - start, node.length) };
    }
    return undefined;
  };
  const from = point(rawStart);
  const to = point(rawEnd);
  if (!from || !to) return undefined;
  const range = document.createRange();
  range.setStart(from.node, from.at);
  range.setEnd(to.node, to.at);
  return range;
}

/**
 * Bring it on screen and mark it, so the eye lands where it should.
 *
 * `scrollIntoView`, not `window.scrollTo`. Plenty of pages — Logue's own app
 * among them — do not scroll the window at all; they scroll a panel inside it,
 * and moving the window then moves nothing. The browser knows which container
 * holds the element and will scroll whichever ones it has to.
 *
 * Selecting the passage is what marks it. It is the same highlight the person
 * made when they saved it, and it needs no styles of ours on someone else's
 * page.
 */
export function reveal(range: Range): void {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const start = range.startContainer;
  const element = start instanceof Element ? start : start.parentElement;
  element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}
