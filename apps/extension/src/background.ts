import {
  mergePanelCaptureState,
  sourceFromTab,
  type CaptureIntent,
  type PageCaptureContext,
  type PanelCaptureState,
} from "./capturePrimitives";
import {
  consumePanelAutoStart,
  isOpenSelectionMenu,
  isSaveSelectionMenu,
  isSelectionMenu,
  openPanelWithPreparedState,
  panelStateForTab,
  preserveMatchingPanelDraft,
  selectionSavePayload,
  selectionContextMenus,
  sidePanelCommand,
  toggleSidePanel,
} from "./sidePanelController";
import { createRequestId } from "./requestId";
import type { RecordingBridgeEvent, RecordingPanelEvent } from "./recordingBridge";
import { assertLogueServerStatus, getServerURL, normalizeServerURL } from "./serverConnection";

const panelStoragePrefix = "logue:panel:";
const activePanelStorageKey = "logue:panel:active-tab";
// This is session-only Chrome UI state, not restored product data. Chrome can
// suspend a MV3 worker while its Side Panel stays visible, so a fresh worker
// needs this one bit to keep the toolbar command behaving as a real toggle.
const openPanelStoragePrefix = "logue:side-panel:open:";
const openPanelTabs = new Set<number>();
const panelStates = new Map<number, PanelCaptureState>();
let activePanelTabId: number | undefined;
let openPanelWindowId: number | undefined;

interface ApiMessage {
  type: "logue:api";
  action: "status" | "test-server" | "context" | "page-materials" | "transcribe" | "save-material" | "cancel-material-save" | "save-selection" | "delete-capture" | "skills" | "settings" | "skill-run" | "adopt-skill-run";
  payload?: Record<string, unknown>;
}

interface OpenPanelMessage {
  type: "logue:open-side-panel";
  intent: CaptureIntent;
  source: PanelCaptureState["source"];
  selectionText?: string;
  targetText?: string;
  targetAvailable?: boolean;
  autoStartRecording?: boolean;
}

interface PanelStateMessage {
  type: "logue:get-panel-state" | "logue:update-panel-state" | "logue:close-side-panel" | "logue:consume-panel-autostart" | "logue:request-panel-generate" | "logue:return-panel-to-page";
  patch?: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projects" | "tags">> & { pendingInsert?: PanelCaptureState["pendingInsert"] | null };
  token?: string;
}

type RuntimeMessage = ApiMessage | OpenPanelMessage | PanelStateMessage | RecordingBridgeEvent;

const nativeSidePanel = chrome.sidePanel as typeof chrome.sidePanel & {
  close: (options: { tabId: number } | { windowId: number }) => Promise<void>;
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

function openPanelStorageKey(tabId: number) {
  return `${openPanelStoragePrefix}${tabId}`;
}

async function markPanelOpen(tabId: number, windowId?: number) {
  activePanelTabId = tabId;
  openPanelTabs.add(tabId);
  if (typeof windowId === "number") openPanelWindowId = windowId;
  await chrome.storage.session.set({ [openPanelStorageKey(tabId)]: true });
  // Chrome can keep the Side Panel document alive while hiding it. Reopening
  // therefore does not necessarily remount React or rehydrate state, so tell
  // the existing document to take keyboard focus on every accepted open.
  void chrome.runtime.sendMessage({ type: "logue:side-panel-opened", tabId }).catch(() => undefined);
}

async function clearPanelOpen(tabId: number) {
  openPanelTabs.delete(tabId);
  if (activePanelTabId === tabId) openPanelWindowId = undefined;
  await chrome.storage.session.remove(openPanelStorageKey(tabId));
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

async function openPanel(tabId: number, windowId?: number) {
  // Keep this API invocation synchronous relative to the original user
  // gesture. Only persist the tracking bit after Chrome accepts the open.
  const opening = nativeSidePanel.open({ tabId });
  await opening;
  await markPanelOpen(tabId, windowId);
}

async function toggleTrackedSidePanel(tabId: number, windowId?: number) {
  const result = await toggleSidePanel(nativeSidePanel, openPanelTabs, tabId, windowId);
  if (result === "closed") {
    await clearPanelOpen(tabId);
  } else {
    await markPanelOpen(tabId, windowId);
  }
  return result;
}

function fallbackPageCaptureContext(tab: chrome.tabs.Tab): PageCaptureContext {
  return {
    source: sourceFromTab(tab),
    targetAvailable: false,
  };
}

function isCurrentPageContext(value: unknown, tab: chrome.tabs.Tab): value is PageCaptureContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<PageCaptureContext>;
  return Boolean(
    context.source &&
    typeof context.source.url === "string" &&
    context.source.url === tab.url &&
    typeof context.source.title === "string" &&
    typeof context.source.domain === "string" &&
    typeof context.targetAvailable === "boolean",
  );
}

async function readPageCaptureContext(tab: chrome.tabs.Tab): Promise<PageCaptureContext> {
  if (typeof tab.id !== "number") return fallbackPageCaptureContext(tab);
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "logue:get-page-context" }) as {
      ok?: boolean;
      value?: unknown;
    } | undefined;
    const latest = await chrome.tabs.get(tab.id);
    if (latest.url !== tab.url || !response?.ok || !isCurrentPageContext(response.value, latest)) {
      return fallbackPageCaptureContext(latest);
    }
    return response.value;
  } catch {
    return fallbackPageCaptureContext(tab);
  }
}

