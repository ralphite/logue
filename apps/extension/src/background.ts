import { mergePanelCaptureState, sourceFromTab, type CaptureIntent, type PanelCaptureState } from "./capturePrimitives";
import {
  consumePanelAutoStart,
  isOpenSelectionMenu,
  isSaveSelectionMenu,
  isSelectionMenu,
  openPanelWithPreparedState,
  panelStateForTab,
  preserveMatchingPanelDraft,
  restoreOpenSidePanelTab,
  selectionSavePayload,
  selectionContextMenus,
  sidePanelCommand,
  toggleSidePanel,
} from "./sidePanelController";
import { createRequestId } from "./requestId";
import type { RecordingBridgeEvent, RecordingPanelEvent } from "./recordingBridge";

const apiBase = "http://127.0.0.1:8787";
const panelStoragePrefix = "logue:panel:";
const activePanelStorageKey = "logue:panel:active-tab";
const openPanelStorageKey = "logue:panel:open-tab";
const openPanelTabs = new Set<number>();
const panelStates = new Map<number, PanelCaptureState>();
let activePanelTabId: number | undefined;
let openPanelWindowId: number | undefined;
void chrome.storage.session.get(openPanelStorageKey)
  .then((stored) => {
    const state = restoreOpenSidePanelTab(openPanelTabs, stored[openPanelStorageKey]);
    openPanelWindowId = state?.windowId;
  })
  .catch(() => undefined);

interface ApiMessage {
  type: "logue:api";
  action: "status" | "context" | "transcribe" | "save-material" | "cancel-material-save" | "save-selection" | "delete-capture" | "agents" | "settings" | "agent-run" | "adopt-agent-run";
  payload?: Record<string, unknown>;
}

interface OpenPanelMessage {
  type: "logue:open-side-panel";
  intent: CaptureIntent;
  source: PanelCaptureState["source"];
  selectionText?: string;
  targetText?: string;
  autoStartRecording?: boolean;
}

interface PanelStateMessage {
  type: "logue:get-panel-state" | "logue:update-panel-state" | "logue:close-side-panel" | "logue:consume-panel-autostart";
  patch?: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projects" | "tags">>;
  token?: string;
}

type RuntimeMessage = ApiMessage | OpenPanelMessage | PanelStateMessage | RecordingBridgeEvent;

const nativeSidePanel = chrome.sidePanel as typeof chrome.sidePanel & {
  close?: (options: { tabId: number } | { windowId: number }) => Promise<void>;
  onOpened?: chrome.events.Event<(info: { tabId?: number; windowId?: number }) => void>;
  onClosed?: chrome.events.Event<(info: { tabId?: number; windowId?: number }) => void>;
};

async function persistPanelState(state: PanelCaptureState) {
  panelStates.set(state.tabId, state);
  activePanelTabId = state.tabId;
  await chrome.storage.session.set({
    [`${panelStoragePrefix}${state.tabId}`]: state,
    [activePanelStorageKey]: state.tabId,
  });
}

function stagePanelState(state: PanelCaptureState) {
  const staged = preserveMatchingPanelDraft(state, panelStates.get(state.tabId));
  panelStates.set(staged.tabId, staged);
  activePanelTabId = staged.tabId;
  void chrome.storage.session.set({
    [`${panelStoragePrefix}${staged.tabId}`]: staged,
    [activePanelStorageKey]: staged.tabId,
  });
  void chrome.runtime.sendMessage({ type: "logue:panel-state-changed", state: staged }).catch(() => undefined);
  return staged;
}

async function restorePanelState(tabId: number) {
  const current = panelStates.get(tabId);
  if (current) return current;
  const key = `${panelStoragePrefix}${tabId}`;
  const stored = (await chrome.storage.session.get(key))[key] as PanelCaptureState | undefined;
  if (stored) panelStates.set(tabId, stored);
  return stored;
}

function openPanel(tabId: number) {
  activePanelTabId = tabId;
  openPanelTabs.add(tabId);
  void chrome.storage.session.set({ [activePanelStorageKey]: tabId });
  return nativeSidePanel.open({ tabId });
}

