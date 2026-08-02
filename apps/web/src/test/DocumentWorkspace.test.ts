import { describe, expect, it } from "vitest";
import {
  hasCitationNumber,
  reconcileDocumentCitations,
  removeSourceCitation,
  renumberCitationsAfterRemoval,
} from "../components/DocumentWorkspace";

describe("document source provenance", () => {
  it("detects only the exact linked citation", () => {
    expect(hasCitationNumber("证据 [来源 2]", 2)).toBe(true);
    expect(hasCitationNumber("证据 [来源 20]", 2)).toBe(false);
  });

  it("renumbers later citations without changing earlier citations", () => {
    expect(renumberCitationsAfterRemoval("[来源 1] / [来源 3] / [来源 4]", 2))
      .toBe("[来源 1] / [来源 2] / [来源 3]");
    expect(renumberCitationsAfterRemoval("<mark>[来源 3]</mark>", 2))
      .toBe("<mark>[来源 2]</mark>");
  });

  it("drops uncited sources and compacts sparse citation numbers", () => {
    expect(reconcileDocumentCitations("证据 [来源 2]", ["a", "b"]))
      .toEqual({ content: "证据 [来源 1]", sourceIds: ["b"] });
  });

  it("removes a source and every matching inline citation atomically", () => {
    expect(removeSourceCitation("甲 [来源 1]；乙 [来源 2]，再见 [来源 2]。", ["a", "b"], "a"))
      .toEqual({ content: "甲；乙 [来源 1]，再见 [来源 1]。", sourceIds: ["b"] });
  });
});
