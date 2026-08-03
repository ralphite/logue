import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { NavRail } from "../components/NavRail";

const { apiMocks, documentFixture } = vi.hoisted(() => ({
  apiMocks: { getMaterials: vi.fn(), getStatus: vi.fn(), searchMaterials: vi.fn(), updateDocument: vi.fn() },
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
    getMaterials: apiMocks.getMaterials,
    getStatus: apiMocks.getStatus,
    searchMaterials: apiMocks.searchMaterials,
    updateDocument: apiMocks.updateDocument,
  };
});

describe("application navigation shell", () => {
  beforeEach(() => {
    apiMocks.getMaterials.mockReset().mockResolvedValue([]);
    apiMocks.getStatus.mockReset().mockResolvedValue({
      ok: true,
      ai_configured: false,
      model: "",
      storage_root: "/tmp/logue-test",
    });
    apiMocks.searchMaterials.mockReset().mockResolvedValue({ matches: [], strategy: "local" });
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

  it("quietly ranks a natural-language material search and explains related results", async () => {
    const material = {
      id: "material-related",
      kind: "text" as const,
      status: "unfiled" as const,
      content: "The side panel captures the current page without an editor.",
      projects: [],
      tags: [],
      createdAt: "2026-08-02T12:00:00Z",
    };
    apiMocks.getMaterials.mockResolvedValue([material]);
    apiMocks.searchMaterials.mockResolvedValue({
      strategy: "semantic",
      matches: [{ id: material.id, match: "related", reason: "Explains page capture without an input" }],
    });
    window.history.replaceState(null, "", "/?view=stream");
    render(<App />);

    const search = await screen.findByPlaceholderText("Search materials");
    fireEvent.change(search, { target: { value: "How can I save a page note?" } });

    await waitFor(() => {
      expect(apiMocks.searchMaterials).toHaveBeenCalledWith("How can I save a page note?", expect.any(AbortSignal));
    });
    expect(await screen.findByText("Explains page capture without an input")).toBeTruthy();
    expect(screen.queryByText("Semantic search")).toBeNull();
  });

  it("does not claim there are no results while a natural-language search is pending", async () => {
    const material = {
      id: "material-pending",
      kind: "text" as const,
      status: "unfiled" as const,
      content: "A saved note about source provenance.",
      projects: [],
      tags: [],
      createdAt: "2026-08-02T12:00:00Z",
    };
    apiMocks.getMaterials.mockResolvedValue([material]);
    apiMocks.searchMaterials.mockReturnValue(new Promise(() => undefined));
    window.history.replaceState(null, "", "/?view=stream");
    render(<App />);

    const search = await screen.findByRole("textbox", { name: "Search materials" });
    fireEvent.change(search, { target: { value: "How can I keep a source trace?" } });

    expect(screen.queryByText("No matching materials")).toBeNull();
    expect(screen.getByLabelText("Searching materials").getAttribute("aria-busy")).toBe("true");
  });

  it("collapses to an accessible icon rail without changing mobile navigation", () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <NavRail active="views" connected collapsed={false} onCollapsedChange={onCollapsedChange} onChange={() => undefined} />,
    );

    const collapseButton = screen.getByRole("button", { name: "Close sidebar" });
    expect(collapseButton.className).toContain("size-9");
    expect(collapseButton.getAttribute("data-testid")).toBe("sidebar-brand-toggle");
    expect(screen.getByTestId("primary-navigation-shell").className).toContain("group/sidebar");
    expect(screen.getByTestId("sidebar-brand-mark").className).not.toContain("group-hover/sidebar:hidden");
    expect(collapseButton.className).toContain("group-hover/sidebar:opacity-100");
    expect(collapseButton.className).toContain("opacity-0");
    expect(within(screen.getByTestId("primary-navigation-shell")).getByText("Logue")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Close sidebar" })).toHaveLength(1);
    expect(within(screen.getByTestId("primary-navigation-shell")).queryByText("Local service running")).toBeNull();
    const expandedStreamIconSlot = within(screen.getByTestId("primary-navigation-shell"))
      .getByRole("button", { name: "Stream" })
      .querySelector('[data-nav-icon-slot="true"]');
    expect(expandedStreamIconSlot?.className).toContain("size-11");
    expect(screen.getByTestId("primary-navigation-shell").className).toContain("px-1.5");
    expect(screen.getByTestId("sidebar-header").className).toContain("shrink-0");
    expect(within(screen.getByTestId("primary-navigation-shell")).getByRole("navigation", { name: "Primary navigation" }).className).toContain("overflow-y-auto");
    expect(within(screen.getByTestId("primary-navigation-shell")).getByRole("navigation", { name: "Primary navigation" }).className).toContain("flex-1");
    fireEvent.click(collapseButton);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);

    rerender(
      <NavRail active="views" connected collapsed onCollapsedChange={onCollapsedChange} onChange={() => undefined} />,
    );
    expect(screen.getByTestId("primary-navigation-shell").getAttribute("data-collapsed")).toBe("true");
    expect(screen.getByTestId("primary-navigation-shell").className).toContain("w-14");
    expect(screen.getByRole("button", { name: "Open sidebar" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("sidebar-brand-mark").className).not.toContain("group-hover/toggle:hidden");
    expect(screen.queryByTestId("sidebar-toggle-icon")).toBeNull();
    const collapsedStreamIconSlot = within(screen.getByTestId("primary-navigation-shell"))
      .getByRole("button", { name: "Stream" })
      .querySelector('[data-nav-icon-slot="true"]');
    expect(collapsedStreamIconSlot?.className).toContain("size-11");
    expect(screen.getByTestId("primary-navigation-shell").className).toContain("px-1.5");
    expect(within(screen.getByTestId("primary-navigation-shell")).getByRole("button", { name: "Stream" })).toBeTruthy();
    expect(screen.getByTestId("mobile-primary-navigation").textContent).toContain("Stream");
  });

  it("only surfaces the local service state when action is needed", () => {
    const { rerender } = render(<NavRail active="stream" connected onChange={() => undefined} />);
    expect(screen.queryByRole("status", { name: "Local service running" })).toBeNull();

    rerender(<NavRail active="stream" connected={false} onChange={() => undefined} />);
    expect(screen.getByRole("status", { name: "Service disconnected" })).toBeTruthy();
  });

  it("quietly reconnects after the local service becomes available", async () => {
    vi.useFakeTimers();
    try {
      apiMocks.getMaterials.mockRejectedValueOnce(new Error("Service disconnected")).mockResolvedValue([]);
      render(<App />);

      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(screen.getByRole("status", { name: "Service disconnected" })).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      expect(apiMocks.getMaterials).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("status", { name: "Service disconnected" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays quiet until a failed service request confirms the disconnected state", () => {
    apiMocks.getMaterials.mockReturnValue(new Promise(() => undefined));
    apiMocks.getStatus.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.queryByRole("status", { name: "Service disconnected" })).toBeNull();
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

  it("renders documents inside the shared Generate shell without a duplicate document sidebar", async () => {
    const { container } = render(<App />);

    expect(screen.getAllByTestId("primary-navigation-shell")).toHaveLength(1);
    const generateNavigation = screen.getByRole("complementary", { name: "Generate navigation" });
    expect(screen.queryByTestId("document-sidebar")).toBeNull();

    await waitFor(() => {
      const documentRow = within(generateNavigation).getByRole("button", { name: /Shell test document/ });
      expect(documentRow.className).toContain("min-h-11");
    });

    expect(container.textContent).not.toContain("Results");
    expect(within(generateNavigation).queryByText("Local service connected")).toBeNull();
    expect(within(generateNavigation).queryByText("Local service unavailable")).toBeNull();
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
