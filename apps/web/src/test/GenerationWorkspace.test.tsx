import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationWorkspace, type GenerationMode } from "../components/GenerationWorkspace";

const { skill, secondSkill, createdSkill, documentItem, run, mocks } = vi.hoisted(() => {
  const skill = {
    id: "sk_reply",
    name: "Reply writer",
    purpose: "Draft replies from materials",
    instructions: "Write concise replies",
    task: "generate" as const,
    output: "insert" as const,
    surfaces: ["web", "extension"] as const,
    contexts: ["materials"] as const,
    enabled: true,
    system: true,
    revision: 1,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-02T12:00:00Z",
  };
  const secondSkill = {
    ...skill,
    id: "sk_organize",
    name: "Automatic organizer",
    purpose: "Assign projects and tags automatically",
    task: "organize" as const,
    output: "material" as const,
    surfaces: ["background"] as const,
  };
  const createdSkill = {
    ...skill,
    id: "sk_new",
    name: "New skill",
    purpose: "Create a useful result from the selected context.",
    instructions: "Transform only the selected text. Preserve its meaning and formatting. Return only the replacement text.",
    surfaces: ["web", "extension"] as const,
    contexts: ["selection"] as const,
    system: false,
  };
  const documentItem = {
    id: "doc_one",
    title: "Launch brief",
    content: "Editable document",
    project: "Launch",
    source_ids: [],
    revision: 1,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-02T12:00:00Z",
  };
  const run = {
    id: "run_one",
    skill_id: skill.id,
    skill_revision: 1,
    skill_name: skill.name,
    skill_instructions: skill.instructions,
    task: "generate" as const,
    output_type: "insert" as const,
    instruction: "Draft one reply from these materials",
    sources: [],
    original_output: "This result remains editable.",
    status: "complete" as const,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-02T12:00:00Z",
  };
  return {
    skill,
    secondSkill,
    createdSkill,
    documentItem,
    run,
    mocks: {
      getSkills: vi.fn(),
      getSkillRuns: vi.fn(),
      getDocuments: vi.fn(),
      createSkill: vi.fn(),
      createDocument: vi.fn(),
      createSkillRun: vi.fn(),
      updateSkill: vi.fn(),
      adoptSkillRun: vi.fn(),
      documentGuard: vi.fn(),
    },
  };
});

vi.mock("../skillApi", () => ({
  getSkills: mocks.getSkills,
  getSkillRuns: mocks.getSkillRuns,
  createSkill: mocks.createSkill,
  defaultSkillPurpose: "Create a useful result from the selected context.",
  createSkillRun: mocks.createSkillRun,
  updateSkill: mocks.updateSkill,
  adoptSkillRun: mocks.adoptSkillRun,
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    createDocument: mocks.createDocument,
    getDocuments: mocks.getDocuments,
    getWorkspaceSettings: vi.fn(),
    saveWorkspaceSettings: vi.fn(),
  };
});

vi.mock("../components/DocumentWorkspace", async () => {
  const React = await import("react");
  return {
    ViewWorkspace: ({ initialDocumentId, onLeaveGuardChange, showDocumentSidebar, documents = [] }: { initialDocumentId?: string; onLeaveGuardChange?: (guard?: () => Promise<boolean>) => void; showDocumentSidebar?: boolean; documents?: Array<{ id: string }> }) => {
      React.useEffect(() => {
        onLeaveGuardChange?.(mocks.documentGuard);
        return () => onLeaveGuardChange?.(undefined);
      }, [onLeaveGuardChange]);
      return <main data-testid="document-workspace" data-document-id={initialDocumentId} data-document-count={documents.length} data-show-sidebar={String(showDocumentSidebar)}>Document editor</main>;
    },
  };
});

beforeEach(() => {
  mocks.getSkills.mockReset().mockResolvedValue([skill, secondSkill]);
  mocks.getSkillRuns.mockReset().mockResolvedValue([run]);
  mocks.getDocuments.mockReset().mockResolvedValue([documentItem]);
  mocks.createSkill.mockReset().mockResolvedValue(createdSkill);
  mocks.createDocument.mockReset().mockResolvedValue({ ...documentItem, id: "doc_new", title: "Untitled" });
  mocks.createSkillRun.mockReset().mockResolvedValue(run);
  mocks.updateSkill.mockReset();
  mocks.adoptSkillRun.mockReset();
  mocks.documentGuard.mockReset().mockResolvedValue(true);
});

