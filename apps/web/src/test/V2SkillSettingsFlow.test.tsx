import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockSessionProvider, useMockSession } from "../v2-mock/runtime/MockSessionProvider";
import { ProjectSkillSettings } from "../v2-mock/web/ProjectSkillSettings";
import { SkillSettings } from "../v2-mock/web/SkillSettings";

function StateProbe() {
  const { state } = useMockSession();
  const created = Object.values(state.domain.skills).filter((skill) => skill.id.startsWith("skill-") && /^skill-\d+$/.test(skill.id));
  return <output data-testid="settings-state">{JSON.stringify({ created: created.map((skill) => ({ id: skill.id, name: skill.name, archived: skill.archived, revisions: skill.revisionIds.length })), pinned: state.domain.pinnedSkillIds, hidden: state.domain.hiddenBuiltInSkillIds, bindings: state.domain.skillBindings })}</output>;
}

describe("V2 Skill Settings flow", () => {
  it("creates, revises, archives, and restores a My Skill", () => {
    render(<MockSessionProvider><SkillSettings initialView="My Skills" /><StateProbe /></MockSessionProvider>);
    fireEvent.click(screen.getByRole("button", { name: "New Skill" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Client brief" } });
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Turn evidence into a concise client brief." } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "generation" } });
    fireEvent.change(screen.getByLabelText("Instructions"), { target: { value: "Write a cited brief with three recommendations." } });
    fireEvent.click(screen.getByText("Advanced"));
    expect(screen.getByText("Ask or draft")).toBeTruthy();
    expect(screen.getByLabelText("Project Context")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create Skill" }));

    expect(screen.getByTestId("settings-state").textContent).toContain('"name":"Client brief"');
    expect(screen.getByTestId("settings-state").textContent).toContain('"revisions":1');
    const instruction = screen.getByLabelText("Instructions");
    fireEvent.change(instruction, { target: { value: "Write a cited brief with five recommendations." } });
    fireEvent.blur(instruction);
    expect(screen.getByTestId("settings-state").textContent).toContain('"revisions":2');

    const mySkills = screen.getByLabelText("My Skills");
    const row = within(mySkills).getByText("Client brief").closest(".v2-skill-row");
    expect(row).toBeTruthy();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Archive" }));
    expect(screen.queryByText("Client brief")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show archived" }));
    const archivedRow = within(screen.getByLabelText("My Skills")).getByText("Client brief").closest(".v2-skill-row");
    fireEvent.click(within(archivedRow as HTMLElement).getByRole("button", { name: "Restore" }));
    expect(screen.getByTestId("settings-state").textContent).toContain('"archived":false');
  });

  it("hides and duplicates a Built-in into My Skills", () => {
    render(<MockSessionProvider><SkillSettings initialView="Built-ins" /><StateProbe /></MockSessionProvider>);
    const translateRow = screen.getByText("Translate to Chinese").closest(".v2-skill-row");
    expect(translateRow).toBeTruthy();
    fireEvent.click(within(translateRow as HTMLElement).getByRole("button", { name: "Hide" }));
    expect(screen.getByTestId("settings-state").textContent).toContain('"skill-translate-zh"');
    fireEvent.click(within(translateRow as HTMLElement).getByRole("button", { name: "Show" }));
    expect(screen.getByTestId("settings-state").textContent).not.toContain('"hidden":["skill-translate-zh"]');
    fireEvent.click(within(translateRow as HTMLElement).getByRole("button", { name: "Duplicate" }));
    expect(screen.getByRole("tab", { name: "My Skills" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("settings-state").textContent).toContain('"name":"Translate to Chinese copy"');
  });

  it("changes a Global default immediately", () => {
    render(<MockSessionProvider><SkillSettings initialView="Global defaults" /><StateProbe /></MockSessionProvider>);
    fireEvent.change(screen.getByLabelText("Default for Page and selection"), { target: { value: "skill-translate-zh" } });
    expect(screen.getByTestId("settings-state").textContent).toContain('"global:page-selection":{"id":"global:page-selection","level":"global","category":"page-selection","skillId":"skill-translate-zh"}');
  });

  it("overrides and resets an inherited Project Skill", () => {
    render(<MockSessionProvider><ProjectSkillSettings projectId="project-b" onClose={() => undefined} /><StateProbe /></MockSessionProvider>);
    const picker = screen.getByLabelText("Page and selection for Q3 pricing decision") as HTMLSelectElement;
    expect(picker.value).toBe("skill-shorten");
    fireEvent.change(picker, { target: { value: "skill-explain" } });
    expect(picker.value).toBe("skill-explain");
    const row = picker.closest(".v2-project-skill-row");
    expect(within(row as HTMLElement).getByText(/^Override/)).toBeTruthy();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Reset" }));
    expect((screen.getByLabelText("Page and selection for Q3 pricing decision") as HTMLSelectElement).value).toBe("skill-shorten");
    expect(within(row as HTMLElement).getByText(/^Inherited/)).toBeTruthy();
  });
});
