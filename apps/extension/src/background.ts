import {
  mergePanelCaptureState,
  sourceFromTab,
  type CaptureIntent,
  type PageCaptureContext,
  type PanelCaptureState,
} from "./capturePrimitives";
import {
  acceptsPassivePageContext,
  consumePanelAutoStart,
  disableDefaultSidePanel,
  disableTabSidePanel,
  isOpenSelectionMenu,
  isSaveSelectionMenu,
  isSelectionMenu,
  openPanelWithPreparedState,
  prepareTabSidePanel,
  panelStateForTab,
  preserveMatchingPanelDraft,
  selectionSavePayload,
  selectionContextMenus,
  sidePanelCommand,
  siblingExtensionDocumentPath,
  toggleSidePanel,
  type SidePanelChrome,
} from "./sidePanelController";
import { createRequestId } from "./requestId";
import { googleDocsEditableSelector } from "./dom";
import type { RecordingBridgeEvent, RecordingControlAction, RecordingPanelEvent } from "./recordingBridge";
import { assertLogueServerStatus, getServerURL, normalizeServerURL } from "./serverConnection";
import {
  readGoogleDocsLauncherAction,
  readGoogleDocsLauncherState,
} from "./googleDocsLauncherBridge";

const panelStoragePrefix = "logue:panel:";
// This is session-only Chrome UI state, not restored product data. Chrome can
// suspend a MV3 worker while its Side Panel stays visible, so a fresh worker
// needs this one bit to keep the toolbar command behaving as a real toggle.
const openPanelStoragePrefix = "logue:side-panel:open:";
const activeTabStoragePrefix = "logue:active-tab:";
const openPanelTabs = new Set<number>();
const openingPanelTabs = new Set<number>();
const panelStates = new Map<number, PanelCaptureState>();
const activeTabByWindow = new Map<number, number>();
const inlineRecorderSessions = new Map<string, { tabId: number; frameId: number }>();
let inlineRecorderDocument: Promise<void> | undefined;
let inlineRecorderPermission: { token: string; sessionId: string } | undefined;

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
  tabId?: number;
  patch?: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projects" | "tags">> & { pendingInsert?: PanelCaptureState["pendingInsert"] | null };
  token?: string;
}

interface PageContextReadyMessage {
  type: "logue:page-context-ready";
}

interface InlineRecorderControlMessage {
  type: "logue:inline-recorder-control";
  action: RecordingControlAction;
  sessionId: string;
}

interface ExtensionRecorderEvent extends Omit<RecordingBridgeEvent, "type"> {
  type: "logue:extension-recorder-event";
}

interface MicrophonePermissionResult {
  type: "logue:microphone-permission-result";
  token: string;
  ok: boolean;
  error?: string;
}

type RuntimeMessage = ApiMessage | OpenPanelMessage | PanelStateMessage | RecordingBridgeEvent | PageContextReadyMessage | InlineRecorderControlMessage | ExtensionRecorderEvent | MicrophonePermissionResult;

const nativeSidePanel = chrome.sidePanel as unknown as SidePanelChrome & {
  onOpened?: chrome.events.Event<(info: { tabId?: number; windowId?: number }) => void>;
  onClosed?: chrome.events.Event<(info: { tabId?: number; windowId?: number }) => void>;
};
const sidePanelDocumentPath = chrome.runtime.getManifest().side_panel!.default_path;
const microphoneDocumentPath = siblingExtensionDocumentPath(sidePanelDocumentPath, "microphone.html");

// The manifest path exists only to register the feature. Keep its global
// instance disabled so switching to a tab that never opened Logue hides it.
void disableDefaultSidePanel(nativeSidePanel).catch(() => undefined);

async function persistPanelState(state: PanelCaptureState) {
  panelStates.set(state.tabId, state);
  await chrome.storage.session.set({
    [`${panelStoragePrefix}${state.tabId}`]: state,
  });
}

function broadcastPanelState(state: PanelCaptureState) {
  void chrome.runtime.sendMessage({
    type: "logue:panel-state-changed",
    tabId: state.tabId,
    state,
  }).catch(() => undefined);
}

