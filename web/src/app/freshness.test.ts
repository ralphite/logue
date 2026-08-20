import { describe, expect, it } from "vitest";
import { swapVerdict } from "./freshness";

/**
 * When the page may trade itself for a newer build. The rule exists because
 * "nothing unsaved" alone let the swap fire between two autosaves — under
 * the hands, mid-sentence.
 */
describe("swapVerdict", () => {
  it("never swaps over unsaved words, watched or not", () => {
    expect(swapVerdict(true, true, 999_999)).toBe(false);
    expect(swapVerdict(true, false, 999_999)).toBe(false);
  });

  it("swaps at once when nobody is watching", () => {
    expect(swapVerdict(false, false, 0)).toBe(true);
  });

  it("waits while someone is right there, even with everything saved", () => {
    expect(swapVerdict(false, true, 0)).toBe(false);
    expect(swapVerdict(false, true, 119_000)).toBe(false);
  });

  it("goes once the hands have been off for two minutes", () => {
    expect(swapVerdict(false, true, 120_000)).toBe(true);
  });
});
