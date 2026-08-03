import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectPage } from "../components/ProjectPage";
import { SettingsPage } from "../components/SettingsPage";

const { project } = vi.hoisted(() => ({
  project: { name: "Alpha", overview: "Shared context", glossary: [], count: 0 },
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    getProjects: vi.fn().mockResolvedValue([project]),
    getDocuments: vi.fn().mockResolvedValue([]),
    getWorkspaceSettings: vi.fn().mockResolvedValue({ personal_context: "", glossary: [], ignored_terms: [] }),
    getGlossarySuggestions: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn(),
    saveWorkspaceSettings: vi.fn(),
  };
});

vi.mock("../agentApi", () => ({
  getAgents: vi.fn().mockResolvedValue([]),
  getAgentRuns: vi.fn().mockResolvedValue([]),
}));

const projectProps = {
  materials: [],
  onSelectedProjectChange: () => undefined,
  onOpenStream: () => undefined,
  onOpenMaterial: () => undefined,
  onOpenResults: () => undefined,
};

function expectSharedAxis(headerTestId: string, contentTestId: string, classes: string[]) {
  const header = screen.getByTestId(headerTestId);
  const content = screen.getByTestId(contentTestId);
  for (const className of classes) {
    expect(header.className).toContain(className);
    expect(content.className).toContain(className);
  }
}

describe("page column alignment", () => {
  const sharedEditorAxis = ["w-full", "max-w-[960px]", "px-8", "max-[640px]:px-5"];

  it("keeps the projects title and list on one responsive axis", () => {
    render(<ProjectPage {...projectProps} />);
    expectSharedAxis("projects-header-column", "projects-content-column", ["w-full", "max-w-[1080px]", "px-8", "max-[640px]:px-4"]);
  });

  it("keeps project list rows scannable and reserves overviews for project detail", async () => {
    render(<ProjectPage {...projectProps} />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());
    expect(screen.queryByText("Shared context")).toBeNull();
  });

  it("keeps project detail controls and content on one responsive axis", async () => {
    render(<ProjectPage {...projectProps} initialProject="Alpha" />);
    await waitFor(() => expect(screen.getByTestId("project-detail-header-column")).toBeTruthy());
    expectSharedAxis("project-detail-header-column", "project-detail-content-column", sharedEditorAxis);
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.queryByText("Saving…")).toBeNull();
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("keeps the settings title on the shared page axis and the form on the editor axis", () => {
    render(<SettingsPage />);
    const header = screen.getByTestId("settings-header-column");
    const content = screen.getByTestId("settings-content-column");
    for (const className of ["w-full", "max-w-[1080px]", "px-8", "max-[640px]:px-4"]) {
      expect(header.className).toContain(className);
    }
    for (const className of sharedEditorAxis) {
      expect(content.className).toContain(className);
    }
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.queryByText("Saving…")).toBeNull();
    expect(screen.queryByText("Unsaved")).toBeNull();
    expect(screen.getByText("Advanced").closest("details")?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("Developer tools").closest("details")?.hasAttribute("open")).toBe(false);
  });
});
