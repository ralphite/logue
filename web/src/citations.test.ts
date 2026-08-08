import { describe, expect, it } from "vitest";

/** The bracket forms models actually produce, pinned so the chips keep rendering. */
function citedNumbers(text: string): number[] {
  return text
    .split(/(\[Source[^\]]*\])/g)
    .filter((part) => /^\[Source[^\]]*\]$/.test(part))
    .flatMap((part) => [...part.matchAll(/\d+/g)].map((found) => Number(found[0])));
}

describe("citations in generated text", () => {
  it("reads the compact form", () => {
    expect(citedNumbers("Async wins [Source 3, 7].")).toEqual([3, 7]);
  });

  it("reads the repeated-label form the model produced in a real run", () => {
    expect(citedNumbers("链路 [Source 11, Source 16, Source 23]。")).toEqual([11, 16, 23]);
  });

  it("leaves prose alone", () => {
    expect(citedNumbers("No citation here.")).toEqual([]);
  });
});
