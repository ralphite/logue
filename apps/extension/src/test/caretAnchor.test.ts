import { describe, expect, it } from "vitest";
import { caretAnchorRect, caretWithinField, mirroredCaretRect } from "../caretAnchor";

describe("caret anchor", () => {
  const field = { left: 100, top: 200, right: 500, bottom: 320 };

  it("translates a mirrored caret into the field's own coordinates", () => {
    expect(mirroredCaretRect(
      { rect: field, scrollLeft: 0, scrollTop: 0 },
      { left: -9999, top: 0 },
      { left: -9955, top: 36, height: 18 },
      18,
    )).toEqual({ left: 144, top: 236, right: 144, bottom: 254 });
  });

  it("accounts for an editor scrolled past the caret", () => {
    expect(mirroredCaretRect(
      { rect: field, scrollLeft: 12, scrollTop: 40 },
      { left: -9999, top: 0 },
      { left: -9955, top: 36, height: 18 },
      18,
    )).toEqual({ left: 132, top: 196, right: 132, bottom: 214 });
  });

  it("falls back to the line height when the marker cannot be measured", () => {
    expect(mirroredCaretRect(
      { rect: field, scrollLeft: 0, scrollTop: 0 },
      { left: 0, top: 0 },
      { left: 0, top: 0, height: 0 },
      21,
    ).bottom).toBe(221);
  });

  it("keeps a caret scrolled out of view anchored on the visible field", () => {
    expect(caretWithinField({ left: 140, top: -60, right: 140, bottom: -42 }, field))
      .toEqual({ left: 140, top: 200, right: 140, bottom: 200 });
    expect(caretWithinField({ left: 900, top: 900, right: 900, bottom: 918 }, field))
      .toEqual({ left: 500, top: 320, right: 500, bottom: 320 });
  });

  it("reports no caret for a target that is not an editor", () => {
    const target = document.createElement("div");
    document.body.append(target);
    expect(caretAnchorRect(target)).toBeUndefined();
    expect(caretAnchorRect(undefined)).toBeUndefined();
    target.remove();
  });

  it("reports no caret for a detached editor", () => {
    expect(caretAnchorRect(document.createElement("textarea"))).toBeUndefined();
  });
});