async function startPanelGenerate() {
  const tabId = await getActivePanelTabId();
  if (typeof tabId !== "number") return false;
  const current = await restorePanelState(tabId);
  if (!current?.targetAvailable) return false;
  const next: PanelCaptureState = {
    ...current,
    intent: "generate",
    updatedAt: Date.now(),
  };
  await persistPanelState(next);
  void chrome.runtime.sendMessage({ type: "logue:panel-state-changed", state: next }).catch(() => undefined);
  return true;
}

async function returnPanelToPage() {
  const tabId = await getActivePanelTabId();
  if (typeof tabId !== "number") return false;
  const tab = await chrome.tabs.get(tabId);
  const context = await readPageCaptureContext(tab);
  const next = panelStateForTab(
    tab,
    "page",
    context.source,
    undefined,
    context.targetText,
    undefined,
    context.targetAvailable,
  );
  if (!next) return false;
  await persistPanelState(next);
  void chrome.runtime.sendMessage({ type: "logue:panel-state-changed", state: next }).catch(() => undefined);
  return true;
}

async function toggleTabPanel(tab?: chrome.tabs.Tab) {
  const tabId = typeof tab?.id === "number"
    ? tab.id
    : openPanelTabs.values().next().value;
  const windowId = typeof tab?.windowId === "number" ? tab.windowId : openPanelWindowId;
  if (typeof tabId !== "number") return;

  if (openPanelTabs.has(tabId)) {
    await toggleTrackedSidePanel(tabId, windowId);
    return;
  }
  if (!tab || typeof tab.id !== "number") return;

  // Start reading the last native-panel state before opening, but never await it
  // on this gesture path. `sidePanel.open` must be called synchronously from the
  // toolbar/command event. If an MV3 worker was restarted while the panel stayed
  // open, Chrome receives an idempotent open first and then the stored-open
  // result closes it; a fresh panel stays open and is tracked afterwards.
  const priorOpen = chrome.storage.session.get(openPanelStorageKey(tabId));

  // sidePanel.open must be invoked within Chrome's original user gesture. Stage a
  // safe page state first, open immediately, then enrich it from the content script.
  const state = panelStateForTab(
    tab,
    "page",
    sourceFromTab(tab),
  );
  if (!state) return;
  const opening = openPanelWithPreparedState(
    () => { stagePanelState(state); },
    () => toggleTrackedSidePanel(tabId, windowId),
  );
  void readPageCaptureContext(tab).then((context) => setPanelContext(
    tab,
    "page",
    undefined,
    context.targetText,
    context.source,
    context.targetAvailable,
  )).catch(() => undefined);
  const wasOpen = (await priorOpen)[openPanelStorageKey(tabId)] === true;
  if (wasOpen) {
    try {
      await nativeSidePanel.close({ tabId });
      await clearPanelOpen(tabId);
      return;
    } catch {
      // The session bit was stale (for example after Chrome restored tabs).
      // The synchronous open above is the correct safe fallback.
    }
  }
  await opening;
}

