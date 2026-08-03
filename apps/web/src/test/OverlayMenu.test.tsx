import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OverlayMenu, calculateOverlayMenuPosition } from "@logue/ui";

function MenuDemo({ onOpenChange = () => undefined }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button">Before</button>
      <OverlayMenu
        open={open}
        onOpenChange={(next) => { setOpen(next); onOpenChange(next); }}
        ariaLabel="Actions"
        trigger={(props) => <button type="button" {...props}>More</button>}
      >
        <button type="button" role="menuitem">Rename</button>
        <button type="button" role="menuitem">Duplicate</button>
        <button type="button" role="menuitem">Delete</button>
      </OverlayMenu>
      <button type="button">After</button>
    </div>
  );
}

describe("OverlayMenu", () => {
  it("closes on an outside pointer without moving focus back to the trigger", async () => {
    const onOpenChange = vi.fn();
    render(<MenuDemo onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menu", { name: "Actions" })).toBeTruthy();

    const after = screen.getByRole("button", { name: "After" });
    after.focus();
    fireEvent.pointerDown(after);

    await waitFor(() => expect(screen.queryByRole("menu", { name: "Actions" })).toBeNull());
    expect(document.activeElement).toBe(after);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("restores trigger focus on Escape", async () => {
    render(<MenuDemo />);
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" })));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Actions" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("supports the standard menu navigation keys", async () => {
    render(<MenuDemo />);
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" })));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  });

  it("moves Tab to the control after the trigger while closing the menu", async () => {
    render(<MenuDemo />);
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" })));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Tab" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Actions" })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("moves focus into an already click-opened menu with Arrow keys", async () => {
    render(<MenuDemo />);
    const trigger = screen.getByRole("button", { name: "More" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("menu", { name: "Actions" })).toBeTruthy());

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  });

  it("flips above and shifts away from the viewport edge", () => {
    expect(calculateOverlayMenuPosition({
      trigger: { left: 260, right: 292, top: 200, bottom: 232 },
      menu: { width: 150, height: 100 },
      placement: "bottom-end",
      viewportWidth: 300,
      viewportHeight: 240,
    })).toEqual({ left: 142, top: 94, maxHeight: 100 });
  });

  it("portals into the trigger ShadowRoot for extension styling and isolation", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadowRoot.append(container);
    const view = render(<MenuDemo />, { container });

    fireEvent.click(view.getByRole("button", { name: "More" }));
    await waitFor(() => expect(shadowRoot.querySelector('[role="menu"]')).toBeTruthy());
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    host.remove();
  });
});
