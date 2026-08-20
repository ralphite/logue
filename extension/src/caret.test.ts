import { describe, expect, it } from "vitest";
import { caretRect, clampToField, fieldBox, fromMirror } from "./caret";

const field = { left: 100, top: 200, right: 500, bottom: 320 };

describe("caret anchoring", () => {
  it("translates a mirrored caret into the field's own coordinates", () => {
    expect(fromMirror({ rect: field, scrollLeft: 0, scrollTop: 0 }, { left: -9999, top: 0 }, { left: -9955, top: 36, height: 18 }, 18)).toEqual({
      left: 144,
      top: 236,
      right: 144,
      bottom: 254,
    });
  });

  it("accounts for an editor scrolled past the caret", () => {
    expect(fromMirror({ rect: field, scrollLeft: 12, scrollTop: 40 }, { left: -9999, top: 0 }, { left: -9955, top: 36, height: 18 }, 18)).toEqual({
      left: 132,
      top: 196,
      right: 132,
      bottom: 214,
    });
  });

  it("keeps a caret scrolled out of view anchored on the visible field", () => {
    expect(clampToField({ left: 140, top: -60, right: 140, bottom: -42 }, field)).toEqual({
      left: 140,
      top: 200,
      right: 140,
      bottom: 200,
    });
  });

  /** Notion's every new line is this case: an empty block in a full editor. */
  it("anchors a caret in an empty paragraph to that paragraph, not the editor corner", () => {
    // jsdom has no Range geometry, so stand in for a caret that measures
    // nothing — exactly what a real browser reports on an empty line.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const noRects = { length: 0, item: () => null } as unknown as DOMRectList;
    Range.prototype.getClientRects = () => noRects;
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

    const editor = document.createElement("div");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    const filled = document.createElement("p");
    filled.textContent = "The editor as a whole is not empty.";
    const empty = document.createElement("p");
    editor.append(filled, empty);
    document.body.append(editor);
    editor.getBoundingClientRect = () => new DOMRect(100, 100, 600, 400);
    empty.getBoundingClientRect = () => new DOMRect(120, 260, 560, 22);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(empty, 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(caretRect(editor)).toMatchObject({ left: 120, top: 260 });
    editor.remove();
  });

  it("reports no caret for something that is not an editor", () => {
    expect(caretRect(document.createElement("div"))).toBeUndefined();
    expect(caretRect(undefined)).toBeUndefined();
  });
});

/**
 * jsdom lays nothing out, so every rect here is stated. The shape is the one
 * measured on gemini.google.com on 2026-08-19: five wrappers with the field's
 * exact rect, then the pill that is actually drawn — wider than the text and
 * only 40px taller — then the page.
 */
/** Outermost first; the last rect is the field itself. */
function stack(rects: { left: number; top: number; right: number; bottom: number }[]) {
  let deepest: HTMLElement | undefined;
  let child: HTMLElement | undefined;
  for (const rect of rects.toReversed()) {
    const node = document.createElement("div");
    node.getBoundingClientRect = () =>
      new DOMRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
    if (child) node.append(child);
    else deepest = node;
    child = node;
  }
  if (child) document.body.append(child);
  if (!deepest) throw new Error("stack needs at least one rect");
  return deepest;
}

describe("the box the bar has to stay off", () => {
  it("walks past framework wrappers to the composer that is drawn", () => {
    const inner = { left: 623, top: 496, right: 1068, bottom: 520 };
    const composer = stack([
      { left: 0, top: 0, right: 1681, bottom: 1015 },
      { left: 623, top: 476, right: 1283, bottom: 540 },
      inner,
      inner,
      inner,
      inner,
      inner,
      inner,
    ]);
    expect(fieldBox(composer)).toEqual({ left: 623, top: 476, right: 1283, bottom: 540 });
  });

  it("stops before the page: an ancestor much taller than the field is not the field", () => {
    const inner = { left: 100, top: 100, right: 500, bottom: 140 };
    const composer = stack([
      { left: 0, top: 0, right: 1200, bottom: 900 },
      inner,
    ]);
    expect(fieldBox(composer)).toEqual(inner);
  });
});
