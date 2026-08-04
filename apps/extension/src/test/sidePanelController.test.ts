import { describe, expect, it, vi } from "vitest";
import { mergePanelCaptureState, sourceFromTab } from "../capturePrimitives";
import {
  acceptsPassivePageContext,
  consumePanelAutoStart,
  disableDefaultSidePanel,
  disableTabSidePanel,
  isOpenSelectionMenu,
  isSaveSelectionMenu,
  isSelectionMenu,
  openPanelWithPreparedState,
  openSelectionMenuId,
  panelStateForTab,
  panelMessageTargetsTab,
  prepareTabSidePanel,
  preserveMatchingPanelDraft,
  saveSelectionMenuId,
  selectionSavePayload,
  selectionContextMenus,
  sidePanelPath,
  sidePanelTabId,
  toggleSidePanel,
} from "../sidePanelController";

describe("native side panel controller", () => {
  it("uses page provenance instead of a generic current-page fallback", () => {
    expect(sourceFromTab({ url: "https://docs.example.com/path", title: "" })).toMatchObject({
      url: "https://docs.example.com/path",
      domain: "docs.example.com",
      title: "docs.example.com",
    });
    expect(sourceFromTab({ url: "", title: "" }).title).toBe("");
  });

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

  it("assigns every tab its own native Side Panel document", async () => {
    const setOptions = vi.fn(async () => undefined);
    await prepareTabSidePanel({ setOptions }, 42);
    expect(sidePanelPath(42)).toBe("sidepanel.html?tabId=42");
    expect(sidePanelTabId("?tabId=42")).toBe(42);
    expect(sidePanelTabId("?tabId=0")).toBeUndefined();
    expect(sidePanelTabId("?tabId=other")).toBeUndefined();
    expect(setOptions).toHaveBeenCalledWith({
      tabId: 42,
      path: "sidepanel.html?tabId=42",
      enabled: true,
    });
  });

  it("disables the manifest default and every unopened tab", async () => {
    const setOptions = vi.fn(async () => undefined);
    await disableDefaultSidePanel({ setOptions });
    await disableTabSidePanel({ setOptions }, 43);
    expect(setOptions.mock.calls).toEqual([
      [{ enabled: false }],
      [{ tabId: 43, enabled: false }],
    ]);
  });

  it("routes panel broadcasts only to their owning tab", () => {
    expect(panelMessageTargetsTab(7, { tabId: 7 })).toBe(true);
    expect(panelMessageTargetsTab(7, { state: { tabId: 7 } })).toBe(true);
    expect(panelMessageTargetsTab(7, { tabId: 8, state: { tabId: 8 } })).toBe(false);
  });

  it("creates a page capture without assuming an input target", () => {
    const tab = { id: 7, url: "https://example.com/page", title: "Page" };
    expect(panelStateForTab(tab, "page", sourceFromTab(tab))).toMatchObject({
      tabId: 7,
      intent: "page",
      selectionText: undefined,
      targetText: undefined,
      targetAvailable: false,
    });
  });

  it("carries a marked Logue page server candidate into panel state", () => {
    const tab = { id: 9, url: "https://logue.example.com/doc", title: "Logue" };
    expect(panelStateForTab(
      tab,
      "page",
      sourceFromTab(tab),
      undefined,
      undefined,
      undefined,
      false,
      "https://logue.example.com",
    )).toMatchObject({ candidateServerURL: "https://logue.example.com" });
  });

  it("preserves an empty writable editor for a generated reply", () => {
    const tab = { id: 18, url: "https://example.com/reply", title: "Reply" };
    expect(panelStateForTab(tab, "page", sourceFromTab(tab), undefined, "", undefined, true)).toMatchObject({
      targetText: "",
      targetAvailable: true,
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
      targetAvailable: false, draft: "unfinished note", transcript: "completed transcript", projects: ["Logue"], tags: ["review"], updatedAt: 1,
    };
    const sameCapture = { ...current, draft: undefined, transcript: undefined, projects: undefined, tags: undefined, updatedAt: 2 };
    expect(preserveMatchingPanelDraft(sameCapture, current)).toMatchObject({
      draft: "unfinished note", transcript: "completed transcript", projects: ["Logue"], tags: ["review"],
    });
    expect(preserveMatchingPanelDraft({ ...sameCapture, selectionText: "different" }, current).draft).toBeUndefined();
  });

  it("preserves a tab draft across native close, disable, and reopen", () => {
    const tabB = { id: 22, url: "https://chatgpt.com/", title: "ChatGPT" };
    const opened = panelStateForTab(tabB, "page", sourceFromTab(tabB))!;
    const updated = mergePanelCaptureState(opened, { draft: "TAB_B_DRAFT_KEEP" });

    // Native close/disable changes Chrome UI state only; reopening reconstructs
    // the shell and restores the same tab's session capture.
    const reopened = preserveMatchingPanelDraft(
      panelStateForTab(tabB, "page", sourceFromTab(tabB))!,
      updated,
    );
    expect(reopened.draft).toBe("TAB_B_DRAFT_KEEP");

    const tabA = { id: 21, url: "https://example.com/", title: "Example" };
    expect(preserveMatchingPanelDraft(
      panelStateForTab(tabA, "page", sourceFromTab(tabA))!,
      updated,
    ).draft).toBeUndefined();
  });

  it("keeps a completed pending insert across a panel state refresh without replaying its save", () => {
    const source = { url: "https://example.com", title: "Example", domain: "example.com" };
    const current = {
      tabId: 4, intent: "input" as const, source, targetAvailable: false, updatedAt: 1,
      pendingInsert: { text: "Saved reply", materialId: "mat_1", sourceURL: source.url },
    };
    const { pendingInsert: _pendingInsert, ...withoutPendingInsert } = current;
    const refreshed = { ...withoutPendingInsert, intent: "page" as const, targetAvailable: false, updatedAt: 2 };

    expect(preserveMatchingPanelDraft(refreshed, current).pendingInsert).toEqual(current.pendingInsert);
    expect(preserveMatchingPanelDraft({ ...refreshed, tabId: 5 }, current).pendingInsert).toBeUndefined();
    expect(mergePanelCaptureState(current, { pendingInsert: null }).pendingInsert).toBeUndefined();
  });

  it("does not replace explicit capture work with a passive page update", () => {
    expect(acceptsPassivePageContext()).toBe(true);
    expect(acceptsPassivePageContext({ intent: "page" })).toBe(true);
    expect(acceptsPassivePageContext({ intent: "selection" })).toBe(false);
    expect(acceptsPassivePageContext({ intent: "input" })).toBe(false);
    expect(acceptsPassivePageContext({ intent: "generate" })).toBe(false);
  });

  it("toggles the native Side Panel open and closed", async () => {
    const open = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const openTabs = new Set<number>();

    await expect(toggleSidePanel({ open, close }, openTabs, 9)).resolves.toBe("opened");
    await expect(toggleSidePanel({ open, close }, openTabs, 9)).resolves.toBe("closed");
    expect(open).toHaveBeenCalledWith({ tabId: 9 });
    expect(close).toHaveBeenCalledWith({ tabId: 9 });

    await expect(toggleSidePanel({ open, close }, new Set([12]), 12)).resolves.toBe("closed");
    expect(close).toHaveBeenLastCalledWith({ tabId: 12 });

  });

  it("opens directly after tab lifecycle configuration", async () => {
    const open = vi.fn(async () => undefined);
    const openTabs = new Set<number>();

    await expect(toggleSidePanel({ open }, openTabs, 14)).resolves.toBe("opened");
    expect(open).toHaveBeenCalledWith({ tabId: 14 });
    expect(openTabs.has(14)).toBe(true);
  });

  it("quietly degrades to open-only when Chrome has no Side Panel close API", async () => {
    const open = vi.fn(async () => undefined);
    const openTabs = new Set([21]);

    await expect(toggleSidePanel({ open }, openTabs, 21)).resolves.toBe("open-only");
    expect(open).not.toHaveBeenCalled();
    expect(openTabs.has(21)).toBe(true);
  });

  it("opens when a restored panel state is stale after an extension reload", async () => {
    const open = vi.fn(async () => undefined);
    const close = vi.fn(async () => { throw new Error("No native side panel is open"); });
    const openTabs = new Set<number>([11]);

    await expect(toggleSidePanel({ open, close }, openTabs, 11)).resolves.toBe("opened");
    expect(open).toHaveBeenCalledWith({ tabId: 11 });
    expect(openTabs.has(11)).toBe(true);
  });

});