function canCloseNativePanel() {
  return typeof (nativeSidePanel as unknown as { close?: unknown }).close === "function";
}

async function toggleTrackedSidePanel(tabId: number, windowId?: number) {
  const result = await toggleSidePanel(nativeSidePanel, openPanelTabs, tabId, windowId);
  if (result === "closed") {
    openPanelWindowId = undefined;
    await chrome.storage.session.remove(openPanelStorageKey);
  } else {
    openPanelWindowId = windowId;
    await chrome.storage.session.set({ [openPanelStorageKey]: { tabId, windowId } });
  }
  return result;
}

async function toggleTabPanel(tab?: chrome.tabs.Tab) {
  const tabId = typeof tab?.id === "number"
    ? tab.id
    : openPanelTabs.values().next().value;
  const windowId = typeof tab?.windowId === "number" ? tab.windowId : openPanelWindowId;
  if (typeof tabId !== "number") return;

  if (openPanelTabs.has(tabId) && canCloseNativePanel()) {
    await toggleTrackedSidePanel(tabId, windowId);
    return;
  }
  if (!tab || typeof tab.id !== "number") return;

  const state = panelStateForTab(tab, "page", sourceFromTab(tab));
  if (!state) return;
  await openPanelWithPreparedState(
    () => { stagePanelState(state); },
    () => toggleTrackedSidePanel(tabId, windowId),
  );
}

async function getActivePanelTabId() {
  if (typeof activePanelTabId === "number") return activePanelTabId;
  const stored = (await chrome.storage.session.get(activePanelStorageKey))[activePanelStorageKey];
  if (typeof stored === "number") activePanelTabId = stored;
  return activePanelTabId;
}

async function setPanelContext(
  tab: chrome.tabs.Tab,
  intent: CaptureIntent,
  selectionText?: string,
  targetText?: string,
  source = sourceFromTab(tab),
) {
  const state = panelStateForTab(tab, intent, source, selectionText, targetText);
  if (!state) return;
  const merged = preserveMatchingPanelDraft(state, await restorePanelState(state.tabId));
  await persistPanelState(merged);
  void chrome.runtime.sendMessage({ type: "logue:panel-state-changed", state: merged }).catch(() => undefined);
}

