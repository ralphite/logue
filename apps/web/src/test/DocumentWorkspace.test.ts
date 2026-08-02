import { describe, expect, it } from "vitest";
import {
  availableSourcePanelWidth,
  hasCitationNumber,
  reconcileDocumentCitations,
  removeSourceCitation,
  renumberCitationsAfterRemoval,
} from "../components/DocumentWorkspace";

describe("document source provenance", () => {
  it("lets the sources panel use all space remaining after the document list", () => {
    expect(availableSourcePanelWidth(1280, 252)).toBe(1027);
    expect(availableSourcePanelWidth(480, 252)).toBe(240);
  });

  it("detects only the exact linked citation", () => {
    expect(hasCitationNumber("Evidence [Source 2]", 2)).toBe(true);
    expect(hasCitationNumber("Evidence [Source 20]", 2)).toBe(false);
  });

  it("renumbers later citations without changing earlier citations", () => {
    expect(renumberCitationsAfterRemoval("[Source 1] / [Source 3] / [Source 4]", 2))
      .toBe("[Source 1] / [Source 2] / [Source 3]");
    expect(renumberCitationsAfterRemoval("<mark>[Source 3]</mark>", 2))
      .toBe("<mark>[Source 2]</mark>");
  });

  it("drops uncited sources and compacts sparse citation numbers", () => {
    expect(reconcileDocumentCitations("Evidence [Source 2]", ["a", "b"]))
      .toEqual({ content: "Evidence [Source 1]", sourceIds: ["b"] });
  });

  it("normalizes legacy citation labels without losing linked sources", () => {
    const legacyLabel = "\u6765\u6e90";
    expect(reconcileDocumentCitations(`Evidence [${legacyLabel} 2]`, ["a", "b"]))
      .toEqual({ content: "Evidence [Source 1]", sourceIds: ["b"] });
  });

  it("removes a source and every matching inline citation atomically", () => {
    expect(removeSourceCitation("First [Source 1]; second [Source 2], again [Source 2].", ["a", "b"], "a"))
      .toEqual({ content: "First; second [Source 1], again [Source 1].", sourceIds: ["b"] });
  });
});
