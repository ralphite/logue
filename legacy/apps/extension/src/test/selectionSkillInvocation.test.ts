import { describe, expect, it } from "vitest";
import { captureEditableSelection } from "@logue/ui";
import { selectionSkillInvocationState } from "../selectionSkillInvocation";

function textareaSelection() {
  const target = document.createElement("textarea");
  target.value = "Rewrite this text";
  document.body.append(target);
  target.focus();
  target.setSelectionRange(8, 12);
  const snapshot = captureEditableSelection(target);
  if (!snapshot) throw new Error("Expected a selection snapshot");
  return { target, snapshot };
}

describe("selection skill invocation", () => {
  it("keeps only the exact selection and target that started the run current", () => {
    const { target, snapshot } = textareaSelection();
    const invocation = { snapshot, target, pageHref: "https://example.com/editor" };

    expect(selectionSkillInvocationState({
      invocation,
      currentSnapshot: snapshot,
      currentTarget: target,
      currentPageHref: "https://example.com/editor",
    })).toBe("current");
  });

  it("treats Esc dismissal as cancellation so a late result cannot write", () => {
    const { target, snapshot } = textareaSelection();

    expect(selectionSkillInvocationState({
      invocation: { snapshot, target, pageHref: "https://example.com/editor" },
      currentSnapshot: undefined,
      currentTarget: target,
      currentPageHref: "https://example.com/editor",
    })).toBe("cancelled");
  });

  it("rejects a new selection, target, route, or detached editor", () => {
    const first = textareaSelection();
    const next = textareaSelection();
    const invocation = { snapshot: first.snapshot, target: first.target, pageHref: "https://example.com/editor" };

    expect(selectionSkillInvocationState({
      invocation,
      currentSnapshot: next.snapshot,
      currentTarget: first.target,
      currentPageHref: "https://example.com/editor",
    })).toBe("changed");
    expect(selectionSkillInvocationState({
      invocation,
      currentSnapshot: first.snapshot,
      currentTarget: next.target,
      currentPageHref: "https://example.com/editor",
    })).toBe("changed");
    expect(selectionSkillInvocationState({
      invocation,
      currentSnapshot: first.snapshot,
      currentTarget: first.target,
      currentPageHref: "https://example.com/another-route",
    })).toBe("changed");

    first.target.remove();
    expect(selectionSkillInvocationState({
      invocation,
      currentSnapshot: first.snapshot,
      currentTarget: first.target,
      currentPageHref: "https://example.com/editor",
    })).toBe("changed");
  });
});