function openPanelStorageKey(tabId: number) {
  return `${openPanelStoragePrefix}${tabId}`;
}

function activeTabStorageKey(windowId: number) {
  return `${activeTabStoragePrefix}${windowId}`;
}

function disposeTabCapture(tabId: number) {
  const dispose = () => {
    void chrome.tabs.sendMessage(tabId, { type: "logue:recording-dispose" }).catch(() => undefined);
    void chrome.runtime.sendMessage({ type: "logue:side-panel-hidden", tabId }).catch(() => undefined);
  };
  if (openPanelTabs.has(tabId)) {
    dispose();
    return;
  }
  void chrome.storage.session.get(openPanelStorageKey(tabId)).then((stored) => {
    if (stored[openPanelStorageKey(tabId)] === true) dispose();
  }).catch(() => undefined);
}

async function markPanelOpen(tabId: number) {
  openingPanelTabs.delete(tabId);
  openPanelTabs.add(tabId);
  await chrome.storage.session.set({ [openPanelStorageKey(tabId)]: true });
  // Chrome can keep the Side Panel document alive while hiding it. Reopening
  // therefore does not necessarily remount React or rehydrate state, so tell
  // the existing document to take keyboard focus on every accepted open.
  void chrome.runtime.sendMessage({ type: "logue:side-panel-opened", tabId }).catch(() => undefined);
}

async function clearPanelOpen(tabId: number) {
  openingPanelTabs.delete(tabId);
  openPanelTabs.delete(tabId);
  await chrome.storage.session.remove(openPanelStorageKey(tabId));
}

function isInlineRecorderControl(message: unknown): message is InlineRecorderControlMessage {
  return Boolean(
    message && typeof message === "object" &&
    (message as { type?: unknown }).type === "logue:inline-recorder-control" &&
    ["start", "stop", "cancel"].includes(String((message as { action?: unknown }).action)) &&
    typeof (message as { sessionId?: unknown }).sessionId === "string",
  );
}

function isExtensionRecorderEvent(message: unknown): message is ExtensionRecorderEvent {
  return Boolean(
    message && typeof message === "object" &&
    (message as { type?: unknown }).type === "logue:extension-recorder-event" &&
    ["started", "stopped", "cancelled", "error"].includes(String((message as { event?: unknown }).event)) &&
    typeof (message as { sessionId?: unknown }).sessionId === "string",
  );
}

function isMicrophonePermissionResult(message: unknown): message is MicrophonePermissionResult {
  return Boolean(
    message && typeof message === "object" &&
    (message as { type?: unknown }).type === "logue:microphone-permission-result" &&
    typeof (message as { token?: unknown }).token === "string" &&
    typeof (message as { ok?: unknown }).ok === "boolean",
  );
}

function needsMicrophonePermission(message?: string) {
  return /permission|notallowed|denied/i.test(message ?? "");
}

async function ensureInlineRecorderDocument() {
  if (!inlineRecorderDocument) {
    inlineRecorderDocument = chrome.offscreen.createDocument({
      url: `${microphoneDocumentPath}?mode=recorder`,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Record voice input from the Logue extension on the current page.",
    }).catch((cause: unknown) => {
      // MV3 may restart while its single extension recorder remains alive.
      // In that concrete case Chrome reports that the document already exists;
      // it is the recorder we need, not a failure to surface to the user.
      if (/single offscreen document/i.test(String(cause))) return;
      inlineRecorderDocument = undefined;
      throw cause;
    });
  }
  return inlineRecorderDocument;
}

async function sendInlineRecorderControl(message: InlineRecorderControlMessage) {
  await ensureInlineRecorderDocument();
  const response = await chrome.runtime.sendMessage({
    type: "logue:extension-recorder-control",
    action: message.action,
    sessionId: message.sessionId,
  }) as { ok?: boolean } | undefined;
  if (!response?.ok) throw new Error("Could not start voice input.");
}

