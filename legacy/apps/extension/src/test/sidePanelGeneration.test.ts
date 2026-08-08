import { describe, expect, it } from "vitest";
import { canInsertGeneratedText, generationTargetKey } from "../sidePanelGeneration";

const original = {
  tabId: 4,
  source: { url: "https://example.com/write", title: "Write", domain: "example.com" },
  targetText: "Draft reply",
  targetAvailable: true,
  selectionText: undefined,
};

describe("side panel generated reply target binding", () => {
  it("only permits insertion into the exact page and editor snapshot that produced the reply", () => {
    const resultTarget = generationTargetKey(original);

    expect(canInsertGeneratedText(original, resultTarget)).toBe(true);
    expect(canInsertGeneratedText({ ...original, targetText: "Changed reply" }, resultTarget)).toBe(false);
    expect(canInsertGeneratedText({ ...original, source: { ...original.source, url: "https://example.com/other" } }, resultTarget)).toBe(false);
    expect(canInsertGeneratedText({ ...original, tabId: 5 }, resultTarget)).toBe(false);
  });
});
