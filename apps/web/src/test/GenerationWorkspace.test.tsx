import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationWorkspace, type WorkspaceSection } from "../components/GenerationWorkspace";

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
    ViewWorkspace: ({ initialDocumentId, onLeaveGuardChange, onOpenGenerate, showDocumentSidebar, documents = [] }: { initialDocumentId?: string; onLeaveGuardChange?: (guard?: () => Promise<boolean>) => void; onOpenGenerate?: () => void; showDocumentSidebar?: boolean; documents?: Array<{ id: string }> }) => {
      React.useEffect(() => {
        onLeaveGuardChange?.(mocks.documentGuard);
        return () => onLeaveGuardChange?.(undefined);
      }, [onLeaveGuardChange]);
      return <main data-testid="document-workspace" data-document-id={initialDocumentId} data-document-count={documents.length} data-show-sidebar={String(showDocumentSidebar)}>Document editor<button type="button" onClick={onOpenGenerate}>Open generation</button></main>;
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

function renderWorkspace({ initialMode = "documents", initialDocumentId, onModeChange = vi.fn(), onSelectedDocumentChange = vi.fn() }: { initialMode?: WorkspaceSection; initialDocumentId?: string; onModeChange?: (mode: WorkspaceSection) => void; onSelectedDocumentChange?: (id?: string, replace?: boolean) => void } = {}) {
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
  it("shows only the active top-level workspace and its local create action", async () => {
    renderWorkspace();
    await waitFor(() => expect(mocks.getDocuments).toHaveBeenCalledTimes(1));

    const shell = screen.getByRole("complementary", { name: "Documents navigation" });
    expect(within(shell).getByRole("heading", { name: "Documents" })).toBeTruthy();
    expect(within(shell).getByRole("button", { name: "New document" })).toBeTruthy();
    expect(within(shell).queryByRole("button", { name: "Skills" })).toBeNull();
    expect(within(shell).queryByText("Generate")).toBeNull();
  });

  it("shows Skills as a direct workspace without a duplicate Documents switch", async () => {
    renderWorkspace({ initialMode: "skills" });
    const shell = screen.getByRole("complementary", { name: "Skills navigation" });
    expect(within(shell).getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(within(shell).getByRole("button", { name: "New skill" })).toBeTruthy();
    expect(within(shell).queryByRole("button", { name: "Documents" })).toBeNull();
    expect((await screen.findByRole("textbox", { name: "Skill name" }) as HTMLInputElement).value).toBe(skill.name);
  });

  it("preserves the selected document and loaded lists across top-level workspace switches", async () => {
    const props = {
      materials: [],
      initialDocumentId: documentItem.id,
      onModeChange: vi.fn(),
      onSelectedDocumentChange: vi.fn(),
      onOpenMaterials: vi.fn(),
    };
    const { rerender } = render(<GenerationWorkspace {...props} initialMode="documents" />);
    expect((await screen.findByTestId("document-workspace")).getAttribute("data-document-id")).toBe(documentItem.id);

    rerender(<GenerationWorkspace {...props} initialMode="skills" initialDocumentId={undefined} />);
    expect(await screen.findByRole("textbox", { name: "Skill name" })).toBeTruthy();

    rerender(<GenerationWorkspace {...props} initialMode="documents" initialDocumentId={undefined} />);
    expect((await screen.findByTestId("document-workspace")).getAttribute("data-document-id")).toBe(documentItem.id);
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);
    expect(mocks.getSkills).toHaveBeenCalledTimes(1);
  });

  it("keeps the document list mounted when selecting another document", async () => {
    const secondDocument = { ...documentItem, id: "doc_two", title: "Research notes" };
    mocks.getDocuments.mockResolvedValue([documentItem, secondDocument]);
    const { onSelectedDocumentChange } = renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id });

    const list = screen.getByRole("complementary", { name: "Documents navigation" });
    const nextDocument = await within(list).findByRole("button", { name: /Research notes/ });
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);

    fireEvent.click(nextDocument);

    await waitFor(() => expect(onSelectedDocumentChange).toHaveBeenCalledWith(secondDocument.id));
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);
    expect(within(list).queryByLabelText("Loading documents")).toBeNull();
    expect(within(list).getByRole("button", { name: /Launch brief/ })).toBeTruthy();
  });

  it("searches the production Documents list without replacing its shell", async () => {
    const secondDocument = { ...documentItem, id: "doc_two", title: "Research notes", content: "Browser capture findings" };
    mocks.getDocuments.mockResolvedValue([documentItem, secondDocument]);
    renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id });

    const list = screen.getByRole("complementary", { name: "Documents navigation" });
    await within(list).findByRole("button", { name: /Research notes/ });
    const search = within(list).getByRole("textbox", { name: "Search documents" });

    fireEvent.change(search, { target: { value: "research" } });

    await waitFor(() => expect(within(list).queryByRole("button", { name: /Launch brief/ })).toBeNull());
    expect(within(list).getByRole("button", { name: /Research notes/ })).toBeTruthy();
    expect(screen.getByTestId("document-workspace")).toBeTruthy();
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);
  });

  it("creates and opens a real document from the Documents add action", async () => {
    renderWorkspace({ initialMode: "documents" });
    const navigation = screen.getByRole("complementary", { name: "Documents navigation" });
    await within(navigation).findByText(documentItem.title);

    fireEvent.click(within(navigation).getByRole("button", { name: "New document" }));
    await waitFor(() => expect(mocks.createDocument).toHaveBeenCalledWith({ title: "Untitled", project: undefined }));
    const workspace = await screen.findByTestId("document-workspace");
    expect(workspace.getAttribute("data-document-id")).toBe("doc_new");
    expect(workspace.getAttribute("data-document-count")).toBe("2");
    expect(within(navigation).getByRole("heading", { name: "Documents" })).toBeTruthy();
  });

  it("creates a blank Skill without copying the selected Skill and opens it for editing", async () => {
    renderWorkspace({ initialMode: "skills" });
    const navigation = screen.getByRole("complementary", { name: "Skills navigation" });
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
    const prompt = screen.getByRole("textbox", { name: "Skill prompt" });
    expect(prompt).toBeTruthy();
    expect(prompt.className).toContain("min-h-40");
    expect(prompt.className).toContain("[field-sizing:content]");
  });

  it("keeps normal Skill autosave states quiet and uses the shared result axis", async () => {
    renderWorkspace({ initialMode: "skills" });
    const name = await screen.findByRole("textbox", { name: "Skill name" });
    for (const label of ["Saved", "Saving…", "Unsaved"]) expect(screen.queryByText(label)).toBeNull();
    fireEvent.change(name, { target: { value: "Edited skill" } });
    for (const label of ["Saved", "Saving…", "Unsaved"]) expect(screen.queryByText(label)).toBeNull();

    renderWorkspace({ initialMode: "documents" });
    fireEvent.click(await screen.findByRole("button", { name: "Open generation" }));
    expect(screen.queryByRole("heading", { name: "What do you want to create?" })).toBeNull();
    const instruction = await screen.findByLabelText("Task");
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
  it("opens the active workspace list from the compact header", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));

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
