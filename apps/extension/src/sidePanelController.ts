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
  close?: (options: { tabId: number }) => Promise<void>;
  setOptions: (options: { tabId?: number; path?: string; enabled: boolean }) => Promise<void>;
}

export function sidePanelPath(tabId: number, documentPath: string) {
  return `${documentPath}?tabId=${tabId}`;
}

export function siblingExtensionDocumentPath(documentPath: string, siblingName: string) {
  return `${documentPath.slice(0, documentPath.lastIndexOf("/") + 1)}${siblingName}`;
}

export function sidePanelTabId(search: string) {
  const value = Number(new URLSearchParams(search).get("tabId"));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function prepareTabSidePanel(
  api: Pick<SidePanelChrome, "setOptions">,
  tabId: number,
  documentPath: string,
) {
  return api.setOptions({ tabId, path: sidePanelPath(tabId, documentPath), enabled: true });
}

export function disableDefaultSidePanel(api: Pick<SidePanelChrome, "setOptions">) {
  return api.setOptions({ enabled: false });
}

export function disableTabSidePanel(api: Pick<SidePanelChrome, "setOptions">, tabId: number) {
  return api.setOptions({ tabId, enabled: false });
}

export function panelMessageTargetsTab(
  panelTabId: number,
  message: { tabId?: number; state?: Pick<PanelCaptureState, "tabId"> },
) {
  return message.tabId === panelTabId || message.state?.tabId === panelTabId;
}

export async function toggleSidePanel(
  api: Pick<SidePanelChrome, "open" | "close">,
  openTabs: Set<number>,
  tabId: number,
) {
  if (openTabs.has(tabId)) {
    if (!api.close) return "open-only" as const;
    try {
      await api.close({ tabId });
      openTabs.delete(tabId);
      return "closed" as const;
    } catch {
      // Chrome can retain session state across an extension reload after its
      // native panel is already gone. Open the requested tab instead.
      openTabs.delete(tabId);
    }
  }
  // Every tab receives its own path during tab lifecycle events. The user
  // gesture can now open directly, with no race against Chrome's default panel.
  await api.open({ tabId });
  openTabs.add(tabId);
  return "opened" as const;
}

export function panelStateForTab(
  tab: Pick<chrome.tabs.Tab, "id" | "url" | "title">,
  intent: CaptureIntent,
  source: PanelCaptureState["source"],
  selectionText?: string,
  targetText?: string,
  autoStartToken?: string,
  targetAvailable = false,
  candidateServerURL?: string,
): PanelCaptureState | undefined {
  if (typeof tab.id !== "number") return undefined;
  return {
    tabId: tab.id,
    intent,
    source,
    candidateServerURL,
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
    if (!current || current.tabId !== next.tabId) return next;
    return {
      ...next,
      ...(current.pendingInsert ? { pendingInsert: current.pendingInsert } : {}),
      ...(current.commandResult ? { commandResult: current.commandResult } : {}),
    };
  }
  return {
    ...next,
    draft: current.draft,
    transcript: current.transcript,
    projects: current.projects,
    tags: current.tags,
    pendingInsert: current.pendingInsert,
    commandResult: current.commandResult,
  };
}

/**
 * Passive page updates may refresh a page capture, but must not replace an
 * explicit selection, input, or generation context while that work is active.
 */
export function acceptsPassivePageContext(current?: Pick<PanelCaptureState, "intent">) {
  return !current || current.intent === "page";
}
