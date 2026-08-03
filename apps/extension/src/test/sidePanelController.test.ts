import { describe, expect, it, vi } from "vitest";
import { sourceFromTab } from "../capturePrimitives";
import {
  consumePanelAutoStart,
  isOpenSelectionMenu,
  isSaveSelectionMenu,
  isSelectionMenu,
  openPanelWithPreparedState,
  openSelectionMenuId,
  panelStateForTab,
  preserveMatchingPanelDraft,
  saveSelectionMenuId,
  selectionSavePayload,
  selectionContextMenus,
  toggleSidePanel,
} from "../sidePanelController";

describe("native side panel controller", () => {
  it("keeps the original selection save action and adds a view action", () => {
    expect(selectionContextMenus).toEqual([
      { id: saveSelectionMenuId, title: "Save to Logue", contexts: ["selection"] },
      { id: openSelectionMenuId, title: "Open selection in Logue", contexts: ["selection"] },
    ]);
    expect(isSelectionMenu(saveSelectionMenuId)).toBe(true);
    expect(isSelectionMenu(openSelectionMenuId)).toBe(true);
    expect(isSaveSelectionMenu(saveSelectionMenuId)).toBe(true);
    expect(isSaveSelectionMenu(openSelectionMenuId)).toBe(false);
    expect(isOpenSelectionMenu(openSelectionMenuId)).toBe(true);
    expect(isOpenSelectionMenu(saveSelectionMenuId)).toBe(false);
    expect(isSelectionMenu("unrelated")).toBe(false);
  });

  it("keeps Save to Logue as a direct selection save with full provenance", () => {
    expect(selectionSavePayload(
      { url: "https://example.com/article", title: "Article" },
      "  complete selected text  ",
      "request-1",
    )).toEqual({
      request_id: "request-1",
      source_content: "complete selected text",
      source: {
        url: "https://example.com/article",
        title: "Article",
        domain: "example.com",
        selection: "complete selected text",
      },
      projects: [],
      tags: [],
    });
  });

  it("passes the complete selection and page provenance into tab-scoped state", () => {
    const tab = { id: 42, url: "https://example.com/research", title: "Research" };
    const source = sourceFromTab(tab);
    const state = panelStateForTab(tab, "selection", source, "the full selected passage");

    expect(state).toMatchObject({
      tabId: 42,
      intent: "selection",
      selectionText: "the full selected passage",
      source: { url: tab.url, title: tab.title, domain: "example.com" },
    });
  });

  it("creates a page capture without assuming an input target", () => {
    const tab = { id: 7, url: "https://example.com/page", title: "Page" };
    expect(panelStateForTab(tab, "page", sourceFromTab(tab))).toMatchObject({
      tabId: 7,
      intent: "page",
      selectionText: undefined,
      targetText: undefined,
    });
  });

  it("auto-starts only the explicit voice capture token and consumes it once", () => {
    const tab = { id: 8, url: "https://example.com/write", title: "Write" };
    const state = panelStateForTab(tab, "input", sourceFromTab(tab), undefined, "draft", "start-1")!;
    expect(state.autoStartToken).toBe("start-1");

    const first = consumePanelAutoStart(state, "start-1");
    expect(first.consumed).toBe(true);
    expect(first.state.autoStartToken).toBeUndefined();
    expect(consumePanelAutoStart(first.state, "start-1").consumed).toBe(false);

    expect(panelStateForTab(tab, "page", sourceFromTab(tab))?.autoStartToken).toBeUndefined();
    expect(panelStateForTab(tab, "generate", sourceFromTab(tab))?.autoStartToken).toBeUndefined();
  });

  it("publishes first-open state before asking Chrome to open without losing the user gesture", async () => {
    const order: string[] = [];
    let continueStorage!: () => void;
    const storage = new Promise<void>((resolve) => { continueStorage = resolve; });
    const opening = openPanelWithPreparedState(
      () => {
        order.push("state");
        void storage.then(() => order.push("storage"));
      },
      async () => { order.push("open"); },
    );
    expect(order).toEqual(["state", "open"]);
    continueStorage();
    await Promise.all([opening, storage]);
    expect(order).toEqual(["state", "open", "storage"]);
  });

  it("restores an unfinished draft only when reopening the same capture", () => {
    const source = { url: "https://example.com", title: "Example", domain: "example.com" };
    const current = {
      tabId: 4, intent: "selection" as const, source, selectionText: "source",
      draft: "unfinished note", transcript: "completed transcript", projects: ["Logue"], tags: ["review"], updatedAt: 1,
    };
    const sameCapture = { ...current, draft: undefined, transcript: undefined, projects: undefined, tags: undefined, updatedAt: 2 };
    expect(preserveMatchingPanelDraft(sameCapture, current)).toMatchObject({
      draft: "unfinished note", transcript: "completed transcript", projects: ["Logue"], tags: ["review"],
    });
    expect(preserveMatchingPanelDraft({ ...sameCapture, selectionText: "different" }, current).draft).toBeUndefined();
  });

  it("toggles closed on Chrome 141+ and falls back to open-only on older Chrome", async () => {
    const open = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const openTabs = new Set<number>();

    await expect(toggleSidePanel({ open, close }, openTabs, 9)).resolves.toBe("opened");
    await expect(toggleSidePanel({ open, close }, openTabs, 9)).resolves.toBe("closed");
    expect(open).toHaveBeenCalledWith({ tabId: 9 });
    expect(close).toHaveBeenCalledWith({ tabId: 9 });

    const oldChromeTabs = new Set<number>([10]);
    await expect(toggleSidePanel({ open }, oldChromeTabs, 10)).resolves.toBe("opened-fallback");
    expect(open).toHaveBeenLastCalledWith({ tabId: 10 });
  });
});