function disposeInlineRecorderForTab(tabId: number) {
  for (const [sessionId, target] of inlineRecorderSessions) {
    if (target.tabId !== tabId) continue;
    inlineRecorderSessions.delete(sessionId);
    // A real document reload discards the insertion target. Stop only that
    // concrete recorder session so a previous Docs frame cannot keep the
    // extension microphone alive or relay stale state into the replacement.
    void sendInlineRecorderControl({
      type: "logue:inline-recorder-control",
      action: "cancel",
      sessionId,
    }).catch(() => undefined);
  }
}

async function requestInlineRecorderPermission(sessionId: string) {
  if (inlineRecorderPermission) return;
  const token = createRequestId();
  inlineRecorderPermission = { token, sessionId };
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(`${microphoneDocumentPath}?mode=permission&token=${encodeURIComponent(token)}`),
      type: "popup",
      width: 360,
      height: 180,
      focused: true,
    });
  } catch (cause) {
    inlineRecorderPermission = undefined;
    const target = inlineRecorderSessions.get(sessionId);
    if (target) {
      forwardInlineRecorderEvent({
        type: "logue:extension-recorder-event",
        event: "error",
        sessionId,
        error: cause instanceof Error ? cause.message : "Could not request microphone access.",
      });
    }
  }
}

function forwardInlineRecorderEvent(event: ExtensionRecorderEvent) {
  const target = inlineRecorderSessions.get(event.sessionId);
  if (!target) return;
  const message = { ...event, type: "logue:inline-recorder-event" };
  void chrome.tabs.sendMessage(target.tabId, message, { frameId: target.frameId }).catch(() => undefined);
  if (event.event !== "started") inlineRecorderSessions.delete(event.sessionId);
}

async function routeGoogleDocsLauncherAction(tabId: number, message: unknown) {
  const frames = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (selector) => Boolean(document.querySelector(selector)),
    args: [googleDocsEditableSelector],
  });
  const frameId = frames.find((frame) => frame.frameId !== 0 && frame.result === true)?.frameId;
  if (typeof frameId !== "number") return false;
  try {
    const response = await chrome.tabs.sendMessage(tabId, message, { frameId }) as { ok?: boolean } | undefined;
    return response?.ok === true;
  } catch {
    return false;
  }
}

