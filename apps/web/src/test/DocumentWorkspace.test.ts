import { describe, expect, it } from "vitest";
import {
  availableSourcePanelWidth,
  defaultSourcePanelWidth,
  hasCitationNumber,
  reconcileDocumentCitations,
  removeSourceCitation,
  renumberCitationsAfterRemoval,
} from "../components/DocumentWorkspace";
import { availableMaterialDetailWidth, defaultMaterialDetailWidth } from "../App";
import { captureStableEditableSelection, replaceSelectionIfUnchanged } from "@logue/ui";

describe("document source provenance", () => {
  it("preserves a usable stream list while allowing a wide material panel", () => {
    expect(availableMaterialDetailWidth(1920, 253)).toBe(1107);
    expect(availableMaterialDetailWidth(1024, 253)).toBe(440);
    expect(defaultMaterialDetailWidth(1920, 253, 1107)).toBe(834);
  });

  it("preserves a usable editor while allowing the sources panel to grow", () => {
    expect(availableSourcePanelWidth(1280, 252)).toBe(467);
    expect(availableSourcePanelWidth(1280, 0)).toBe(719);
    expect(availableSourcePanelWidth(480, 252)).toBe(240);
  });

  it("defaults the sources panel to a compact, readable width", () => {
    expect(defaultSourcePanelWidth(1920, 1919)).toBe(320);
    expect(defaultSourcePanelWidth(900, 899)).toBe(320);
    expect(defaultSourcePanelWidth(900, 300)).toBe(300);
  });

  it("detects only the exact linked citation", () => {
    expect(hasCitationNumber("Evidence [Source 2]", 2)).toBe(true);
    expect(hasCitationNumber("Evidence [Source 20]", 2)).toBe(false);
    expect(hasCitationNumber("Evidence [Source2]", 2)).toBe(false);
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

  it("removes a source and every matching inline citation atomically", () => {
    expect(removeSourceCitation("First [Source 1]; second [Source 2], again [Source 2].", ["a", "b"], "a"))
      .toEqual({ content: "First; second [Source 1], again [Source 1].", sourceIds: ["b"] });
  });
});

describe("document selection skills", () => {
  it("keeps a multiline skill result as visible editor line breaks", () => {
    const editor = document.createElement("div");
    editor.className = "logue-view-editor";
    editor.innerHTML = "<p>Before selected text after</p>";
    editor.setAttribute("contenteditable", "true");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.append(editor);
    const text = editor.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 7);
    range.setEnd(text, 20);
    Object.defineProperty(range, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 100, 20) });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const snapshot = captureStableEditableSelection(editor);

    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "first line\nsecond line\nthird line")).toBe(true);
    expect(editor.innerHTML).toBe("<p>Before first line<br>second line<br>third line after</p>");
  });

  it("does not reopen the Skill menu from a stale document selection", () => {
    const editor = document.createElement("div");
    editor.textContent = "Before selected text after";
    editor.setAttribute("contenteditable", "true");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.append(editor);
    const range = document.createRange();
    range.setStart(editor.firstChild!, 7);
    range.setEnd(editor.firstChild!, 20);
    Object.defineProperty(range, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 100, 20) });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const snapshot = captureStableEditableSelection(editor);

    expect(captureStableEditableSelection(editor, snapshot)).toBe(snapshot);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(captureStableEditableSelection(editor, snapshot)).toBeUndefined();
  });
});
