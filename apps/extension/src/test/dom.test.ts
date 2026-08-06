import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureEditableSelection, captureStableEditableSelection, normalizeSelectionSkillReplacement, replaceSelectionIfUnchanged, saveSelectionSkillHistory, selectionSkillDismissalStillApplies, selectionSkillEligibility } from "@logue/ui";
import { activeEditableElement, googleDocsEditableTarget, googleDocsEditorFrame, googleDocsEditorSurface, insertIntoElement, insertIntoElementWithUndo, isEditableElement, isEditableTargetAvailable, isGoogleDocsDocumentTarget, isGoogleDocsEditorFocused } from "../dom";

describe("editable integration", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("never offers Logue on password fields", () => {
    const input = document.createElement("input");
    input.type = "password";
    expect(isEditableElement(input)).toBe(false);
  });

  it("recognizes an editor focused before the extension mounted", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    textarea.focus();

    expect(activeEditableElement(document)).toBe(textarea);
  });

  it("recognizes current and legacy Google Docs event targets without treating ordinary textareas specially", () => {
    const docsTarget = document.createElement("textarea");
    docsTarget.setAttribute("aria-label", "Document content");
    const currentDocsTarget = document.createElement("div");
    currentDocsTarget.setAttribute("contenteditable", "true");
    currentDocsTarget.setAttribute("aria-label", "Document content");
    const ordinary = document.createElement("textarea");

    expect(isGoogleDocsDocumentTarget(docsTarget)).toBe(true);
    expect(isGoogleDocsDocumentTarget(currentDocsTarget)).toBe(true);
    expect(isGoogleDocsDocumentTarget(ordinary)).toBe(false);
  });

  it("finds the current contenteditable Docs target", () => {
    const docsTarget = document.createElement("div");
    docsTarget.setAttribute("contenteditable", "true");
    docsTarget.setAttribute("aria-label", "Document content");
    document.body.append(docsTarget);

    expect(googleDocsEditableTarget(document)).toBe(docsTarget);
  });

  it("finds the Google Docs editor iframe", () => {
    const frame = document.createElement("iframe");
    frame.className = "docs-texteventtarget-iframe";
    document.body.append(frame);

    expect(googleDocsEditorFrame(document)).toBe(frame);
  });

  it("uses the visible Google Docs editor as the launcher surface", () => {
    const frame = document.createElement("iframe");
    frame.className = "docs-texteventtarget-iframe";
    const editor = document.createElement("div");
    editor.className = "kix-appview-editor";
    document.body.append(frame, editor);

    expect(googleDocsEditorSurface(document)).toBe(editor);
  });

  it("treats focus inside the Google Docs event iframe as editor focus", () => {
    const frame = document.createElement("iframe");
    frame.className = "docs-texteventtarget-iframe";
    document.body.append(frame);
    const docsTarget = frame.contentDocument!.createElement("textarea");
    docsTarget.setAttribute("aria-label", "Document content");
    frame.contentDocument!.body.append(docsTarget);
    docsTarget.focus();

    expect(isGoogleDocsEditorFocused(document)).toBe(true);
  });

  it("inserts at the current selection without submitting", () => {
    const form = document.createElement("form");
    const input = document.createElement("textarea");
    input.value = "hello world";
    form.append(input);
    document.body.append(form);
    input.setSelectionRange(6, 11);
    const submit = vi.fn();
    form.addEventListener("submit", submit);
    expect(insertIntoElement(input, "Logue")).toBe(true);
    expect(input.value).toBe("hello Logue");
    expect(submit).not.toHaveBeenCalled();
  });

  it("undoes only the unchanged local insertion", () => {
    const input = document.createElement("textarea");
    input.value = "hello world";
    document.body.append(input);
    input.setSelectionRange(6, 11);

    const transaction = insertIntoElementWithUndo(input, "Logue");
    expect(input.value).toBe("hello Logue");
    expect(transaction?.undo()).toBe(true);
    expect(input.value).toBe("hello world");

    const changed = insertIntoElementWithUndo(input, "!");
    input.value += " user edit";
    expect(changed?.undo()).toBe(false);
    expect(input.value).toBe("hello ! user edit");
  });

  it("replaces a contenteditable selection without sending its surrounding form", () => {
    const form = document.createElement("form");
    const richText = document.createElement("div");
    richText.textContent = "hello world";
    richText.setAttribute("contenteditable", "true");
    Object.defineProperty(richText, "isContentEditable", { value: true });
    form.append(richText);
    document.body.append(form);
    const range = document.createRange();
    range.setStart(richText.firstChild!, 6);
    range.setEnd(richText.firstChild!, 11);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const submit = vi.fn();
    form.addEventListener("submit", submit);
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });

    expect(insertIntoElement(richText, "Logue")).toBe(true);
    expect(richText.textContent).toBe("hello Logue");
    expect(submit).not.toHaveBeenCalled();
  });

  it("never writes into an unrelated selection when restoring a rich-text target", () => {
    const outside = document.createElement("p");
    outside.textContent = "outside";
    const richText = document.createElement("div");
    richText.textContent = "draft: ";
    richText.setAttribute("contenteditable", "true");
    Object.defineProperty(richText, "isContentEditable", { value: true });
    document.body.append(outside, richText);
    const range = document.createRange();
    range.selectNodeContents(outside);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });

    expect(insertIntoElement(richText, "voice")).toBe(true);
    expect(outside.textContent).toBe("outside");
    expect(richText.textContent).toBe("draft: voice");
  });

  it("fails closed when the original target left the page", () => {
    const input = document.createElement("textarea");
    expect(insertIntoElement(input, "draft")).toBe(false);
  });

  it("keeps ordinary textarea and contenteditable targets available", () => {
    const textarea = document.createElement("textarea");
    const richText = document.createElement("div");
    Object.defineProperty(richText, "isContentEditable", { value: true });
    document.body.append(textarea, richText);

    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(richText)).toBe(true);
  });

  it("captures and replaces exactly the original textarea selection", () => {
    const form = document.createElement("form");
    const textarea = document.createElement("textarea");
    textarea.value = "Rewrite this phrase.";
    form.append(textarea);
    document.body.append(form);
    textarea.focus();
    textarea.setSelectionRange(8, 12);
    const submit = vi.fn();
    form.addEventListener("submit", submit);

    const snapshot = captureEditableSelection(textarea);

    expect(snapshot?.text).toBe("this");
    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "that")).toBe(true);
    expect(textarea.value).toBe("Rewrite that phrase.");
    expect(submit).not.toHaveBeenCalled();
  });

  it("preserves every line in a textarea skill replacement", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Before selected text after";
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(7, 20);
    const snapshot = captureEditableSelection(textarea);

    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "first line\nsecond line\nthird line")).toBe(true);
    expect(textarea.value).toBe("Before first line\nsecond line\nthird line after");
  });

  it("keeps meaningful outer line breaks from a skill result", () => {
    expect(normalizeSelectionSkillReplacement("\r\nfirst\r\nsecond\r\n"))
      .toBe("\nfirst\nsecond\n");
    expect(normalizeSelectionSkillReplacement(" \n ")).toBeUndefined();
  });

  it("keeps a stable snapshot until the textarea selection is cleared", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Before selected text after";
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(7, 20);
    const snapshot = captureStableEditableSelection(textarea);

    expect(captureStableEditableSelection(textarea, snapshot)).toBe(snapshot);
    textarea.setSelectionRange(20, 20);
    expect(captureStableEditableSelection(textarea, snapshot)).toBeUndefined();
  });

  it("keeps an explicitly dismissed selection hidden until a new selection is made", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Before selected text after";
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(7, 20);
    const dismissed = captureStableEditableSelection(textarea);

    expect(selectionSkillDismissalStillApplies(dismissed, captureStableEditableSelection(textarea))).toBe(true);
    textarea.setSelectionRange(0, 6);
    expect(selectionSkillDismissalStillApplies(dismissed, captureStableEditableSelection(textarea))).toBe(false);
  });

  it("replaces a contenteditable selection without submitting its form", () => {
    const form = document.createElement("form");
    const editor = document.createElement("div");
    editor.textContent = "Rewrite this phrase.";
    editor.setAttribute("contenteditable", "true");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    form.append(editor);
    document.body.append(form);
    const range = document.createRange();
    range.setStart(editor.firstChild!, 8);
    range.setEnd(editor.firstChild!, 12);
    Object.defineProperty(range, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 100, 20) });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const submit = vi.fn();
    form.addEventListener("submit", submit);

    const snapshot = captureEditableSelection(editor);

    expect(snapshot?.text).toBe("this");
    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "that")).toBe(true);
    expect(editor.textContent).toBe("Rewrite that phrase.");
    expect(submit).not.toHaveBeenCalled();
  });

  it("preserves every line in a contenteditable skill replacement", () => {
    const editor = document.createElement("div");
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
    const snapshot = captureEditableSelection(editor);

    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "first line\nsecond line\nthird line")).toBe(true);
    expect(editor.innerHTML).toBe("<p>Before first line<br>second line<br>third line after</p>");
  });

  it("refuses to overwrite rich text after its captured selection changed", () => {
    const editor = document.createElement("div");
    editor.textContent = "Keep this safe.";
    editor.setAttribute("contenteditable", "true");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.append(editor);
    const range = document.createRange();
    range.setStart(editor.firstChild!, 5);
    range.setEnd(editor.firstChild!, 9);
    Object.defineProperty(range, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 100, 20) });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const snapshot = captureEditableSelection(editor);
    editor.firstChild!.textContent = "Keep that safe.";

    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "other")).toBe(false);
    expect(editor.textContent).toBe("Keep that safe.");
  });

  it("refuses to overwrite a textarea after its captured selection changed", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Keep this safe.";
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(5, 9);
    const snapshot = captureEditableSelection(textarea);
    textarea.setRangeText("that", 5, 9, "end");

    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "other")).toBe(false);
    expect(textarea.value).toBe("Keep that safe.");
  });

  it("offers only enabled selection-replacement skills on the active surface", () => {
    const skills = [
      { id: "selection", name: "Improve writing", enabled: true, task: "generate", output: "insert", surfaces: ["web", "extension"], contexts: ["selection"] },
      { id: "page", name: "Draft reply", enabled: true, task: "generate", output: "insert", surfaces: ["extension"], contexts: ["page"] },
      { id: "material", name: "Save material", enabled: true, task: "generate", output: "material", surfaces: ["extension"], contexts: ["selection"] },
      { id: "disabled", name: "Disabled", enabled: false, task: "generate", output: "insert", surfaces: ["extension"], contexts: ["selection"] },
    ];

    expect(selectionSkillEligibility(skills, "web").map((skill) => skill.id)).toEqual(["selection"]);
    expect(selectionSkillEligibility(skills, "extension").map((skill) => skill.id)).toEqual(["selection"]);
  });

  it("keeps a completed replacement retryable when provenance saving fails", async () => {
    const transaction = { runId: "run_123", replacement: "Rewritten text" };
    const failingAdoption = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(saveSelectionSkillHistory(transaction, failingAdoption)).resolves.toEqual(transaction);
    expect(failingAdoption).toHaveBeenCalledWith("run_123", "Rewritten text");

    await expect(saveSelectionSkillHistory(transaction, vi.fn().mockResolvedValue(undefined))).resolves.toBeUndefined();
  });

  it("honors a scoped DOM opt-out without disabling other editors", () => {
    const disabledArea = document.createElement("section");
    disabledArea.dataset.logueExtension = "disabled";
    const optedOut = document.createElement("textarea");
    const ordinary = document.createElement("textarea");
    disabledArea.append(optedOut);
    document.body.append(disabledArea, ordinary);

    expect(isEditableElement(optedOut)).toBe(false);
    expect(isEditableElement(ordinary)).toBe(true);
  });

  it("keeps a live target available across same-document route changes", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);

    expect(isEditableTargetAvailable(textarea)).toBe(true);

    textarea.readOnly = true;
    expect(isEditableTargetAvailable(textarea)).toBe(false);

    textarea.readOnly = false;
    textarea.remove();
    expect(isEditableTargetAvailable(textarea)).toBe(false);
  });
});
