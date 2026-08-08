import { describe, expect, it } from "vitest";
import {
  documentSelectionSkillIsCurrent,
  hasCitationNumber,
  looksLikeMarkdown,
  markdownShortcutForPrefix,
  markdownToEditorHTML,
  reconcileDocumentCitations,
  removeSourceCitation,
  renumberCitationsAfterRemoval,
} from "../lib/documentEditing";
import { captureStableEditableSelection, replaceSelectionIfUnchanged } from "@logue/ui";

describe("document editing", () => {



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

  it("rejects a Skill result once the user moves the active document selection", () => {
    const editor = document.createElement("div");
    editor.textContent = "First selection and second selection";
    editor.setAttribute("contenteditable", "true");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.append(editor);
    const text = editor.firstChild!;
    const first = document.createRange();
    first.setStart(text, 0);
    first.setEnd(text, 15);
    Object.defineProperty(first, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 100, 20) });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(first);
    const snapshot = captureStableEditableSelection(editor);

    expect(snapshot && documentSelectionSkillIsCurrent(editor, snapshot)).toBe(true);

    const second = document.createRange();
    second.setStart(text, 20);
    second.setEnd(text, 36);
    Object.defineProperty(second, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 100, 20) });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(second);

    expect(snapshot && documentSelectionSkillIsCurrent(editor, snapshot)).toBe(false);
  });
});

describe("document Markdown editing", () => {
  it("renders common Markdown blocks and inline formatting", () => {
    expect(markdownToEditorHTML([
      "## Plan",
      "",
      "- First",
      "- **Second**",
      "",
      "> Keep it simple",
      "",
      "```ts",
      "const ready = true;",
      "```",
      "",
      "Read [the source](https://example.com).",
    ].join("\n"), "Plan")).toBe(
      '<h2>Plan</h2><p><br></p><ul><li>First</li><li><strong>Second</strong></li></ul><p><br></p><blockquote>Keep it simple</blockquote><p><br></p><pre><code>const ready = true;</code></pre><p><br></p><p>Read <a href="https://example.com" target="_blank" rel="noreferrer">the source</a>.</p>',
    );
  });

  it("maps Notion-style block shortcuts without adding toolbar noise", () => {
    expect(markdownShortcutForPrefix("##")).toEqual({ command: "formatBlock", value: "H2" });
    expect(markdownShortcutForPrefix("-")).toEqual({ command: "insertUnorderedList" });
    expect(markdownShortcutForPrefix("1.")).toEqual({ command: "insertOrderedList" });
    expect(markdownShortcutForPrefix("plain")).toBeUndefined();
  });

  it("recognizes rich or multiline Markdown while leaving plain text alone", () => {
    expect(looksLikeMarkdown("# Heading")).toBe(true);
    expect(looksLikeMarkdown("one\ntwo")).toBe(true);
    expect(looksLikeMarkdown("Read [this](https://example.com)")).toBe(true);
    expect(looksLikeMarkdown("ordinary sentence")).toBe(false);
  });
});
