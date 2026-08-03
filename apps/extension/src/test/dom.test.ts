import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureEditableSelection, replaceSelectionIfUnchanged, saveSelectionSkillHistory, selectionSkillEligibility } from "@logue/ui";
import { activeEditableElement, insertIntoElement, isEditableElement, isEditableTargetAvailable } from "../dom";

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
    const textarea = document.createElement("textarea");
    textarea.value = "Rewrite this phrase.";
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(8, 12);

    const snapshot = captureEditableSelection(textarea);

    expect(snapshot?.text).toBe("this");
    expect(snapshot && replaceSelectionIfUnchanged(snapshot, "that")).toBe(true);
    expect(textarea.value).toBe("Rewrite that phrase.");
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

  it("invalidates a target after removal, route change, or becoming readonly", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);

    expect(isEditableTargetAvailable(textarea, "https://example.com/a", "https://example.com/a")).toBe(true);
    expect(isEditableTargetAvailable(textarea, "https://example.com/a", "https://example.com/b")).toBe(false);

    textarea.readOnly = true;
    expect(isEditableTargetAvailable(textarea, "https://example.com/a", "https://example.com/a")).toBe(false);

    textarea.readOnly = false;
    textarea.remove();
    expect(isEditableTargetAvailable(textarea, "https://example.com/a", "https://example.com/a")).toBe(false);
  });
});