async function toggleActiveTabPanel() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await toggleTabPanel(tab);
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
  targetAvailable = false,
) {
  const state = panelStateForTab(tab, intent, source, selectionText, targetText, undefined, targetAvailable);
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
  const apiBase = message.action === "test-server"
    ? normalizeServerURL(String(payload.serverURL ?? ""))
    : await getServerURL();
  if (message.action === "test-server") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const status = await parseResponse(await fetch(`${apiBase}/v1/status`, { signal: controller.signal }));
      assertLogueServerStatus(status);
      return status;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        throw new Error("The connection timed out.");
      }
      throw cause;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (message.action === "status") {
    const status = await parseResponse(await fetch(`${apiBase}/v1/status`));
    assertLogueServerStatus(status);
    return status;
  }
  if (message.action === "context") {
    const query = new URLSearchParams({ url: String(payload.pageUrl ?? ""), project: String(payload.project ?? "") });
    return parseResponse(await fetch(`${apiBase}/v1/context?${query.toString()}`));
  }
  if (message.action === "skills") {
    return parseResponse(await fetch(`${apiBase}/v1/skills`));
  }
  if (message.action === "settings") {
    return parseResponse(await fetch(`${apiBase}/v1/settings`));
  }
  if (message.action === "page-materials") {
    const query = new URLSearchParams({ source_url: String(payload.pageUrl ?? "") });
    return parseResponse(await fetch(`${apiBase}/v1/items?${query.toString()}`));
  }
  if (message.action === "skill-run") {
    return parseResponse(
      await fetch(`${apiBase}/v1/skill-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "adopt-skill-run") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await fetch(`${apiBase}/v1/skill-runs/${id}`, {
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

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    selectionContextMenus.forEach((item) => chrome.contextMenus.create(item));
  });
  if (details.reason === "update") {
    void chrome.storage.session.get(null).then((session) => {
      const staleOpenKeys = Object.keys(session).filter((key) => key.startsWith(openPanelStoragePrefix));
      if (staleOpenKeys.length) return chrome.storage.session.remove(staleOpenKeys);
      return undefined;
    }).catch(() => undefined);
  }
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
  if (tab) {
    void toggleTabPanel(tab).catch(() => undefined);
    return;
  }
  void toggleActiveTabPanel().catch(() => undefined);
});

nativeSidePanel.onOpened?.addListener((info) => {
  if (typeof info.tabId === "number") {
    void markPanelOpen(info.tabId, info.windowId);
  }
});

nativeSidePanel.onClosed?.addListener((info) => {
  const closingTabs = typeof info.tabId === "number" ? [info.tabId] : [...openPanelTabs];
  for (const tabId of closingTabs) {
    void clearPanelOpen(tabId);
    void chrome.tabs.sendMessage(tabId, { type: "logue:recording-dispose" }).catch(() => undefined);
  }
  openPanelWindowId = undefined;
});

// MV3 workers can be suspended while Chrome keeps the native Side Panel open.
// Rehydrate its ephemeral tracking in the background, never on the user-gesture
// path that is required for `sidePanel.open`.
void chrome.storage.session.get(null).then((session) => {
  for (const [key, value] of Object.entries(session)) {
    if (value !== true || !key.startsWith(openPanelStoragePrefix)) continue;
    const tabId = Number(key.slice(openPanelStoragePrefix.length));
    if (Number.isInteger(tabId)) openPanelTabs.add(tabId);
  }
}).catch(() => undefined);

chrome.tabs.onRemoved.addListener((tabId) => {
  panelStates.delete(tabId);
  void clearPanelOpen(tabId);
  void chrome.storage.session.remove([`${panelStoragePrefix}${tabId}`, openPanelStorageKey(tabId)]);
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
      targetText: message.targetAvailable ? message.targetText ?? "" : undefined,
      targetAvailable: Boolean(message.targetAvailable),
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

  if (message?.type === "logue:request-panel-generate") {
    void startPanelGenerate().then((started) => {
      if (!started) {
        sendResponse({ ok: false, error: "Open Logue from a page first." });
        return;
      }
      sendResponse({ ok: true });
    }).catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Could not prepare generation.",
    }));
    return true;
  }

  if (message?.type === "logue:return-panel-to-page") {
    void returnPanelToPage().then((returned) => {
      sendResponse(returned ? { ok: true } : { ok: false, error: "Could not return to this page." });
    }).catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Could not return to this page.",
    }));
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
    if (typeof activePanelTabId !== "number") return false;
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
