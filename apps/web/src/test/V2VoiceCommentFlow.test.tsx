import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExtensionSurface } from "../v2-mock/extension/ExtensionSurface";
import { createStorySeed } from "../v2-mock/fixtures/storySeeds";

const acceptedComment = "This is the evidence we should carry into the decision.";

describe("V2 Selection Voice Comment flow", () => {
  it("starts directly from the selection and accepts with Enter", () => {
    render(<ExtensionSurface seed="journey-start" />);

    fireEvent.click(screen.getByRole("button", { name: "Add voice comment" }));
    const control = screen.getByLabelText("Comment on selected text");
    expect(within(control).getAllByRole("button")).toHaveLength(2);
    const accept = within(control).getByRole("button", { name: "Accept" });
    const cancel = within(control).getByRole("button", { name: "Cancel" });
    expect(accept.getAttribute("aria-keyshortcuts")).toBe("Enter");
    expect(cancel.getAttribute("aria-keyshortcuts")).toBe("Escape");
    expect(screen.queryByText("Stop")).toBeNull();
    expect(screen.queryByText("Link comment")).toBeNull();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Add voice comment" })).toBeTruthy();
    expect(screen.getByText(acceptedComment)).toBeTruthy();
  });

  it("cancels with Escape without showing a durable comment", () => {
    render(<ExtensionSurface seed="journey-start" />);

    fireEvent.click(screen.getByRole("button", { name: "Add voice comment" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Add voice comment" })).toBeTruthy();
    expect(screen.queryByText(acceptedComment)).toBeNull();
  });

  it("keeps the accepted bundle when reopening the same Project", () => {
    render(<ExtensionSurface seed="journey-start" />);

    fireEvent.click(screen.getByRole("button", { name: "Add voice comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project" }));

    expect(screen.getByRole("button", { name: "Back to browser" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sources used" })).toBeTruthy();
    expect(screen.getByText(acceptedComment)).toBeTruthy();
  });

  it("accepts without a Project and keeps the page bundle visible", () => {
    const state = createStorySeed("journey-start");
    state.domain.tabs["research-tab"].activeProjectId = null;
    render(<ExtensionSurface initialState={state} />);

    expect((screen.getByRole("combobox", { name: "Project for this tab" }) as HTMLSelectElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Add voice comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByText(acceptedComment)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open project" })).toBeNull();
  });
});