function openTabPanel(tab: chrome.tabs.Tab, intent: CaptureIntent, selectionText?: string) {
  if (typeof tab.id !== "number") return Promise.resolve();
  const state = panelStateForTab(tab, intent, sourceFromTab(tab), selectionText);
  if (!state) return Promise.resolve();
  return openPanelWithPreparedState(
    () => { stagePanelState(state); },
    () => openPanel(tab.id!),
  );
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  let value: unknown = text;
  try {
    value = text ? JSON.parse(text) : null;
  } catch {
    // Keep the plain-text error for actionable diagnostics.
  }
  if (!response.ok) {
    const message =
      typeof value === "object" && value && "error" in value
        ? String((value as { error: unknown }).error)
        : text || `The Logue service returned an error (${response.status}).`;
    const error = new Error(message) as Error & { captureId?: string };
    if (typeof value === "object" && value && "capture_id" in value) {
      error.captureId = String((value as { capture_id: unknown }).capture_id);
    }
    throw error;
  }
  return value;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function handleApiMessage(message: ApiMessage) {
  const payload = message.payload ?? {};
  if (message.action === "status") {
    return parseResponse(await fetch(`${apiBase}/v1/status`));
  }
  if (message.action === "context") {
    const query = new URLSearchParams({ url: String(payload.pageUrl ?? ""), project: String(payload.project ?? "") });
    return parseResponse(await fetch(`${apiBase}/v1/context?${query.toString()}`));
  }
  if (message.action === "agents") {
    return parseResponse(await fetch(`${apiBase}/v1/agents`));
  }
  if (message.action === "settings") {
    return parseResponse(await fetch(`${apiBase}/v1/settings`));
  }
  if (message.action === "agent-run") {
    return parseResponse(
      await fetch(`${apiBase}/v1/agent-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "adopt-agent-run") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await fetch(`${apiBase}/v1/agent-runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adopted_output: payload.adoptedOutput }),
      }),
    );
  }
  if (message.action === "cancel-material-save") {
    const requestId = encodeURIComponent(String(payload.requestId ?? ""));
    return parseResponse(await fetch(`${apiBase}/v1/cancellations/${requestId}`, { method: "POST" }));
  }
  if (message.action === "transcribe") {
    const audioBase64 = String(payload.audioBase64 ?? "");
    if (!audioBase64) throw new Error("The recording is empty.");
    const mimeType = String(payload.mimeType ?? "audio/webm");
    const form = new FormData();
    form.append("request_id", String(payload.requestId ?? ""));
    form.append("audio", new Blob([decodeBase64(audioBase64)], { type: mimeType }), "logue-recording.webm");
    form.append("page_url", String(payload.pageUrl ?? ""));
    form.append("page_title", String(payload.pageTitle ?? ""));
    form.append("target_text", String(payload.targetText ?? ""));
    form.append("selected_text", String(payload.selectedText ?? ""));
    form.append("project_context", String(payload.projectContext ?? ""));
    form.append("glossary", String(payload.glossary ?? ""));
    form.append("instructions", String(payload.instructions ?? ""));
    if (payload.appliedContext) form.append("applied_context", JSON.stringify(payload.appliedContext));
    return parseResponse(await fetch(`${apiBase}/v1/transcribe`, { method: "POST", body: form }));
  }
  if (message.action === "save-material") {
    return parseResponse(
      await fetch(`${apiBase}/v1/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "save-selection") {
    return parseResponse(
      await fetch(`${apiBase}/v1/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "delete-capture") {
    return parseResponse(
      await fetch(`${apiBase}/v1/captures/${encodeURIComponent(String(payload.id ?? ""))}`, {
        method: "DELETE",
      }),
    );
  }
  throw new Error("Unknown Logue API action.");
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    selectionContextMenus.forEach((item) => chrome.contextMenus.create(item));
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (
    !isSelectionMenu(info.menuItemId) ||
    !tab || typeof tab.id !== "number" || !info.selectionText
  ) return;
  if (isSaveSelectionMenu(info.menuItemId)) {
    void handleApiMessage({
      type: "logue:api",
      action: "save-selection",
      payload: selectionSavePayload(tab, info.selectionText, createRequestId()),
    }).catch(() => undefined);
    return;
  }
  if (isOpenSelectionMenu(info.menuItemId)) {
    void openTabPanel(tab, "selection", info.selectionText).catch(() => undefined);
  }
});

chrome.action.onClicked.addListener((tab) => {
  void toggleTabPanel(tab).catch(() => undefined);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== sidePanelCommand) return;
  void toggleTabPanel(tab).catch(() => undefined);
});

nativeSidePanel.onOpened?.addListener((info) => {
  if (typeof info.windowId === "number") openPanelWindowId = info.windowId;
  if (typeof info.tabId === "number") {
    activePanelTabId = info.tabId;
    openPanelTabs.add(info.tabId);
  }
  const tabId = typeof info.tabId === "number" ? info.tabId : openPanelTabs.values().next().value;
  if (typeof tabId === "number") {
    void chrome.storage.session.set({
      [openPanelStorageKey]: { tabId, windowId: openPanelWindowId },
    });
  }
});

