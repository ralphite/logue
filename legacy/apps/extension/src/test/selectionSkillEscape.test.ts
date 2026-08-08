import { describe, expect, it } from "vitest";
import { shouldDismissSelectionSkills } from "../selectionSkillEscape";

function keydown(key: string, modifiers: Partial<KeyboardEvent> = {}) {
  return { key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers };
}

describe("selection skill Escape", () => {
  it("dismisses a live selection run with an unmodified Escape", () => {
    expect(shouldDismissSelectionSkills(keydown("Escape"), true, false)).toBe(true);
  });

  it("does not take shortcuts without a selection or during voice recording", () => {
    expect(shouldDismissSelectionSkills(keydown("Escape"), false, false)).toBe(false);
    expect(shouldDismissSelectionSkills(keydown("Escape"), true, true)).toBe(false);
    expect(shouldDismissSelectionSkills(keydown("Escape", { metaKey: true }), true, false)).toBe(false);
  });
});