function stagePanelState(state: PanelCaptureState) {
  const cached = panelStates.get(state.tabId);
  const storageKey = `${panelStoragePrefix}${state.tabId}`;
  // A closed Side Panel may let its MV3 worker suspend. Start the session read
  // before staging the synchronous open state so a cold reopen cannot overwrite
  // the saved draft with an empty shell.
  const storedState = cached ? undefined : chrome.storage.session.get(storageKey);
  const staged = preserveMatchingPanelDraft(state, cached);
  panelStates.set(staged.tabId, staged);
  if (cached) {
    void chrome.storage.session.set({ [storageKey]: staged });
  } else {
    void storedState?.then(async (stored) => {
      const current = panelStates.get(staged.tabId) ?? staged;
      const restoredFromSession = preserveMatchingPanelDraft(
        current,
        stored[storageKey] as PanelCaptureState | undefined,
      );
      // If the user already typed during the short restore window, their live
      // values win over the older session snapshot.
      const restored: PanelCaptureState = {
        ...restoredFromSession,
        ...(current.draft !== undefined ? { draft: current.draft } : {}),
        ...(current.transcript !== undefined ? { transcript: current.transcript } : {}),
        ...(current.projects !== undefined ? { projects: current.projects } : {}),
        ...(current.tags !== undefined ? { tags: current.tags } : {}),
      };
      await persistPanelState(restored);
      broadcastPanelState(restored);
    }).catch(() => {
      const current = panelStates.get(staged.tabId) ?? staged;
      void persistPanelState(current);
    });
  }
  broadcastPanelState(staged);
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

async function openPanel(tabId: number) {
  openingPanelTabs.add(tabId);
  try {
    await nativeSidePanel.open({ tabId });
    await markPanelOpen(tabId);
  } catch (cause) {
    openingPanelTabs.delete(tabId);
    disableSidePanel(tabId);
    throw cause;
  }
}

async function toggleTrackedSidePanel(tabId: number) {
  const result = await toggleSidePanel(nativeSidePanel, openPanelTabs, tabId);
  if (result === "closed") {
    await clearPanelOpen(tabId);
  } else if (result === "opened") {
    await markPanelOpen(tabId);
  }
  return result;
}

async function closeTrackedPanel(tabId: number) {
  if (!nativeSidePanel.close) return;
  try {
    await nativeSidePanel.close({ tabId });
    await clearPanelOpen(tabId);
  } catch {
    // Leave tracking intact when Chrome rejects the close. The native panel is
    // still open, so low-level state must not pretend otherwise.
  }
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
    (context.candidateServerURL === undefined || typeof context.candidateServerURL === "string") &&
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

async function startPanelGenerate(tabId: number) {
  const current = await restorePanelState(tabId);
  if (!current?.targetAvailable) return false;
  const next: PanelCaptureState = {
    ...current,
    intent: "generate",
    updatedAt: Date.now(),
  };
  await persistPanelState(next);
  broadcastPanelState(next);
  return true;
}

async function returnPanelToPage(tabId: number) {
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
    context.candidateServerURL,
  );
  if (!next) return false;
  await persistPanelState(next);
  broadcastPanelState(next);
  return true;
}

async function toggleTabPanel(tab?: chrome.tabs.Tab) {
  const tabId = tab?.id;
  if (typeof tabId !== "number") return;

  if (openPanelTabs.has(tabId)) {
    await toggleTrackedSidePanel(tabId);
    return;
  }
  if (!tab || typeof tab.id !== "number") return;
  // A native panel can outlive its MV3 worker. Do not await this lookup before
  // opening (that would spend Chrome's user gesture), but reconcile it below
  // so the first shortcut after a worker restart is still a real toggle.
  const priorOpen = chrome.storage.session.get(openPanelStorageKey(tabId));
  // The tab-specific path is configured by tab lifecycle events before the
  // toolbar click or shortcut. Stage the local state, then open directly.
  const state = panelStateForTab(
    tab,
    "page",
    sourceFromTab(tab),
  );
  if (!state) return;
  const opening = openPanelWithPreparedState(
    () => { stagePanelState(state); },
    () => toggleTrackedSidePanel(tabId),
  );
  void readPageCaptureContext(tab).then((context) => setPanelContext(
    tab,
    "page",
    undefined,
    context.targetText,
    context.source,
    context.targetAvailable,
    context.candidateServerURL,
  )).catch(() => undefined);
  const wasOpen = (await priorOpen)[openPanelStorageKey(tabId)] === true;
  if (wasOpen && nativeSidePanel.close) {
    await nativeSidePanel.close({ tabId });
    await clearPanelOpen(tabId);
    return;
  }
  try {
    await opening;
  } catch (cause) {
    openingPanelTabs.delete(tabId);
    disableSidePanel(tabId);
    throw cause;
  }
}

async function setPanelContext(
  tab: chrome.tabs.Tab,
  intent: CaptureIntent,
  selectionText?: string,
  targetText?: string,
  source = sourceFromTab(tab),
  targetAvailable = false,
  candidateServerURL?: string,
) {
  const state = panelStateForTab(tab, intent, source, selectionText, targetText, undefined, targetAvailable, candidateServerURL);
  if (!state) return;
  const merged = preserveMatchingPanelDraft(state, await restorePanelState(state.tabId));
  await persistPanelState(merged);
  broadcastPanelState(merged);
}

async function refreshPanelContextFromPage(tab: chrome.tabs.Tab) {
  if (typeof tab.id !== "number") return;
  const current = await restorePanelState(tab.id);
  if (!acceptsPassivePageContext(current)) return;
  const context = await readPageCaptureContext(tab);
  await setPanelContext(
    tab,
    "page",
    context.selectionText,
    context.targetText,
    context.source,
    context.targetAvailable,
    context.candidateServerURL,
  );
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

chrome.runtime.onInstalled.addListener(() => {
  void disableDefaultSidePanel(nativeSidePanel).catch(() => undefined);
  chrome.contextMenus.removeAll(() => {
    selectionContextMenus.forEach((item) => chrome.contextMenus.create(item));
  });
  void chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (typeof tab.id === "number") syncSidePanelOption(tab.id);
    }
  }).catch(() => undefined);
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
  }
});

