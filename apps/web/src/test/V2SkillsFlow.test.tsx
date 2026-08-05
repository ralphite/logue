import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectionActions } from "../v2-mock/extension/SelectionActions";
import { MockSessionProvider, useMockSession } from "../v2-mock/runtime/MockSessionProvider";

function StateProbe() {
  const { state } = useMockSession();
  const skillRuns = Object.values(state.domain.runs).filter((run) => run.skillId);
  const latest = skillRuns.at(-1);
  const candidate = latest?.candidateId ? state.domain.candidates[latest.candidateId] : undefined;
  return <output data-testid="skill-state">{JSON.stringify({ runCount: skillRuns.length, skillId: latest?.skillId, revisionId: latest?.skillRevisionId, resolution: latest?.skillResolution, status: candidate?.status, adoption: candidate?.adoption, activeCandidateId: state.surface.activeCandidateId })}</output>;
}

function renderSelection(scope: "selection" | "page" | "editable-selection" = "selection") {
  return render(<MockSessionProvider><SelectionActions scope={scope} /><StateProbe /></MockSessionProvider>);
}

describe("V2 Selection Skills flow", () => {
  it("runs a pinned built-in in one click and cancels without changing the page", () => {
    renderSelection();
    expect(screen.queryByText("Run Skill")).toBeNull();
    expect(screen.queryByText("Save as source")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Translate to Chinese" }));
    expect(screen.getByRole("complementary", { name: "Skill result" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByTestId("skill-state").textContent).toContain('"skillId":"skill-translate-zh"');
    expect(screen.getByTestId("skill-state").textContent).toContain('"revisionId":"skill-translate-zh-r1"');

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("complementary", { name: "Skill result" })).toBeNull();
    expect(screen.getByTestId("skill-state").textContent).toContain('"status":"dismissed"');
    expect(screen.getByText("Participants returned to notes when preparing decisions, not while browsing.")).toBeTruthy();
  });

  it("runs a My Skill from More Skills immediately with no second Run", () => {
    renderSelection("page");
    fireEvent.click(screen.getByRole("button", { name: /More Skills/ }));
    const picker = screen.getByRole("dialog", { name: "More Skills" });
    fireEvent.click(within(picker).getByRole("button", { name: /Decision signal/ }));

    expect(screen.queryByRole("dialog", { name: "More Skills" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Decision signal" })).toBeTruthy();
    expect(screen.getByTestId("skill-state").textContent).toContain('"runCount":1');
    expect(screen.getByTestId("skill-state").textContent).toContain('"skillId":"skill-decision-signal"');
    expect(screen.getByTestId("skill-state").textContent).toContain('"resolution":"explicit"');
  });

  it("runs the concrete Project default in one click and records its source", () => {
    renderSelection();
    fireEvent.click(screen.getByRole("button", { name: "Decision signal" }));
    expect(screen.getByRole("heading", { name: "Decision signal" })).toBeTruthy();
    expect(screen.getByTestId("skill-state").textContent).toContain('"resolution":"project"');
    expect(screen.getByTestId("skill-state").textContent).toContain('"revisionId":"skill-decision-signal-r2"');
  });

  it("replaces an editable selection and exposes one local Undo", () => {
    renderSelection("editable-selection");
    fireEvent.click(screen.getByRole("button", { name: "Shorten" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    expect(screen.getAllByText("People revisit notes when making decisions.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Undo replace" })).toBeTruthy();
    expect(screen.getByTestId("skill-state").textContent).toContain('"adoption":"replace"');

    fireEvent.click(screen.getByRole("button", { name: "Undo replace" }));
    expect(screen.getByText("Participants returned to notes when preparing decisions, not while browsing.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
  });

  it("keeps an adopted replacement when another Skill starts", () => {
    renderSelection("editable-selection");
    fireEvent.click(screen.getByRole("button", { name: "Shorten" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    fireEvent.click(screen.getByRole("button", { name: "Translate to Chinese" }));

    expect(screen.getByText("People revisit notes when making decisions.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Translate to Chinese" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("People revisit notes when making decisions.")).toBeTruthy();
  });

  it("keeps the Candidate available when Copy fails", async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
    try {
      renderSelection();
      fireEvent.click(screen.getByRole("button", { name: "Translate to Chinese" }));
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Couldn’t copy"));
      expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
      expect(screen.getByTestId("skill-state").textContent).toContain('"status":"ready"');
    } finally {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
    }
  });

  it("closes More Skills and a ready result with Escape, restoring focus", async () => {
    renderSelection();
    const more = screen.getByRole("button", { name: /More Skills/ });
    more.focus();
    fireEvent.click(more);
    expect(screen.getByRole("dialog", { name: "More Skills" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(more));
    expect(screen.queryByRole("dialog", { name: "More Skills" })).toBeNull();

    const trigger = screen.getByRole("button", { name: "Translate to Chinese" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("complementary", { name: "Skill result" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Skill result" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("closes only More Skills when a Candidate is already open", async () => {
    renderSelection();
    fireEvent.click(screen.getByRole("button", { name: "Translate to Chinese" }));
    fireEvent.click(screen.getByRole("button", { name: /More Skills/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More Skills" })).toBeNull());
    expect(screen.getByRole("complementary", { name: "Skill result" })).toBeTruthy();
  });
});
