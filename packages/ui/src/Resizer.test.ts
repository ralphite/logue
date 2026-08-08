import { describe, expect, it } from "vitest";
import { clampSize } from "./Resizer";

describe("keeping a panel width usable", () => {
  it("stays inside the range", () => {
    expect(clampSize(150, 200, 320)).toBe(200);
    expect(clampSize(400, 200, 320)).toBe(320);
    expect(clampSize(240, 200, 320)).toBe(240);
  });

  it("rounds, so a drag never stores a fractional pixel", () => {
    expect(clampSize(240.6, 200, 320)).toBe(241);
  });

  /** A corrupt stored value must not collapse the panel to nothing. */
  it("falls back to the minimum for a value that is not a number", () => {
    expect(clampSize(Number.NaN, 200, 320)).toBe(200);
    expect(clampSize(Number.POSITIVE_INFINITY, 200, 320)).toBe(200);
  });
});
