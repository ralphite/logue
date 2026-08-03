import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectionSkillMenu } from "@logue/ui";

describe("SelectionSkillMenu", () => {
  it("preserves an editor selection through the real pointer sequence before opening", () => {
    const onDismiss = vi.fn();
    render(
      <SelectionSkillMenu
        anchor={{ left: 20, top: 20 }}
        skills={[{ id: "shorten", name: "Shorten" }]}
        onUseSkill={async () => undefined}
        onDismiss={onDismiss}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Skills" });
    const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
    trigger.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);

    fireEvent.click(trigger);
    expect(screen.getByRole("menu", { name: "Choose a skill" })).toBeTruthy();
  });

  it("moves focus from its documented keyboard shortcut into the menu", async () => {
    render(
      <SelectionSkillMenu
        anchor={{ left: 20, top: 20 }}
        skills={[{ id: "shorten", name: "Shorten" }]}
        focusTrigger
        onUseSkill={async () => undefined}
        onDismiss={() => undefined}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Skills" });
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Alt+Enter");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Shorten" })));
  });
});
