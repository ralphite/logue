import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { NavRail } from "../components/NavRail";

const { apiMocks, documentFixture } = vi.hoisted(() => ({
  apiMocks: { updateDocument: vi.fn() },
  documentFixture: {
    id: "document-1",
    title: "Shell test document",
    content: "Test body",
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
    window.localStorage.clear();
    window.history.replaceState(null, "", "/?view=docs&doc=document-1");
  });

  it("keeps the same ordered product navigation on desktop and mobile", () => {
    render(<NavRail active="views" connected onChange={() => undefined} />);

    const expectedLabels = ["Stream", "Projects", "Generate", "Settings"];
    const desktopShell = screen.getByTestId("primary-navigation-shell");
    const desktopButtons = desktopShell.querySelectorAll("nav button");
    expect(Array.from(desktopButtons, (button) => button.textContent?.trim())).toEqual(expectedLabels);

    const mobileNav = screen.getByTestId("mobile-primary-navigation");
    const mobileButtons = mobileNav.querySelectorAll("button");
    expect(Array.from(mobileButtons, (button) => button.textContent?.trim())).toEqual(expectedLabels);
    expect(Array.from(mobileButtons).every((button) => button.className.includes("min-h-11"))).toBe(true);
  });

  it("uses the same content column for the stream header and body", () => {
    window.history.replaceState(null, "", "/?view=stream");
    render(<App />);

    const axisClasses = (element: HTMLElement) => element.className
      .split(" ")
      .filter((name) => name === "w-full" || name.startsWith("max-w-[") || name === "px-8" || name === "max-[640px]:px-4");

    expect(axisClasses(screen.getByTestId("stream-header-column"))).toEqual([
      "w-full",
      "max-w-[1080px]",
      "px-8",
      "max-[640px]:px-4",
    ]);
    expect(axisClasses(screen.getByTestId("stream-content-column"))).toEqual(
      axisClasses(screen.getByTestId("stream-header-column")),
    );
  });

  it("collapses to an accessible icon rail without changing mobile navigation", () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <NavRail active="views" connected collapsed={false} onCollapsedChange={onCollapsedChange} onChange={() => undefined} />,
    );

    const collapseButton = screen.getByRole("button", { name: "Close sidebar" });
    expect(collapseButton.className).toContain("size-11");
    fireEvent.click(collapseButton);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);

    rerender(
      <NavRail active="views" connected collapsed onCollapsedChange={onCollapsedChange} onChange={() => undefined} />,
    );
    expect(screen.getByTestId("primary-navigation-shell").getAttribute("data-collapsed")).toBe("true");
    expect(screen.getByTestId("primary-navigation-shell").className).toContain("w-14");
    expect(screen.getByRole("button", { name: "Open sidebar" }).getAttribute("aria-expanded")).toBe("false");
    expect(within(screen.getByTestId("primary-navigation-shell")).getByRole("button", { name: "Stream" })).toBeTruthy();
    expect(screen.getByTestId("mobile-primary-navigation").textContent).toContain("Stream");
  });

  it("restores and updates the collapsed preference", async () => {
    window.localStorage.setItem("logue.navigation.collapsed", "true");
    render(<App />);

    const expandButton = screen.getByRole("button", { name: "Open sidebar" });
    expect(screen.getByTestId("primary-navigation-shell").getAttribute("data-collapsed")).toBe("true");
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(window.localStorage.getItem("logue.navigation.collapsed")).toBe("false");
    });
    expect(screen.getByRole("button", { name: "Close sidebar" })).toBeTruthy();
  });

  it("renders documents inside the shared shell without another logo, primary nav, or connection state", async () => {
    const { container } = render(<App />);

    expect(screen.getAllByTestId("primary-navigation-shell")).toHaveLength(1);
    const documentSidebar = screen.getByTestId("document-sidebar");
    expect(within(documentSidebar).getByRole("textbox", { name: "Search documents" }).getAttribute("placeholder")).toBe("Search documents");
    expect(within(documentSidebar).queryByRole("navigation")).toBeNull();

    await waitFor(() => {
      const documentRow = documentSidebar.querySelector("button.group");
      expect(documentRow).not.toBeNull();
      expect(documentRow?.className).toContain("min-h-11");
    });

    expect(container.textContent).not.toContain("Results");
    expect(within(documentSidebar).queryByText("Local service connected")).toBeNull();
    expect(within(documentSidebar).queryByText("Local service unavailable")).toBeNull();
  });

  it("flushes a dirty document before the shared navigation leaves its section", async () => {
    apiMocks.updateDocument.mockResolvedValue({
      ...documentFixture,
      title: "Saved before leaving",
      revision: 2,
    });
    render(<App />);

    const titleInput = await screen.findByDisplayValue("Shell test document");
    fireEvent.change(titleInput, { target: { value: "Saved before leaving" } });
    fireEvent.click(within(screen.getByTestId("primary-navigation-shell")).getByRole("button", { name: "Stream" }));

    await waitFor(() => {
      expect(apiMocks.updateDocument).toHaveBeenCalledOnce();
      expect(window.location.search).toBe("?view=stream");
    });
    expect(apiMocks.updateDocument.mock.calls[0]?.[1]).toMatchObject({
      title: "Saved before leaving",
      expectedRevision: 1,
    });
  });
});
