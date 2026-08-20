import { describe, expect, it } from "vitest";
import { aboveSelection, besideCaret, clamp } from "./position";

const viewport = { width: 1200, height: 800 };

describe("placing a floating control", () => {
  it("sits just below and beside the caret", () => {
    expect(besideCaret({ left: 400, top: 300, bottom: 318 }, viewport, 96, 32)).toEqual({ left: 410, top: 328 });
  });

  it("flips above the caret near the bottom of the viewport", () => {
    const placed = besideCaret({ left: 400, top: 770, bottom: 788 }, viewport, 96, 32);
    expect(placed.top).toBeLessThan(770);
  });

  it("never leaves the viewport", () => {
    expect(clamp({ left: 5000, top: -80 }, viewport, 200, 40)).toEqual({ left: 992, top: 8 });
  });

  it("centres a selection toolbar above the selection", () => {
    expect(aboveSelection({ left: 400, right: 600, top: 300, bottom: 320 }, viewport, 220, 32)).toEqual({
      left: 390,
      top: 258,
    });
  });

  it("drops below the selection when there is no room above", () => {
    const placed = aboveSelection({ left: 400, right: 600, top: 10, bottom: 30 }, viewport, 220, 32);
    expect(placed.top).toBeGreaterThan(30);
  });
});

describe("staying off the composer it is typed into", () => {
  const short = { top: 300, bottom: 342 };

  it("drops below a one-line field instead of covering its buttons", () => {
    const placed = besideCaret({ left: 400, top: 306, bottom: 336 }, viewport, 96, 32, short);
    expect(placed.top).toBe(352);
  });

  it("goes above the field when there is no room under it", () => {
    const low = { top: 720, bottom: 762 };
    const placed = besideCaret({ left: 400, top: 726, bottom: 756 }, viewport, 96, 32, low);
    expect(placed.top).toBe(678);
  });

  it("leaves a page-sized editor alone: the bar belongs beside the caret", () => {
    const page = { top: 100, bottom: 700 };
    const placed = besideCaret({ left: 400, top: 300, bottom: 318 }, viewport, 96, 32, page);
    expect(placed.top).toBe(328);
  });

  it("places the same as before when nothing says where the field is", () => {
    expect(besideCaret({ left: 400, top: 300, bottom: 318 }, viewport, 96, 32)).toEqual({ left: 410, top: 328 });
  });
})
