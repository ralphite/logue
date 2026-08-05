import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExtensionSurface } from "../v2-mock/extension/ExtensionSurface";
import { createStorySeed } from "../v2-mock/fixtures/storySeeds";
import { reduceMockSession } from "../v2-mock/model/reducer";
import { MockSessionProvider } from "../v2-mock/runtime/MockSessionProvider";
import { ContextReview } from "../v2-mock/web/ContextReview";

function addCanonicalComments() {
  fireEvent.click(screen.getByRole("button", { name: "Add voice comment" }));
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  fireEvent.click(screen.getByRole("button", { name: "Article B" }));
  fireEvent.click(screen.getByRole("button", { name: "Write comment" }));
  fireEvent.change(screen.getByPlaceholderText("Add your thought"), { target: { value: "Evidence review should feel immediate, not archival." } });
  fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
}

describe("V2 canonical sourced round trip", () => {
  it("submits Command once, opens frozen citations, inserts, and undoes", async () => {
    render(<ExtensionSurface seed="journey-start" />);
    addCanonicalComments();

    fireEvent.click(screen.getByRole("button", { name: "Email" }));
    fireEvent.click(screen.getByRole("button", { name: "Command" }));
    expect(screen.queryByText("Parse command")).toBeNull();
    expect(screen.queryByText("Generate draft")).toBeNull();
    const command = screen.getByRole("textbox", { name: "Voice command" });
    fireEvent.keyDown(command, { key: "Enter" });

    const draft = await screen.findByRole("textbox", { name: "Draft reply" });
    expect(screen.getByText("4 used · 2 cited")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open citation 1/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open citation 2/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Open citation 2/ }));
    expect(screen.getByRole("region", { name: "Citation source" })).toBeTruthy();
    expect(screen.getByText("This is the evidence we should carry into the decision.")).toBeTruthy();

    fireEvent.change(draft, { target: { value: "Edited sourced reply." } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Email reply" }) as HTMLTextAreaElement).value).toContain("Edited sourced reply."));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect((screen.getByRole("textbox", { name: "Email reply" }) as HTMLTextAreaElement).value).toBe("Hi Maya,");
  });

  it("keeps Shift+Enter local and Escape cancels without submitting", () => {
    render(<ExtensionSurface seed="journey-start" />);
    fireEvent.click(screen.getByRole("button", { name: "Email" }));
    const email = screen.getByRole("textbox", { name: "Email reply" });
    fireEvent.click(screen.getByRole("button", { name: "Command" }));
    const command = screen.getByRole("textbox", { name: "Voice command" });

    expect(screen.getByRole("status").textContent).toContain("Listening · Mobile research → Reply to Maya");
    fireEvent.change(command, { target: { value: "Using Mobile research,\ndraft a reply" } });
    fireEvent.keyDown(command, { key: "Enter", shiftKey: true });
    expect((command as HTMLTextAreaElement).value).toContain("\n");
    expect(screen.queryByRole("textbox", { name: "Draft reply" })).toBeNull();
    fireEvent.keyDown(command, { key: "Escape" });
    expect(screen.queryByRole("form", { name: "Voice Command launcher" })).toBeNull();
    expect(document.activeElement).toBe(email);
  });

  it("keeps the launcher and request available when the Project has no Sources", () => {
    render(<ExtensionSurface seed="journey-start" />);
    fireEvent.click(screen.getByRole("button", { name: "Email" }));
    fireEvent.click(screen.getByRole("button", { name: "Command" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Voice command" }), { key: "Enter" });

    expect(screen.getByRole("alert").textContent).toContain("has no Project Sources yet");
    expect(screen.getByRole("form", { name: "Voice Command launcher" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Draft reply" })).toBeNull();
  });

  it("recovers a target-lost Candidate through Copy and Logue Activity", async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.resolve() } });
    try {
      render(<ExtensionSurface seed="target-lost" />);
      fireEvent.click(screen.getByRole("button", { name: "Copy draft" }));
      await screen.findByRole("button", { name: "Copied" });
      fireEvent.click(screen.getByRole("button", { name: "Open in Logue" }));
      expect(screen.getByRole("heading", { name: "Recovered draft" })).toBeTruthy();
      expect(screen.getByText(/field notes support offline capture/)).toBeTruthy();
      expect(screen.getByText(/copied and adopted; outside Project Context/)).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
    }
  });

  it("keeps the target-lost Candidate when Copy fails", async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
    try {
      render(<ExtensionSurface seed="target-lost" />);
      fireEvent.click(screen.getByRole("button", { name: "Copy draft" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("still here"));
      expect(screen.getByRole("textbox", { name: "Draft reply" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open in Logue" })).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
    }
  });

  it("renders adopted lineage from shared state without inventing a Document", () => {
    let state = createStorySeed("journey-start");
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab", pageId: "article-a" });
    state = reduceMockSession(state, { type: "accept-voice-comment", transcript: "This is the evidence we should carry into the decision." });
    state = reduceMockSession(state, { type: "select-article", tabId: "research-tab", pageId: "article-b" });
    state = reduceMockSession(state, { type: "save-text-comment", tabId: "research-tab", text: "Evidence review should feel immediate, not archival." });
    state = reduceMockSession(state, { type: "submit-command", transcript: "Using Mobile research, draft a reply", inputMode: "voice", projectId: "project-a", targetSessionId: "email-target", contextSourceIds: Object.values(state.domain.memberships).filter((membership) => membership.projectId === "project-a" && membership.state === "added").map((membership) => membership.sourceId), idempotencyKey: "lineage-command" });
    const candidateId = state.surface.activeCandidateId!;
    state = reduceMockSession(state, { type: "insert-candidate", candidateId, targetSessionId: "email-target" });
    state = reduceMockSession(state, { type: "undo-target", targetSessionId: "email-target" });

    render(<MockSessionProvider initialState={state}><ContextReview initialTab="lineage" /></MockSessionProvider>);
    expect(screen.getByText("2 Web Sources")).toBeTruthy();
    expect(screen.getByText("2 You Sources")).toBeTruthy();
    expect(screen.getByText("Voice Command · revision 1")).toBeTruthy();
    expect(screen.getByText(/then undone; the adopted lineage remains/)).toBeTruthy();
    expect(screen.queryByText("Document revision")).toBeNull();
  });
});
