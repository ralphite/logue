import { fireEvent, render, screen, within } from "@testing-library/react";
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
});