nativeSidePanel.onClosed?.addListener((info) => {
  const closingTabs = typeof info.tabId === "number" ? [info.tabId] : [...openPanelTabs];
  for (const tabId of closingTabs) {
    openPanelTabs.delete(tabId);
    void chrome.tabs.sendMessage(tabId, { type: "logue:recording-dispose" }).catch(() => undefined);
  }
  openPanelWindowId = undefined;
  void chrome.storage.session.remove(openPanelStorageKey);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  panelStates.delete(tabId);
  openPanelTabs.delete(tabId);
  void chrome.storage.session.get(openPanelStorageKey).then((stored) => {
    const restored = stored[openPanelStorageKey] as Partial<{ tabId: number }> | number | undefined;
    if (restored === tabId || (typeof restored === "object" && restored?.tabId === tabId)) {
      void chrome.storage.session.remove(openPanelStorageKey);
    }
  });
  void chrome.storage.session.remove(`${panelStoragePrefix}${tabId}`);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (openPanelTabs.size === 0) return;
  const previousTabId = activePanelTabId;
  if (typeof previousTabId === "number" && previousTabId !== tabId) {
    void chrome.tabs.sendMessage(previousTabId, { type: "logue:recording-dispose" }).catch(() => undefined);
  }
  void chrome.tabs.get(tabId).then((tab) => setPanelContext(tab, "page")).catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || tabId !== activePanelTabId || openPanelTabs.size === 0) return;
  void setPanelContext(tab, "page");
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message?.type === "logue:recording-bridge-event") {
    if (typeof sender.tab?.id === "number") {
      const panelEvent: RecordingPanelEvent = {
        ...message,
        type: "logue:recording-event",
        tabId: sender.tab.id,
      };
      void chrome.runtime.sendMessage(panelEvent).catch(() => undefined);
    }
    return false;
  }

  if (message?.type === "logue:open-side-panel") {
    const tab = sender.tab;
    if (!tab || typeof tab.id !== "number") return false;
    const nextState: PanelCaptureState = {
      tabId: tab.id,
      intent: message.intent,
      source: message.source,
      selectionText: message.selectionText?.trim() || undefined,
      targetText: message.targetText?.trim() || undefined,
      autoStartToken: message.autoStartRecording ? createRequestId() : undefined,
      updatedAt: Date.now(),
    };
    void openPanelWithPreparedState(
      () => { stagePanelState(nextState); },
      () => openPanel(tab.id!),
    ).then(() => sendResponse({ ok: true })).catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Could not open Logue.",
    }));
    return true;
  }

  if (message?.type === "logue:get-panel-state") {
    void getActivePanelTabId().then((tabId) => {
      if (typeof tabId !== "number") {
        sendResponse({ ok: true, value: undefined });
        return;
      }
      void restorePanelState(tabId).then((value) => sendResponse({ ok: true, value }));
    });
    return true;
  }

  if (message?.type === "logue:update-panel-state") {
    if (typeof activePanelTabId !== "number") return false;
    void restorePanelState(activePanelTabId).then((current) => {
      if (current && message.patch) void persistPanelState(mergePanelCaptureState(current, message.patch));
    });
    return false;
  }

  if (message?.type === "logue:consume-panel-autostart") {
    void getActivePanelTabId().then(async (tabId) => {
      if (typeof tabId !== "number" || !message.token) {
        sendResponse({ ok: true, consumed: false });
        return;
      }
      const current = await restorePanelState(tabId);
      if (!current) {
        sendResponse({ ok: true, consumed: false });
        return;
      }
      const result = consumePanelAutoStart(current, message.token);
      if (result.consumed) await persistPanelState(result.state);
      sendResponse({ ok: true, consumed: result.consumed });
    }).catch((error: unknown) => sendResponse({
      ok: false,
      consumed: false,
      error: error instanceof Error ? error.message : "Could not start voice capture.",
    }));
    return true;
  }

  if (message?.type === "logue:close-side-panel") {
    if (typeof activePanelTabId !== "number" || !nativeSidePanel.close) return false;
    const closingTabId = activePanelTabId;
    void nativeSidePanel.close({ tabId: closingTabId }).then(() => openPanelTabs.delete(closingTabId)).catch(() => undefined);
    return false;
  }

  if (message?.type !== "logue:api") return false;
  void handleApiMessage(message)
    .then((value) => sendResponse({ ok: true, value }))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "The Logue service request failed.",
        captureId:
          error instanceof Error && "captureId" in error
            ? String((error as Error & { captureId?: string }).captureId ?? "")
            : undefined,
      }),
    );
  return true;
});
