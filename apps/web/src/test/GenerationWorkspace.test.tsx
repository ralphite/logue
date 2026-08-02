import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationWorkspace, type GenerationMode } from "../components/GenerationWorkspace";

const { agent, secondAgent, createdAgent, documentItem, run, mocks } = vi.hoisted(() => {
  const agent = {
    id: "agt_reply",
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
  const secondAgent = {
    ...agent,
    id: "agt_organize",
    name: "Automatic organizer",
    purpose: "Assign projects and tags automatically",
    task: "organize" as const,
    output: "material" as const,
    surfaces: ["background"] as const,
  };
  const createdAgent = {
    ...agent,
    id: "agt_new",
    name: "Untitled agent",
    purpose: "",
    instructions: "",
    surfaces: ["web"] as const,
    contexts: [] as const,
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
    agent_id: agent.id,
    agent_revision: 1,
    agent_name: agent.name,
    agent_instructions: agent.instructions,
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
    agent,
    secondAgent,
    createdAgent,
    documentItem,
    run,
    mocks: {
      getAgents: vi.fn(),
      getAgentRuns: vi.fn(),
      getDocuments: vi.fn(),
      createAgent: vi.fn(),
      createAgentRun: vi.fn(),
      updateAgent: vi.fn(),
      adoptAgentRun: vi.fn(),
      documentGuard: vi.fn(),
    },
  };
});

vi.mock("../agentApi", () => ({
  getAgents: mocks.getAgents,
  getAgentRuns: mocks.getAgentRuns,
  createAgent: mocks.createAgent,
  createAgentRun: mocks.createAgentRun,
  updateAgent: mocks.updateAgent,
  adoptAgentRun: mocks.adoptAgentRun,
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    getDocuments: mocks.getDocuments,
    getWorkspaceSettings: vi.fn(),
    saveWorkspaceSettings: vi.fn(),
  };
});

vi.mock("../components/DocumentWorkspace", async () => {
  const React = await import("react");
  return {
    ViewWorkspace: ({ initialDocumentId, onLeaveGuardChange, showDocumentSidebar }: { initialDocumentId?: string; onLeaveGuardChange?: (guard?: () => Promise<boolean>) => void; showDocumentSidebar?: boolean }) => {
      React.useEffect(() => {
        onLeaveGuardChange?.(mocks.documentGuard);
        return () => onLeaveGuardChange?.(undefined);
      }, [onLeaveGuardChange]);
      return <main data-testid="document-workspace" data-document-id={initialDocumentId} data-show-sidebar={String(showDocumentSidebar)}>Document editor</main>;
    },
  };
});

beforeEach(() => {
  mocks.getAgents.mockReset().mockResolvedValue([agent, secondAgent]);
  mocks.getAgentRuns.mockReset().mockResolvedValue([run]);
  mocks.getDocuments.mockReset().mockResolvedValue([documentItem]);
  mocks.createAgent.mockReset().mockResolvedValue(createdAgent);
  mocks.createAgentRun.mockReset().mockResolvedValue(run);
  mocks.updateAgent.mockReset();
  mocks.adoptAgentRun.mockReset();
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
  it("keeps only Documents and Agents in the quiet navigation with independent 44px add actions", async () => {
    renderWorkspace();
    await waitFor(() => expect(mocks.getDocuments).toHaveBeenCalledTimes(1));

    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    expect(within(navigation).getByRole("button", { name: "Documents" })).toBeTruthy();
    expect(within(navigation).getByRole("button", { name: "Agents" })).toBeTruthy();
    expect(within(navigation).queryByRole("button", { name: "New" })).toBeNull();
    expect(within(navigation).queryByRole("button", { name: "Recent" })).toBeNull();
    const documentAdd = within(navigation).getByRole("button", { name: "New generation" });
    const agentAdd = within(navigation).getByRole("button", { name: "New agent" });
    expect(documentAdd.className).toContain("size-11");
    expect(agentAdd.className).toContain("size-11");
    for (const row of [documentAdd.parentElement, agentAdd.parentElement]) {
      expect(row?.className).toContain("flex h-11 w-full overflow-hidden rounded-lg");
    }
    expect(documentAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(agentAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(within(navigation).getByRole("button", { name: "Documents" }).getAttribute("aria-current")).toBeNull();
    expect(within(navigation).getByRole("button", { name: "Agents" }).getAttribute("aria-current")).toBeNull();
    const shell = screen.getByRole("complementary", { name: "Generate navigation" });
    expect(within(shell).getByRole("heading", { name: "Generate" }).closest("header")?.querySelector("button")).toBeNull();
  });

  it("refreshes each row list while keeping the shared shell mounted", async () => {
    renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByText(documentItem.title);

    fireEvent.click(within(navigation).getByRole("button", { name: "Documents" }));
    await waitFor(() => expect(mocks.getDocuments).toHaveBeenCalledTimes(2));
    const documentAdd = within(navigation).getByRole("button", { name: "New generation" });
    const agentAdd = within(navigation).getByRole("button", { name: "New agent" });
    expect(documentAdd.parentElement?.className).toContain("bg-[#e7e7e4]");
    expect(agentAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(screen.getByTestId("document-workspace").getAttribute("data-show-sidebar")).toBe("false");
    expect(screen.getByRole("complementary", { name: "Generate navigation" })).toBeTruthy();

    fireEvent.click(within(navigation).getByRole("button", { name: "Agents" }));
    await waitFor(() => expect(mocks.getAgents).toHaveBeenCalledTimes(2));
    expect(documentAdd.parentElement?.className).not.toContain("bg-[#e7e7e4]");
    expect(agentAdd.parentElement?.className).toContain("bg-[#e7e7e4]");
    expect((await screen.findByRole("textbox", { name: "Agent name" }) as HTMLInputElement).value).toBe(agent.name);
    expect(screen.getByRole("complementary", { name: "Generate navigation" })).toBeTruthy();
  });

  it("opens NewGeneration only from the Documents add action", async () => {
    renderWorkspace({ initialMode: "agents" });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByRole("textbox", { name: "Agent name" });

    fireEvent.click(within(navigation).getByRole("button", { name: "New generation" }));
    expect(await screen.findByRole("heading", { name: "What do you want to create?" })).toBeTruthy();
    expect(within(navigation).getByRole("button", { name: "Documents" }).getAttribute("aria-current")).toBeNull();
    expect(within(navigation).getByRole("button", { name: "Agents" }).getAttribute("aria-current")).toBeNull();
    const formColumn = screen.getByTestId("generation-form-content-column");
    for (const className of ["w-full", "max-w-[820px]", "px-[9%]", "max-[700px]:px-5"]) expect(formColumn.className).toContain(className);
  });

  it("creates a blank Agent without copying the selected Agent and opens it for editing", async () => {
    renderWorkspace({ initialMode: "agents" });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByRole("textbox", { name: "Agent name" });

    fireEvent.click(within(navigation).getByRole("button", { name: "New agent" }));

    await waitFor(() => expect(mocks.createAgent).toHaveBeenCalledWith({
      name: "Untitled agent",
      purpose: "",
      instructions: "",
      task: "generate",
      output: "insert",
      surfaces: ["web"],
      contexts: [],
      enabled: true,
    }));
    expect((await screen.findByRole("textbox", { name: "Agent name" }) as HTMLInputElement).value).toBe("Untitled agent");
    expect(screen.getByText("Custom agent")).toBeTruthy();
  });

  it("keeps the document editor open when its unsaved guard rejects a section switch", async () => {
    mocks.documentGuard.mockResolvedValue(false);
    const onModeChange = vi.fn();
    renderWorkspace({ initialMode: "documents", initialDocumentId: documentItem.id, onModeChange });
    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    await screen.findByTestId("document-workspace");

    fireEvent.click(within(navigation).getByRole("button", { name: "Agents" }));
    await waitFor(() => expect(mocks.documentGuard).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("document-workspace")).toBeTruthy();
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("keeps normal Agent autosave states quiet and uses the shared result axis", async () => {
    renderWorkspace({ initialMode: "agents" });
    const name = await screen.findByRole("textbox", { name: "Agent name" });
    for (const label of ["Saved", "Saving…", "Unsaved"]) expect(screen.queryByText(label)).toBeNull();
    fireEvent.change(name, { target: { value: "Edited agent" } });
    for (const label of ["Saved", "Saving…", "Unsaved"]) expect(screen.queryByText(label)).toBeNull();

    const navigation = screen.getByRole("navigation", { name: "Generate sections" });
    fireEvent.click(within(navigation).getByRole("button", { name: "New generation" }));
    await screen.findByRole("heading", { name: "What do you want to create?" });
    const instruction = screen.getByLabelText("Task");
    fireEvent.change(instruction, { target: { value: run.instruction } });
    await waitFor(() => expect((screen.getByLabelText("Agent") as HTMLSelectElement).value).toBe(agent.id));
    const generate = screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement;
    expect(generate.disabled).toBe(false);
    fireEvent.click(generate);
    await waitFor(() => expect(mocks.createAgentRun).toHaveBeenCalledTimes(1));

    await screen.findByRole("textbox", { name: "Generated result" });
    const resultHeader = screen.getByTestId("generation-result-header-column");
    const resultContent = screen.getByTestId("generation-result-content-column");
    for (const className of ["w-full", "max-w-[820px]", "px-[9%]", "max-[700px]:px-5"]) {
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

  it("shows the Agent switcher throughout the collapsed-sidebar range", async () => {
    renderWorkspace({ initialMode: "agents" });
    const select = await screen.findByRole("combobox", { name: "Choose agent" });
    expect(select.className).toContain("max-[900px]:block");
    fireEvent.change(select, { target: { value: secondAgent.id } });
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe(secondAgent.id));

    const editorHeader = screen.getByTestId("agent-editor-header-column");
    const editorContent = screen.getByTestId("agent-editor-content-column");
    for (const className of ["w-full", "max-w-[820px]", "px-[9%]", "max-[700px]:px-5"]) {
      expect(editorHeader.className).toContain(className);
      expect(editorContent.className).toContain(className);
    }
  });
});