nativeSidePanel.onOpened?.addListener((info) => {
  if (typeof info.tabId === "number") {
    void markPanelOpen(info.tabId);
  }
});

nativeSidePanel.onClosed?.addListener((info) => {
  const closingTabs = typeof info.tabId === "number" ? [info.tabId] : [...openPanelTabs];
  for (const tabId of closingTabs) {
    void clearPanelOpen(tabId);
    void chrome.tabs.sendMessage(tabId, { type: "logue:recording-dispose" }).catch(() => undefined);
    void chrome.runtime.sendMessage({ type: "logue:side-panel-hidden", tabId }).catch(() => undefined);
  }
});

function prepareSidePanel(tabId: number) {
  return prepareTabSidePanel(nativeSidePanel, tabId, sidePanelDocumentPath);
}

function disableSidePanel(tabId: number) {
  void disableTabSidePanel(nativeSidePanel, tabId).catch(() => undefined);
}

function syncSidePanelOption(tabId: number) {
  // Enabled here means available for this tab; it does not make Chrome show
  // the panel. Visibility still changes only through the explicit open action.
  void prepareSidePanel(tabId).catch(() => undefined);
}

// Rebuild every tab's dedicated path after an MV3 worker restart. The global
// default remains disabled, so a panel is always bound to a concrete tab.
void Promise.all([chrome.storage.session.get(null), chrome.tabs.query({})]).then(([session, tabs]) => {
  for (const [key, value] of Object.entries(session)) {
    if (value !== true || !key.startsWith(openPanelStoragePrefix)) continue;
    const tabId = Number(key.slice(openPanelStoragePrefix.length));
    if (Number.isInteger(tabId)) openPanelTabs.add(tabId);
  }
  for (const tab of tabs) {
    if (typeof tab.id === "number") {
      prepareSidePanel(tab.id).catch(() => undefined);
    }
    if (tab.active && typeof tab.id === "number" && typeof tab.windowId === "number") {
      activeTabByWindow.set(tab.windowId, tab.id);
      void chrome.storage.session.set({ [activeTabStorageKey(tab.windowId)]: tab.id });
    }
  }
}).catch(() => undefined);

