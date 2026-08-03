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
  _windowId?: number,
) {
  if (openTabs.has(tabId) && api.close) {
    try {
      // Closing the tab-scoped panel is more reliable than window-scoped close
      // when Chrome's side-panel focus has just moved away from the tab.
      await api.close({ tabId });
      openTabs.delete(tabId);
      return "closed" as const;
    } catch {
      // Chrome can retain session state across an extension reload after its native panel
      // is already gone. Treat that state as stale and satisfy the user's toggle by opening.
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
  if (!sameCapture) return next;
  return {
    ...next,
    draft: current.draft,
    transcript: current.transcript,
    projects: current.projects,
    tags: current.tags,
  };
}
