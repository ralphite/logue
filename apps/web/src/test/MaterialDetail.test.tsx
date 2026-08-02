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
  content: "可以修改的原始内容",
  projects: ["Logue"],
  tags: ["语音输入"],
  createdAt: "2026-08-02T12:00:00Z",
  organization: {
    status: "needs_review",
    confidence: 0.58,
    reason: "项目归属有歧义",
    suggested_projects: ["Logue"],
    suggested_tags: ["待整理"],
  },
};

function renderDetail(overrides: Partial<Material> = {}, onUpdateContent = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MaterialDetail
      material={{ ...material, ...overrides }}
      mode="page"
      onClose={() => undefined}
      onExpand={() => undefined}
      onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
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
        onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
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

    const scrollSurface = screen.getByTestId("material-detail-scroll");
    const readingColumn = screen.getByTestId("material-detail-reading-column");
    const content = screen.getByTestId("material-detail-content");

    expect(scrollSurface.className).toContain("overflow-y-auto");
    expect(content.className).not.toContain("overflow-y-auto");
    expect(readingColumn.contains(content)).toBe(true);
    expect(readingColumn.contains(screen.getByLabelText("追加批注"))).toBe(true);
    expect(readingColumn.contains(screen.getByRole("button", { name: "删除这条文字资料" }))).toBe(true);
  });

  it("only highlights uncertain automatic organization", () => {
    const { unmount } = render(
      <MaterialDetail
        material={material}
        onClose={() => undefined}
        onExpand={() => undefined}
        onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
        onUpdateContent={vi.fn().mockResolvedValue(undefined)}
        onUpdateOrganization={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onOpenParent={() => undefined}
        parents={[]}
        dependents={[]}
      />,
    );
    expect(screen.getByLabelText("需要确认").textContent).toContain("项目归属有歧义");
    expect(screen.getByLabelText("需要确认").textContent).toContain("Agent 置信度 58%");
    expect(screen.getByLabelText("需要确认").textContent).toContain("#待整理");
    unmount();

    renderDetail({ organization: { status: "organized", confidence: 0.94, reason: "匹配 Logue" } });
    expect(screen.queryByLabelText("需要确认")).toBeNull();
  });

  it("applies an uncertain Agent suggestion only after review", async () => {
    const onUpdateOrganization = vi.fn().mockResolvedValue(undefined);
    render(
      <MaterialDetail
        material={{ ...material, projects: [], tags: [] }}
        mode="page"
        onClose={() => undefined}
        onExpand={() => undefined}
        onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
        onUpdateContent={vi.fn().mockResolvedValue(undefined)}
        onUpdateOrganization={onUpdateOrganization}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onOpenParent={() => undefined}
        parents={[]}
        dependents={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "采用建议" }));
    await waitFor(() => expect(onUpdateOrganization).toHaveBeenCalledWith("mat_one", ["Logue"], ["待整理"]));
  });

  it("lets every material edit and save its content", async () => {
    const onUpdateContent = renderDetail();
    const editor = screen.getByRole("textbox", { name: "编辑资料内容" });
    fireEvent.change(editor, { target: { value: "修改后的内容" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onUpdateContent).toHaveBeenCalledWith("mat_one", "修改后的内容");
    });
  });

  it("keeps the draft visible when saving fails", async () => {
    renderDetail({}, vi.fn().mockRejectedValue(new Error("暂时无法保存")));
    const editor = screen.getByRole("textbox", { name: "编辑资料内容" });
    fireEvent.change(editor, { target: { value: "不能丢失的草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("暂时无法保存")).toBeTruthy();
    expect((editor as HTMLTextAreaElement).value).toBe("不能丢失的草稿");
  });
});
