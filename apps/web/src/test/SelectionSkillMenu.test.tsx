import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectionSkillMenu } from "@logue/ui";

// The first two skills get their own buttons; the rest live behind "More…".
const skills = [
  { id: "shorten", name: "Shorten" },
  { id: "expand", name: "Expand" },
  { id: "rewrite", name: "Rewrite" },
];

describe("SelectionSkillMenu", () => {
  it("preserves an editor selection through the real pointer sequence before opening", () => {
    const onDismiss = vi.fn();
    render(
      <SelectionSkillMenu
        anchor={{ left: 20, top: 20 }}
        skills={skills}
        onUseSkill={async () => undefined}
        onDismiss={onDismiss}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More…" });
    const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
    trigger.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);

    fireEvent.click(trigger);
    expect(screen.getByRole("menu", { name: "Choose a skill" })).toBeTruthy();
  });

  it("moves focus from its documented keyboard shortcut into the skills", async () => {
    render(
      <SelectionSkillMenu
        anchor={{ left: 20, top: 20 }}
        skills={skills}
        focusTrigger
        onUseSkill={async () => undefined}
        onDismiss={() => undefined}
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Shorten" }));

    const trigger = screen.getByRole("button", { name: "More…" });
    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Alt+Enter");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rewrite" })));
  });
});
