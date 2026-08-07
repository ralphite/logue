import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Material } from "@logue/ui";
import { MaterialDetail } from "../components/MaterialDetail";

vi.mock("../api", () => ({
  captureAudioURL: (id: string) => `/v1/captures/${id}`,
  getProjects: vi.fn().mockResolvedValue([{ name: "Logue" }]),
}));

const material: Material = {
  id: "mat_one",
  kind: "text",
  status: "organized",
  content: "Editable original content",
  projects: ["Logue"],
  tags: ["voice-input"],
  createdAt: "2026-08-02T12:00:00Z",
  organization: {
    status: "needs_review",
    confidence: 0.58,
    reason: "Project assignment is ambiguous",
    suggested_projects: ["Logue"],
    suggested_tags: ["needs-review"],
  },
};

function renderDetail(overrides: Partial<Material> = {}, onUpdateContent = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MaterialDetail
      material={{ ...material, ...overrides }}
      mode="page"
      onClose={() => undefined}
      onExpand={() => undefined}
      onAddComment={vi.fn().mockResolvedValue(undefined)}
      onUpdateContent={onUpdateContent}
      onUpdateOrganization={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onOpenParent={() => undefined}
      parents={[]}
      dependents={[]}
    />,
  );
  return onUpdateContent;
}

describe("MaterialDetail", () => {
  it("lets the surrounding workspace control the peek width", () => {
    render(
      <MaterialDetail
        material={material}
        peekWidth={540}
        onClose={() => undefined}
        onExpand={() => undefined}
        onAddComment={vi.fn().mockResolvedValue(undefined)}
        onUpdateContent={vi.fn().mockResolvedValue(undefined)}
        onUpdateOrganization={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onOpenParent={() => undefined}
        parents={[]}
        dependents={[]}
      />,
    );

    expect(screen.getByTestId("material-detail-scroll").style.getPropertyValue("--material-detail-width")).toBe("540px");
  });

  it("uses one scroll surface and keeps reading content with its actions", () => {
    renderDetail();

    const pane = screen.getByTestId("material-detail-scroll");
    const scrollSurface = screen.getByTestId("material-detail-reading-column");
    const readingColumn = screen.getByTestId("material-detail-reading-column");
    const content = screen.getByTestId("material-detail-content");

    expect(scrollSurface.className).toContain("overflow-y-auto");
    expect(pane.className).toContain("overflow-hidden");
    expect(scrollSurface.contains(screen.getByRole("banner"))).toBe(false);
    expect(content.className).not.toContain("overflow-y-auto");
    expect(readingColumn.contains(content)).toBe(true);
    expect(readingColumn.contains(screen.getByLabelText("Add Comment"))).toBe(true);
    expect(readingColumn.contains(screen.getByRole("button", { name: "Delete this note" }))).toBe(true);
  });

  it("only highlights uncertain automatic organization", () => {
    const { unmount } = render(
      <MaterialDetail
        material={material}
        onClose={() => undefined}
        onExpand={() => undefined}
        onAddComment={vi.fn().mockResolvedValue(undefined)}
        onUpdateContent={vi.fn().mockResolvedValue(undefined)}
        onUpdateOrganization={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onOpenParent={() => undefined}
        parents={[]}
        dependents={[]}
      />,
    );
    expect(screen.getByLabelText("Needs review").textContent).toContain("Project assignment is ambiguous");
    expect(screen.getByLabelText("Needs review").textContent).toContain("Confidence 58%");
    expect(screen.getByLabelText("Needs review").textContent).toContain("#needs-review");
    unmount();

    renderDetail({ organization: { status: "organized", confidence: 0.94, reason: "Matched Logue" } });
    expect(screen.queryByLabelText("Needs review")).toBeNull();
  });

  it("formats material dates in English", () => {
    renderDetail();
    expect(screen.getByText("Aug 2")).toBeTruthy();
  });

  it("applies an uncertain suggestion only after review", async () => {
    const onUpdateOrganization = vi.fn().mockResolvedValue(undefined);
    render(
      <MaterialDetail
        material={{ ...material, projects: [], tags: [] }}
        mode="page"
        onClose={() => undefined}
        onExpand={() => undefined}
        onAddComment={vi.fn().mockResolvedValue(undefined)}
        onUpdateContent={vi.fn().mockResolvedValue(undefined)}
        onUpdateOrganization={onUpdateOrganization}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onOpenParent={() => undefined}
        parents={[]}
        dependents={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply suggestion" }));
    await waitFor(() => expect(onUpdateOrganization).toHaveBeenCalledWith("mat_one", ["Logue"], ["needs-review"]));
  });

  it("lets every material edit and save its content", async () => {
    const onUpdateContent = renderDetail();
    const editor = screen.getByRole("textbox", { name: "Edit material content" });
    fireEvent.change(editor, { target: { value: "Updated content" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onUpdateContent).toHaveBeenCalledWith("mat_one", "Updated content");
    });
  });

  it("keeps the draft visible when saving fails", async () => {
    renderDetail({}, vi.fn().mockRejectedValue(new Error("Could not save yet")));
    const editor = screen.getByRole("textbox", { name: "Edit material content" });
    fireEvent.change(editor, { target: { value: "Draft that must be preserved" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Could not save yet")).toBeTruthy();
    expect((editor as HTMLTextAreaElement).value).toBe("Draft that must be preserved");
  });
});
