import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenerationWorkspace } from "../components/GenerationWorkspace";

const { agent, secondAgent, run } = vi.hoisted(() => {
  const agent = {
    id: "agt_reply",
    name: "生成回复",
    purpose: "根据资料起草回复",
    instructions: "简洁回复",
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
    name: "自动整理",
    purpose: "自动归入项目和标签",
    task: "organize" as const,
    output: "material" as const,
    surfaces: ["background"] as const,
  };
  const run = {
    id: "run_one",
    agent_id: agent.id,
    agent_revision: 1,
    agent_name: agent.name,
    agent_instructions: agent.instructions,
    task: "generate" as const,
    output_type: "insert" as const,
    instruction: "根据资料起草一句回复",
    sources: [],
    original_output: "这是可继续编辑的结果。",
    status: "complete" as const,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-02T12:00:00Z",
  };
  return { agent, secondAgent, run };
});

vi.mock("../agentApi", () => ({
  getAgents: vi.fn().mockResolvedValue([agent, secondAgent]),
  getAgentRuns: vi.fn().mockResolvedValue([run]),
  createAgent: vi.fn(),
  createAgentRun: vi.fn(),
  updateAgent: vi.fn(),
  adoptAgentRun: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    getWorkspaceSettings: vi.fn(),
    saveWorkspaceSettings: vi.fn(),
  };
});

function renderWorkspace() {
  render(
    <GenerationWorkspace
      materials={[]}
      onModeChange={() => undefined}
      onSelectedDocumentChange={() => undefined}
      onOpenMaterials={() => undefined}
    />,
  );
}

describe("GenerationWorkspace mobile completeness", () => {
  it("keeps recent runs reachable after the desktop sidebar disappears", async () => {
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("button", { name: "最近" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "最近" }));
    const recentRuns = await screen.findByTestId("mobile-recent-runs");
    expect(within(recentRuns).getByText("根据资料起草一句回复")).toBeTruthy();

    fireEvent.click(within(recentRuns).getByRole("button", { name: /根据资料起草一句回复/ }));
    expect((await screen.findByRole("textbox", { name: "生成结果" }) as HTMLTextAreaElement).value).toBe("这是可继续编辑的结果。");
  });

  it("shows the Agent switcher throughout the collapsed-sidebar range", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /^Agent$/ }));

    const select = await screen.findByRole("combobox", { name: "选择 Agent" });
    expect(select.className).toContain("max-[900px]:block");
    fireEvent.change(select, { target: { value: secondAgent.id } });
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe(secondAgent.id));
  });
});