function renderWorkspace({ initialMode = "new", initialDocumentId, onModeChange = vi.fn(), onSelectedDocumentChange = vi.fn() }: { initialMode?: GenerationMode; initialDocumentId?: string; onModeChange?: (mode: GenerationMode) => void; onSelectedDocumentChange?: (id?: string, replace?: boolean) => void } = {}) {
  render(
    <GenerationWorkspace
      materials={[]}
      initialMode={initialMode}
      initialDocumentId={initialDocumentId}
      onModeChange={onModeChange}
      onSelectedDocumentChange={onSelectedDocumentChange}
      onOpenMaterials={() => undefined}
    />,
  );
  return { onModeChange, onSelectedDocumentChange };
}

describe("GenerationWorkspace navigation", () => {
  it("keeps only Documents and Skills in the quiet navigation with independent 44px add actions", async () => {
    renderWorkspace();
    await waitFor(() => expect(mocks.getDocuments).toHaveBeenCalledTimes(1));

    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    expect(within(navigation).getByRole("button", { name: "Documents" })).toBeTruthy();
    expect(within(navigation).getByRole("button", { name: "Skills" })).toBeTruthy();
    expect(within(navigation).queryByRole("button", { name: "New" })).toBeNull();
    expect(within(navigation).queryByRole("button", { name: "Recent" })).toBeNull();
    const documentAdd = within(navigation).getByRole("button", { name: "New document" });
    const skillAdd = within(navigation).getByRole("button", { name: "New skill" });
    expect(documentAdd.className).toContain("size-11");
    expect(skillAdd.className).toContain("size-11");
    for (const row of [documentAdd.parentElement, skillAdd.parentElement]) {
      expect(row?.className).toContain("flex h-11 w-full overflow-hidden rounded-lg");
    }
    expect(documentAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(skillAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(within(navigation).getByRole("button", { name: "Documents" }).getAttribute("aria-current")).toBeNull();
    expect(within(navigation).getByRole("button", { name: "Skills" }).getAttribute("aria-current")).toBeNull();
    const shell = screen.getByRole("complementary", { name: "Generate navigation" });
    expect(within(shell).getByRole("heading", { name: "Generate" }).closest("header")?.querySelector("button")).toBeNull();
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile generate sections" });
    for (const label of ["Documents", "Skills"]) {
      const mobileSection = within(mobileNavigation).getByRole("button", { name: label });
      expect(mobileSection.textContent).toBe(label);
      expect(mobileSection.querySelector("svg")).toBeNull();
    }
  });

  it("switches row lists without replacing the shared shell or reloading the active list", async () => {
    renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByText(documentItem.title);

    fireEvent.click(within(navigation).getByRole("button", { name: "Documents" }));
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);
    const documentAdd = within(navigation).getByRole("button", { name: "New document" });
    const skillAdd = within(navigation).getByRole("button", { name: "New skill" });
    expect(documentAdd.parentElement?.className).toContain("bg-[#e7e7e4]");
    expect(skillAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(screen.getByTestId("document-workspace").getAttribute("data-show-sidebar")).toBe("false");
    expect(screen.getByRole("complementary", { name: "Generate navigation" })).toBeTruthy();

    fireEvent.click(within(navigation).getByRole("button", { name: "Skills" }));
    expect(mocks.getSkills).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(navigation).getByRole("button", { name: "New document" }).parentElement?.className).not.toContain("bg-[#e7e7e4]"));
    expect(within(navigation).getByRole("button", { name: "New skill" }).parentElement?.className).toContain("bg-[#e7e7e4]");
    expect((await screen.findByRole("textbox", { name: "Skill name" }) as HTMLInputElement).value).toBe(skill.name);
    expect(screen.getByRole("complementary", { name: "Generate navigation" })).toBeTruthy();
  });

  it("keeps the document list mounted when selecting another document", async () => {
    const secondDocument = { ...documentItem, id: "doc_two", title: "Research notes" };
    mocks.getDocuments.mockResolvedValue([documentItem, secondDocument]);
    const { onSelectedDocumentChange } = renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id });

    const list = screen.getByRole("complementary", { name: "Generate navigation" });
    const nextDocument = await within(list).findByRole("button", { name: /Research notes/ });
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);

    fireEvent.click(nextDocument);

    await waitFor(() => expect(onSelectedDocumentChange).toHaveBeenCalledWith(secondDocument.id));
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);
    expect(within(list).queryByLabelText("Loading documents")).toBeNull();
    expect(within(list).getByRole("button", { name: /Launch brief/ })).toBeTruthy();
  });

  it("creates and opens a real document from the Documents add action", async () => {
    renderWorkspace({ initialMode: "skills" });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByRole("textbox", { name: "Skill name" });

    fireEvent.click(within(navigation).getByRole("button", { name: "New document" }));
    await waitFor(() => expect(mocks.createDocument).toHaveBeenCalledWith({ title: "Untitled", project: undefined }));
    const workspace = await screen.findByTestId("document-workspace");
    expect(workspace.getAttribute("data-document-id")).toBe("doc_new");
    expect(workspace.getAttribute("data-document-count")).toBe("2");
    expect(within(navigation).getByRole("button", { name: "Documents" }).getAttribute("aria-current")).toBe("page");
  });

  it("creates a blank Skill without copying the selected Skill and opens it for editing", async () => {
    renderWorkspace({ initialMode: "skills" });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByRole("textbox", { name: "Skill name" });

    fireEvent.click(within(navigation).getByRole("button", { name: "New skill" }));

    await waitFor(() => expect(mocks.createSkill).toHaveBeenCalledWith({
      name: "New skill",
      purpose: "Create a useful result from the selected context.",
      instructions: "Transform only the selected text. Preserve its meaning and formatting. Return only the replacement text.",
      task: "generate",
      output: "insert",
      surfaces: ["web", "extension"],
      contexts: ["selection"],
      enabled: true,
    }));
    expect((await screen.findByRole("textbox", { name: "Skill name" }) as HTMLInputElement).value).toBe("New skill");
    expect(screen.getByRole("textbox", { name: "Skill prompt" })).toBeTruthy();
  });

  it("keeps the document editor open when its unsaved guard rejects a section switch", async () => {
    mocks.documentGuard.mockResolvedValue(false);
    const onModeChange = vi.fn();
    renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id, onModeChange });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByTestId("document-workspace");

    fireEvent.click(within(navigation).getByRole("button", { name: "Skills" }));
    await waitFor(() => expect(mocks.documentGuard).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("document-workspace")).toBeTruthy();
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("keeps normal Skill autosave states quiet and uses the shared result axis", async () => {
    renderWorkspace({ initialMode: "skills" });
    const name = await screen.findByRole("textbox", { name: "Skill name" });
    for (const label of ["Saved", "Saving…", "Unsaved"]) expect(screen.queryByText(label)).toBeNull();
    fireEvent.change(name, { target: { value: "Edited skill" } });
    for (const label of ["Saved", "Saving…", "Unsaved"]) expect(screen.queryByText(label)).toBeNull();

    renderWorkspace({ initialMode: "new" });
    expect(screen.queryByRole("heading", { name: "What do you want to create?" })).toBeNull();
    const instruction = screen.getByLabelText("Task");
    fireEvent.change(instruction, { target: { value: run.instruction } });
    await waitFor(() => expect((screen.getByLabelText("Skill") as HTMLSelectElement).value).toBe(skill.id));
    const generate = screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement;
    expect(generate.disabled).toBe(false);
    fireEvent.click(generate);
    await waitFor(() => expect(mocks.createSkillRun).toHaveBeenCalledTimes(1));

    await screen.findByRole("textbox", { name: "Generated result" });
    const resultHeader = screen.getByTestId("generation-result-header-column");
    const resultContent = screen.getByTestId("generation-result-content-column");
    for (const className of ["w-full", "max-w-[960px]", "px-8", "max-[640px]:px-5"]) {
      expect(resultHeader.className).toContain(className);
      expect(resultContent.className).toContain(className);
    }
    expect(screen.getByText("Copy", { selector: "button" })).toBeTruthy();
  });
});

describe("GenerationWorkspace mobile completeness", () => {
  it("opens the active section list from the mobile rows", async () => {
    renderWorkspace();
    const navigation = screen.getByRole("navigation", { name: "Mobile generate sections" });
    fireEvent.click(within(navigation).getByRole("button", { name: "Documents" }));

    const list = await screen.findByTestId("mobile-workspace-list");
    expect(within(list).getByText(documentItem.title)).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: /Launch brief/ }));
    expect(await screen.findByTestId("document-workspace")).toBeTruthy();
  });

  it("shows the Skill switcher throughout the collapsed-sidebar range", async () => {
    renderWorkspace({ initialMode: "skills" });
    const select = await screen.findByRole("combobox", { name: "Choose skill" });
    expect(select.className).toContain("max-[900px]:block");
    fireEvent.change(select, { target: { value: secondSkill.id } });
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe(secondSkill.id));

    const editorHeader = screen.getByTestId("skill-editor-header-column");
    const editorContent = screen.getByTestId("skill-editor-content-column");
    for (const className of ["w-full", "max-w-[960px]", "px-8", "max-[640px]:px-5"]) {
      expect(editorHeader.className).toContain(className);
      expect(editorContent.className).toContain(className);
    }
  });
});
