import {
  sourceFromTab,
  type CaptureIntent,
  type PanelCaptureState,
} from "./capturePrimitives";

export const saveSelectionMenuId = "logue-save-selection";
export const openSelectionMenuId = "logue-open-selection";
export const sidePanelCommand = "toggle-side-panel";

export const selectionContextMenus = [
  { id: saveSelectionMenuId, title: "Save to Logue", contexts: ["selection"] as ["selection"] },
  { id: openSelectionMenuId, title: "Open selection in Logue", contexts: ["selection"] as ["selection"] },
];

export function isSelectionMenu(menuItemId: string | number) {
  return menuItemId === saveSelectionMenuId || menuItemId === openSelectionMenuId;
}

export function isSaveSelectionMenu(menuItemId: string | number) {
  return menuItemId === saveSelectionMenuId;
}

export function isOpenSelectionMenu(menuItemId: string | number) {
  return menuItemId === openSelectionMenuId;
}

export interface SidePanelChrome {
  open: (options: { tabId: number }) => Promise<void>;
  close?: (options: { tabId: number } | { windowId: number }) => Promise<void>;
}

export async function toggleSidePanel(
  api: SidePanelChrome,
  openTabs: Set<number>,
  tabId: number,
  windowId?: number,
) {
  if (openTabs.has(tabId) && api.close) {
    try {
      // A native Side Panel is a window surface. Closing at that scope makes a
      // toolbar or command toggle reliable after the page loses focus.
      await api.close(typeof windowId === "number" ? { windowId } : { tabId });
      openTabs.delete(tabId);
      return "closed" as const;
    } catch {
      // If a newer Chrome rejects the window-scoped form for this panel, retain
      // the tab-scoped fallback before treating the session tracking as stale.
      if (typeof windowId === "number") {
        try {
          await api.close({ tabId });
          openTabs.delete(tabId);
          return "closed" as const;
        } catch {
          // Chrome can retain session state across an extension reload after its native panel
          // is already gone. Treat that state as stale and satisfy the user's toggle by opening.
        }
      }
      openTabs.delete(tabId);
    }
  }
  await api.open({ tabId });
  openTabs.add(tabId);
  return openTabs.has(tabId) && api.close ? "opened" as const : "opened-fallback" as const;
}

export function panelStateForTab(
  tab: Pick<chrome.tabs.Tab, "id" | "url" | "title">,
  intent: CaptureIntent,
  source: PanelCaptureState["source"],
  selectionText?: string,
  targetText?: string,
  autoStartToken?: string,
  targetAvailable = false,
): PanelCaptureState | undefined {
  if (typeof tab.id !== "number") return undefined;
  return {
    tabId: tab.id,
    intent,
    source,
    selectionText: selectionText?.trim() || undefined,
    targetText: targetAvailable ? targetText ?? "" : undefined,
    targetAvailable,
    autoStartToken,
    updatedAt: Date.now(),
  };
}

export function consumePanelAutoStart(
  state: PanelCaptureState,
  token: string,
): { state: PanelCaptureState; consumed: boolean } {
  if (!token || state.autoStartToken !== token) return { state, consumed: false };
  const { autoStartToken: _consumed, ...next } = state;
  return { state: next, consumed: true };
}

export function selectionSavePayload(
  tab: Pick<chrome.tabs.Tab, "url" | "title">,
  selectionText: string,
  requestId: string,
) {
  const selectedText = selectionText.trim();
  const source = sourceFromTab(tab);
  return {
    request_id: requestId,
    source_content: selectedText,
    source: { ...source, selection: selectedText },
    projects: [],
    tags: [],
  };
}

export function openPanelWithPreparedState(
  prepareState: () => void,
  open: () => Promise<unknown>,
) {
  prepareState();
  return open();
}

export function preserveMatchingPanelDraft(
  next: PanelCaptureState,
  current?: PanelCaptureState,
): PanelCaptureState {
  const sameCapture = current &&
    current.tabId === next.tabId &&
    current.intent === next.intent &&
    current.source.url === next.source.url &&
    current.selectionText === next.selectionText;
  if (!sameCapture) {
    // A completed insert transaction belongs to its tab. It may survive a page
    // change within that tab so the user can return to the original editor, but
    // it must never appear in an unrelated tab.
    return current?.pendingInsert && current.tabId === next.tabId
      ? { ...next, pendingInsert: current.pendingInsert }
      : next;
  }
  return {
    ...next,
    draft: current.draft,
    transcript: current.transcript,
    projects: current.projects,
    tags: current.tags,
    pendingInsert: current.pendingInsert,
  };
}
