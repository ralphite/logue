import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipProvider } from "../components/Tooltip";

describe("Tooltip", () => {
  it("opens immediately for keyboard focus and closes with Escape", async () => {
    render(
      <TooltipProvider>
        <Tooltip content="Projects">
          <button type="button">Open projects</button>
        </Tooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Open projects" });
    fireEvent.focus(trigger);
    expect((await screen.findByRole("tooltip")).textContent).toContain("Projects");

    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("does not add tooltip behavior when disabled", () => {
    render(
      <TooltipProvider>
        <Tooltip content="Stream" disabled>
          <button type="button">Open stream</button>
        </Tooltip>
      </TooltipProvider>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Open stream" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