chrome.tabs.onCreated.addListener((tab) => {
  if (typeof tab.id === "number") syncSidePanelOption(tab.id);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  disposeInlineRecorderForTab(tabId);
  panelStates.delete(tabId);
  void clearPanelOpen(tabId);
  void chrome.storage.session.remove([`${panelStoragePrefix}${tabId}`, openPanelStorageKey(tabId)]);
  for (const [windowId, activeTabId] of activeTabByWindow) {
    if (activeTabId === tabId) {
      activeTabByWindow.delete(windowId);
      void chrome.storage.session.remove(activeTabStorageKey(windowId));
    }
  }
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  const previousTabId = activeTabByWindow.get(windowId);
  const storedPrevious = typeof previousTabId === "number"
    ? undefined
    : chrome.storage.session.get(activeTabStorageKey(windowId));
  activeTabByWindow.set(windowId, tabId);
  void chrome.storage.session.set({ [activeTabStorageKey(windowId)]: tabId });
  syncSidePanelOption(tabId);
  // Chrome hides a tab-scoped panel when its page loses activation. Dispose
  // only that tab's recorder; its draft remains in session storage for return.
  if (typeof previousTabId === "number" && previousTabId !== tabId) {
    disposeTabCapture(previousTabId);
    return;
  }
  void storedPrevious?.then((stored) => {
    const restoredTabId = stored[activeTabStorageKey(windowId)];
    if (typeof restoredTabId === "number" && restoredTabId !== tabId) disposeTabCapture(restoredTabId);
  }).catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") disposeInlineRecorderForTab(tabId);
  if (changeInfo.status || changeInfo.url) syncSidePanelOption(tabId);
  if (!changeInfo.url || !openPanelTabs.has(tabId)) return;
  void refreshPanelContextFromPage(tab);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  const googleDocsAction = readGoogleDocsLauncherAction(message);
  if (googleDocsAction && sender.frameId === 0) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false });
      return false;
    }
    void routeGoogleDocsLauncherAction(tabId, message).then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (isInlineRecorderControl(message)) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "Voice input needs an active webpage." });
      return false;
    }
    const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
    if (message.action === "start") inlineRecorderSessions.set(message.sessionId, { tabId, frameId });
    if (message.action === "cancel") inlineRecorderSessions.delete(message.sessionId);
    void sendInlineRecorderControl(message).then(() => sendResponse({ ok: true })).catch((cause: unknown) => {
      inlineRecorderSessions.delete(message.sessionId);
      sendResponse({ ok: false, error: cause instanceof Error ? cause.message : "Could not start voice input." });
    });
    return true;
  }

  if (isExtensionRecorderEvent(message)) {
    if (message.event === "error" && needsMicrophonePermission(message.error)) {
      void requestInlineRecorderPermission(message.sessionId);
      return false;
    }
    forwardInlineRecorderEvent(message);
    return false;
  }

  if (isMicrophonePermissionResult(message)) {
    const pending = inlineRecorderPermission;
    if (!pending || pending.token !== message.token) return false;
    inlineRecorderPermission = undefined;
    const target = inlineRecorderSessions.get(pending.sessionId);
    if (!target) return false;
    if (message.ok) {
      void sendInlineRecorderControl({
        type: "logue:inline-recorder-control",
        action: "start",
        sessionId: pending.sessionId,
      }).catch((cause: unknown) => forwardInlineRecorderEvent({
        type: "logue:extension-recorder-event",
        event: "error",
        sessionId: pending.sessionId,
        error: cause instanceof Error ? cause.message : "Could not start voice input.",
      }));
      return false;
    }
    forwardInlineRecorderEvent({
      type: "logue:extension-recorder-event",
      event: "error",
      sessionId: pending.sessionId,
      error: message.error || "Microphone access was not granted.",
    });
    return false;
  }

  const googleDocsState = readGoogleDocsLauncherState(message);
  if (googleDocsState && sender.frameId !== 0 && typeof sender.tab?.id === "number") {
    void chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 }).catch(() => undefined);
    return false;
  }

  if (message?.type === "logue:page-context-ready") {
    const tab = sender.tab;
    if (tab && typeof tab.id === "number") {
      syncSidePanelOption(tab.id);
    }
    if (tab && typeof tab.id === "number" && openPanelTabs.has(tab.id)) {
      void refreshPanelContextFromPage(tab).catch(() => undefined);
    }
    return false;
  }

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
    if (typeof message.tabId !== "number") {
      sendResponse({ ok: true, value: undefined });
      return false;
    }
    void restorePanelState(message.tabId).then((value) => sendResponse({ ok: true, value }));
    return true;
  }

  if (message?.type === "logue:request-panel-generate") {
    if (typeof message.tabId !== "number") return false;
    void startPanelGenerate(message.tabId).then((started) => {
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
    if (typeof message.tabId !== "number") return false;
    void returnPanelToPage(message.tabId).then((returned) => {
      sendResponse(returned ? { ok: true } : { ok: false, error: "Could not return to this page." });
    }).catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Could not return to this page.",
    }));
    return true;
  }

  if (message?.type === "logue:update-panel-state") {
    if (typeof message.tabId !== "number") return false;
    void restorePanelState(message.tabId).then((current) => {
      if (current && message.patch) return persistPanelState(mergePanelCaptureState(current, message.patch));
      return undefined;
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "logue:consume-panel-autostart") {
    if (typeof message.tabId !== "number") return false;
    void Promise.resolve().then(async () => {
      if (!message.token) {
        sendResponse({ ok: true, consumed: false });
        return;
      }
      const current = await restorePanelState(message.tabId!);
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
    if (typeof message.tabId !== "number" || !nativeSidePanel.close) return false;
    void closeTrackedPanel(message.tabId);
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
