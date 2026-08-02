import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { NavRail } from "../components/NavRail";

const { apiMocks, documentFixture } = vi.hoisted(() => ({
  apiMocks: { updateDocument: vi.fn() },
  documentFixture: {
    id: "document-1",
    title: "壳层验证文档",
    content: "验证正文",
    project: "Logue",
    source_ids: [] as string[],
    revision: 1,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-02T12:00:00Z",
  },
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    getDocuments: vi.fn().mockResolvedValue([documentFixture]),
    getMaterials: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockResolvedValue({
      ok: true,
      ai_configured: false,
      model: "",
      storage_root: "/tmp/logue-test",
    }),
    updateDocument: apiMocks.updateDocument,
  };
});

describe("application navigation shell", () => {
  beforeEach(() => {
    apiMocks.updateDocument.mockReset();
    window.history.replaceState(null, "", "/?view=docs&doc=document-1");
  });

  it("keeps the same ordered product navigation on desktop and mobile", () => {
    render(<NavRail active="views" connected onChange={() => undefined} />);

    const expectedLabels = ["资料流", "项目", "生成", "设置"];
    const desktopShell = screen.getByTestId("primary-navigation-shell");
    const desktopButtons = desktopShell.querySelectorAll("nav button");
    expect(Array.from(desktopButtons, (button) => button.textContent?.trim())).toEqual(expectedLabels);

    const mobileNav = screen.getByTestId("mobile-primary-navigation");
    const mobileButtons = mobileNav.querySelectorAll("button");
    expect(Array.from(mobileButtons, (button) => button.textContent?.trim())).toEqual(expectedLabels);
    expect(Array.from(mobileButtons).every((button) => button.className.includes("min-h-11"))).toBe(true);
  });

  it("renders documents inside the shared shell without another logo, primary nav, or connection state", async () => {
    const { container } = render(<App />);

    expect(screen.getAllByTestId("primary-navigation-shell")).toHaveLength(1);
    const documentSidebar = screen.getByTestId("document-sidebar");
    expect(within(documentSidebar).getByRole("textbox", { name: "搜索文档" }).getAttribute("placeholder")).toBe("搜索文档");
    expect(within(documentSidebar).queryByRole("navigation")).toBeNull();

    await waitFor(() => {
      const documentRow = documentSidebar.querySelector("button.group");
      expect(documentRow).not.toBeNull();
      expect(documentRow?.className).toContain("min-h-11");
    });

    expect(container.textContent).not.toContain("成果");
    expect(within(documentSidebar).queryByText("本机服务已连接")).toBeNull();
    expect(within(documentSidebar).queryByText("本机服务未连接")).toBeNull();
  });

  it("flushes a dirty document before the shared navigation leaves its section", async () => {
    apiMocks.updateDocument.mockResolvedValue({
      ...documentFixture,
      title: "保存后离开",
      revision: 2,
    });
    render(<App />);

    const titleInput = await screen.findByDisplayValue("壳层验证文档");
    fireEvent.change(titleInput, { target: { value: "保存后离开" } });
    fireEvent.click(within(screen.getByTestId("primary-navigation-shell")).getByRole("button", { name: "资料流" }));

    await waitFor(() => {
      expect(apiMocks.updateDocument).toHaveBeenCalledOnce();
      expect(window.location.search).toBe("?view=stream");
    });
    expect(apiMocks.updateDocument.mock.calls[0]?.[1]).toMatchObject({
      title: "保存后离开",
      expectedRevision: 1,
    });
  });
});
