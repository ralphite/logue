import type { ExtensionInputTarget, ExtensionPendingCapture, ExtensionTargetBridgeRequest, ExtensionTargetBridgeResponse } from "@logue/ui";
import {
  explicitProjects,
  mergePanelCaptureState,
  preserveTabProjects,
  sourceFromTab,
  tabProjectRequestSender,
  type CaptureIntent,
  type PageCaptureContext,
  type PanelCaptureState,
} from "./capturePrimitives";
import {
  acceptsPassivePageContext,
  consumePanelAutoStart,
  consumePanelAutoRun,
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
  googleDocsLauncherActionMessage,
  readGoogleDocsLauncherAction,
  readGoogleDocsLauncherState,
} from "./googleDocsLauncherBridge";
import type {
  PendingVoicePlan,
  PendingVoiceQueueStatus,
  PendingVoiceRecord,
  PendingVoiceSummary,
  PendingVoiceTranscription,
} from "./pendingVoice";
import { PENDING_VOICE_CAPACITY } from "./pendingVoice";
import type { CaptureContext } from "./voiceProfileModels";

const panelStoragePrefix = "logue:panel:";
// This is session-only Chrome UI state, not restored product data. Chrome can
// suspend a MV3 worker while its Side Panel stays visible, so a fresh worker
// needs this one bit to keep the toolbar command behaving as a real toggle.
const openPanelStoragePrefix = "logue:side-panel:open:";
const activeTabStoragePrefix = "logue:active-tab:";
const pendingVoiceStoragePrefix = "logue:pending-voice:";
const pairingCredentialStoragePrefix = "logue:pairing:";
const pairingCodeStoragePrefix = "logue:pairing-code:";
const extensionClientIdStorageKey = "logue:client-id";
const voiceWriteShortcut = "start-voice-write";
const voiceCommandShortcut = "start-voice-command";
const editableShortcutCommands = new Set([
  voiceWriteShortcut,
  voiceCommandShortcut,
]);
const editableCommands = chrome.commands as typeof chrome.commands & {
  update(details: { name: string; shortcut: string }): Promise<void>;
  reset(commandName: string): Promise<void>;
};
const openPanelTabs = new Set<number>();
const openingPanelTabs = new Set<number>();
const panelStates = new Map<number, PanelCaptureState>();
const activeTabByWindow = new Map<number, number>();
const inlineRecorderSessions = new Map<string, { tabId: number; frameId: number }>();
let inlineRecorderDocument: Promise<void> | undefined;
let inlineRecorderPermission: { token: string; sessionId: string } | undefined;

interface PairingCredential { clientId: string; credential: string; }

async function extensionClientId() {
  const stored = await chrome.storage.local.get(extensionClientIdStorageKey);
  const existing = stored[extensionClientIdStorageKey];
  if (typeof existing === "string" && existing.length >= 8) return existing;
  const created = `chrome-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [extensionClientIdStorageKey]: created });
  return created;
}

async function pairWithHost(origin: string) {
  const clientId = await extensionClientId();
  const pairingCodeKey = `${pairingCodeStoragePrefix}${origin}`;
  const pairingCodeValue = (await chrome.storage.local.get(pairingCodeKey))[pairingCodeKey];
  const response = await globalThis.fetch(`${origin}/v1/pairings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, name: "Logue Chrome Extension", pairing_code: typeof pairingCodeValue === "string" ? pairingCodeValue : "" }) });
  if (!response.ok) throw new Error((await response.text()) || "This Extension could not pair with the Logue Host.");
  const value = await response.json() as { credential: string };
  const pairing: PairingCredential = { clientId, credential: value.credential };
  await chrome.storage.local.set({ [`${pairingCredentialStoragePrefix}${origin}`]: pairing });
  await chrome.storage.local.remove(pairingCodeKey);
  return pairing;
}

async function logueFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === "/v1/status" || url.pathname === "/v1/pairings") return globalThis.fetch(input, init);
  const key = `${pairingCredentialStoragePrefix}${url.origin}`;
  let pairing = (await chrome.storage.local.get(key))[key] as PairingCredential | undefined;
  if (!pairing?.clientId || !pairing.credential) pairing = await pairWithHost(url.origin);
  const authorized = (value: PairingCredential) => {
    const headers = new Headers(init?.headers);
    headers.set("X-Logue-Client", value.clientId);
    headers.set("Authorization", `Bearer ${value.credential}`);
    return globalThis.fetch(input, { ...init, headers });
  };
  let response = await authorized(pairing);
  if (response.status === 401) {
    await chrome.storage.local.remove(key);
    pairing = await pairWithHost(url.origin);
    response = await authorized(pairing);
  }
  return response;
}

interface ApiMessage {
  type: "logue:api";
  action: "status" | "test-server" | "context" | "create-project" | "save-project-association" | "delete-project-association" | "page-materials" | "project-sources" | "transcribe" | "save-voice-comment" | "save-material" | "update-material" | "update-comment-bundle" | "update-source-anchor" | "adopt-voice-material" | "link-voice-comment" | "delete-material" | "retranscribe-material" | "cancel-material-save" | "save-selection" | "delete-capture" | "skills" | "settings" | "skill-run" | "adopt-skill-run" | "adopt-skill-run-document" | "create-document" | "pending-voice-status" | "pending-voice-queue" | "pending-voice-list" | "pending-voice-mark-transcribed" | "pending-voice-complete" | "pending-voice-retry" | "pending-voice-export" | "pending-voice-delete";
  payload?: Record<string, unknown>;
}

interface OpenPanelMessage {
  type: "logue:open-side-panel";
  intent: CaptureIntent;
  source: PanelCaptureState["source"];
  selectionText?: string;
  targetText?: string;
  targetSessionId?: string;
  targetAvailable?: boolean;
  autoStartRecording?: boolean;
  autoRun?: boolean;
  draft?: string;
  projects?: string[];
  commandActivitySourceId?: string;
  commandRunRequestId?: string;
}

interface PanelStateMessage {
  type: "logue:get-panel-state" | "logue:resolve-tab-projects" | "logue:update-panel-state" | "logue:close-side-panel" | "logue:consume-panel-autostart" | "logue:consume-panel-autorun" | "logue:request-panel-generate" | "logue:return-panel-to-page";
  tabId?: number;
  patch?: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projectExplicit" | "tags" | "generationSourceIds" | "pinnedSourceIds">> & {
    projects?: string[] | null;
    projectAssociationId?: string | null;
    projectAssociationScope?: PanelCaptureState["projectAssociationScope"] | null;
    pendingInsert?: PanelCaptureState["pendingInsert"] | null;
    commandResult?: PanelCaptureState["commandResult"] | null;
    commandActivitySourceId?: string | null;
    commandRunRequestId?: string | null;
  };
  token?: string;
}

interface PageContextReadyMessage {
  type: "logue:page-context-ready" | "logue:page-context-changed";
}

interface TabProjectsMessage {
  type: "logue:get-tab-projects";
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

interface WebTargetBridgeMessage {
  type: "logue:web-target-bridge";
  request: ExtensionTargetBridgeRequest;
}

type RuntimeMessage = ApiMessage | OpenPanelMessage | PanelStateMessage | RecordingBridgeEvent | PageContextReadyMessage | TabProjectsMessage | InlineRecorderControlMessage | ExtensionRecorderEvent | MicrophonePermissionResult | WebTargetBridgeMessage;

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

function pendingVoiceStorageKey(id: string) {
  return `${pendingVoiceStoragePrefix}${id}`;
}

function pendingVoiceSummary(record: PendingVoiceRecord): PendingVoiceSummary {
  const { audioBase64: _audioBase64, ...summary } = record;
  return summary;
}

function pendingCaptureForWeb(
  record: PendingVoiceSummary,
): ExtensionPendingCapture {
  return {
    id: record.id,
    createdAt: record.createdAt,
    pageTitle: record.pageTitle,
    state: record.state,
    attempts: record.attempts,
    error: record.error,
    materialId: record.plan?.materialId,
  };
}

function broadcastPendingVoicesChanged() {
  void chrome.runtime.sendMessage({ type: "logue:pending-voices-changed" }).catch(() => undefined);
}

async function readPendingVoice(id: string) {
  const key = pendingVoiceStorageKey(id);
  const stored = await chrome.storage.local.get(key);
  return stored[key] as PendingVoiceRecord | undefined;
}

async function writePendingVoice(record: PendingVoiceRecord) {
  await chrome.storage.local.set({ [pendingVoiceStorageKey(record.id)]: record });
  broadcastPendingVoicesChanged();
  return record;
}

async function removePendingVoice(id: string) {
  await chrome.storage.local.remove(pendingVoiceStorageKey(id));
  broadcastPendingVoicesChanged();
}

async function listPendingVoices() {
  const stored = await chrome.storage.local.get(null);
  return Object.entries(stored)
    .filter(([key]) => key.startsWith(pendingVoiceStoragePrefix))
    .map(([, value]) => pendingVoiceSummary(value as PendingVoiceRecord))
    .sort((first, second) => second.createdAt - first.createdAt);
}

async function pendingVoiceQueueStatus(): Promise<PendingVoiceQueueStatus> {
  const items = await listPendingVoices();
  if (items.length >= PENDING_VOICE_CAPACITY) {
    return {
      writable: false,
      count: items.length,
      capacity: PENDING_VOICE_CAPACITY,
      reason: `Saved recordings are full (${items.length}/${PENDING_VOICE_CAPACITY}). Open Logue and delete one before recording again.`,
    };
  }
  const probeKey = "logue:storage-write-probe";
  try {
    await chrome.storage.local.set({ [probeKey]: { checkedAt: Date.now() } });
    await chrome.storage.local.remove(probeKey);
    return { writable: true, count: items.length, capacity: PENDING_VOICE_CAPACITY };
  } catch {
    await chrome.storage.local.remove(probeKey).catch(() => undefined);
    return {
      writable: false,
      count: items.length,
      capacity: PENDING_VOICE_CAPACITY,
      reason: "Logue cannot save another recording on this Mac. Open Logue and clear a saved recording before trying again.",
    };
  }
}

async function queuePendingVoice(input: {
  id: string;
  audioBase64?: string;
  mimeType?: string;
  tabId?: number;
  frameId?: number;
  pageUrl?: string;
  pageTitle?: string;
  plan?: PendingVoicePlan;
}) {
  if (!input.id.trim()) throw new Error("The recording is missing its local identifier.");
  const existing = await readPendingVoice(input.id);
  if (!existing) {
    const status = await pendingVoiceQueueStatus();
    if (!status.writable) throw new Error(status.reason);
  }
  const audioBase64 = input.audioBase64 || existing?.audioBase64;
  if (!audioBase64) throw new Error("The recording could not be saved locally.");
  const now = Date.now();
  return writePendingVoice({
    id: input.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    audioBase64,
    mimeType: input.mimeType || existing?.mimeType || "audio/webm",
    tabId: input.tabId ?? existing?.tabId,
    frameId: input.frameId ?? existing?.frameId,
    pageUrl: input.pageUrl ?? existing?.pageUrl,
    pageTitle: input.pageTitle ?? existing?.pageTitle,
    state: "pending",
    attempts: existing?.attempts ?? 0,
    plan: input.plan ?? existing?.plan,
    transcription: existing?.transcription,
  });
}

async function markPendingVoiceTranscribed(id: string, transcription: PendingVoiceTranscription) {
  const existing = await readPendingVoice(id);
  if (!existing) throw new Error("The locally saved recording is no longer available.");
  return writePendingVoice({
    ...existing,
    updatedAt: Date.now(),
    state: "pending",
    error: undefined,
    transcription,
  });
}

async function persistStoppedRecording(
  event: Pick<ExtensionRecorderEvent, "sessionId" | "audioBase64" | "mimeType">,
  target: { tabId: number; frameId: number },
) {
  if (!event.audioBase64) throw new Error("The recording is empty.");
  const tab = await chrome.tabs.get(target.tabId).catch(() => undefined);
  await queuePendingVoice({
    id: event.sessionId,
    audioBase64: event.audioBase64,
    mimeType: event.mimeType,
    tabId: target.tabId,
    frameId: target.frameId,
    pageUrl: tab?.url,
    pageTitle: tab?.title,
  });
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

interface LiveExtensionTarget {
  descriptor: ExtensionInputTarget;
  tabId: number;
  frameId: number;
}

type TargetBridgeResult = Omit<ExtensionTargetBridgeResponse, "source" | "type" | "requestId">;

async function isConfiguredLogueWebSender(sender: chrome.runtime.MessageSender) {
  if (sender.frameId !== 0 || !sender.tab?.url) return false;
  try {
    const configuredOrigin = new URL(await getServerURL()).origin;
    return new URL(sender.tab.url).origin === configuredOrigin;
  } catch {
    return false;
  }
}

async function discoverLiveInputTargets(excludedTabId?: number) {
  const tabs = await chrome.tabs.query({});
  const discovered = await Promise.all(tabs.flatMap((tab) => {
    if (typeof tab.id !== "number" || tab.id === excludedTabId || !tab.url || !/^https?:/i.test(tab.url)) return [];
    return [chrome.webNavigation.getAllFrames({ tabId: tab.id }).then((frames) => Promise.all((frames ?? []).map(async (frame) => {
      try {
        const response = await chrome.tabs.sendMessage(tab.id!, { type: "logue:discover-input-target" }, { frameId: frame.frameId }) as { ok?: boolean; value?: ExtensionInputTarget } | undefined;
        if (!response?.ok || !response.value?.id || !response.value.label) return undefined;
        const trustedURL = tab.url!;
        const descriptor: ExtensionInputTarget = {
          id: response.value.id,
          label: response.value.label,
          pageTitle: tab.title?.trim() || new URL(trustedURL).hostname,
          domain: new URL(trustedURL).hostname,
          url: trustedURL,
          lastFocusedAt: Number(response.value.lastFocusedAt) || 0,
        };
        return { descriptor, tabId: tab.id!, frameId: frame.frameId } satisfies LiveExtensionTarget;
      } catch {
        return undefined;
      }
    }))).catch(() => [] as Array<LiveExtensionTarget | undefined>)];
  }));
  const byId = new Map<string, LiveExtensionTarget>();
  for (const target of discovered.flat()) if (target) byId.set(target.descriptor.id, target);
  return [...byId.values()].sort((left, right) => right.descriptor.lastFocusedAt - left.descriptor.lastFocusedAt);
}

async function handleWebTargetBridge(message: WebTargetBridgeMessage, sender: chrome.runtime.MessageSender): Promise<TargetBridgeResult> {
  if (!await isConfiguredLogueWebSender(sender)) return { ok: false, error: "This request did not come from the current Logue Host." };
  const request = message.request;
  if (
    request?.source !== "logue-web" || request.type !== "logue:target-bridge-request" ||
    ![
      "list",
      "insert",
      "undo",
      "shortcuts",
      "update-shortcut",
      "reset-shortcut",
      "pending-captures",
      "retry-pending-capture",
      "export-pending-capture",
      "delete-pending-capture",
    ].includes(request.action)
  ) return { ok: false, error: "Invalid input request." };
  if (
    request.action === "shortcuts" ||
    request.action === "update-shortcut" ||
    request.action === "reset-shortcut"
  ) {
    const list = async () =>
      (await chrome.commands.getAll())
        .filter(
          (command) =>
            command.name && editableShortcutCommands.has(command.name),
        )
        .map((command) => ({
          command: command.name as
            | "start-voice-write"
            | "start-voice-command",
          shortcut: command.shortcut ?? "",
        }));
    if (request.action === "shortcuts") {
      return { ok: true, shortcuts: await list() };
    }
    if (!request.command || !editableShortcutCommands.has(request.command)) {
      return { ok: false, error: "This Logue shortcut cannot be changed." };
    }
    if (request.action === "reset-shortcut") {
      await editableCommands.reset(request.command);
      return { ok: true, shortcuts: await list() };
    }
    const shortcut = request.shortcut?.trim() ?? "";
    if (!shortcut) return { ok: false, error: "Press a complete shortcut." };
    const existing = await list();
    if (
      existing.some(
        (entry) =>
          entry.command !== request.command &&
          entry.shortcut.toLowerCase() === shortcut.toLowerCase(),
      )
    ) {
      return { ok: false, error: "That shortcut is already used by Logue." };
    }
    await editableCommands.update({ name: request.command, shortcut });
    return { ok: true, shortcuts: await list() };
  }
  if (
    request.action === "pending-captures" ||
    request.action === "retry-pending-capture" ||
    request.action === "export-pending-capture" ||
    request.action === "delete-pending-capture"
  ) {
    const list = async () =>
      (await listPendingVoices()).map(pendingCaptureForWeb);
    if (request.action === "pending-captures") {
      void getServerURL()
        .then((apiBase) => replayPendingVoices(apiBase))
        .catch(() => undefined);
      return { ok: true, pendingCaptures: await list() };
    }
    const id = request.pendingCaptureId?.trim();
    if (!id) return { ok: false, error: "Choose a saved recording." };
    if (request.action === "export-pending-capture") {
      const record = await readPendingVoice(id);
      if (!record) {
        return { ok: false, error: "The locally saved recording is no longer available." };
      }
      return {
        ok: true,
        pendingCaptureExport: {
          audioBase64: record.audioBase64,
          mimeType: record.mimeType,
          pageTitle: record.pageTitle,
          createdAt: record.createdAt,
        },
      };
    }
    const apiBase = await getServerURL();
    if (request.action === "retry-pending-capture") {
      await retryPendingVoice(apiBase, id);
    } else {
      await deletePendingVoiceRecord(apiBase, id);
    }
    return { ok: true, pendingCaptures: await list() };
  }
  const targets = await discoverLiveInputTargets(sender.tab?.id);
  if (request.action === "list") return { ok: true, targets: targets.map((target) => target.descriptor) };
  const target = targets.find((candidate) => candidate.descriptor.id === request.sessionId);
  if (!target) return { ok: false, error: "This input is no longer available." };
  if (request.action === "insert") {
    if (!request.text) return { ok: false, error: "The Document is empty." };
    try {
      const response = await chrome.tabs.sendMessage(target.tabId, {
        type: "logue:insert-external-document",
        sessionId: target.descriptor.id,
        text: request.text,
      }, { frameId: target.frameId }) as { ok?: boolean; undoToken?: string; error?: string } | undefined;
      return response?.ok && response.undoToken
        ? { ok: true, target: target.descriptor, undoToken: response.undoToken }
        : { ok: false, error: response?.error || "Could not write to this input." };
    } catch {
      return { ok: false, error: "This input is no longer available." };
    }
  }
  if (!request.undoToken) return { ok: false, error: "This insert can no longer be undone." };
  try {
    const response = await chrome.tabs.sendMessage(target.tabId, {
      type: "logue:undo-external-document",
      sessionId: target.descriptor.id,
      token: request.undoToken,
    }, { frameId: target.frameId }) as { ok?: boolean; error?: string } | undefined;
    return response?.ok
      ? { ok: true, target: target.descriptor }
      : { ok: false, error: response?.error || "This insert can no longer be undone." };
  } catch {
    return { ok: false, error: "This input is no longer available." };
  }
}

function stagePanelState(state: PanelCaptureState) {
  const cached = panelStates.get(state.tabId);
  const storageKey = `${panelStoragePrefix}${state.tabId}`;
  // A closed Side Panel may let its MV3 worker suspend. Start the session read
  // before staging the synchronous open state so a cold reopen cannot overwrite
  // the saved draft with an empty shell.
  const storedState = cached ? undefined : chrome.storage.session.get(storageKey);
  const matching = preserveMatchingPanelDraft(state, cached);
  const staged = state.autoRunToken && state.projectExplicit
    ? matching
    : preserveTabProjects(matching, cached);
  panelStates.set(staged.tabId, staged);
  if (cached) {
    void chrome.storage.session.set({ [storageKey]: staged });
  } else {
    void storedState?.then(async (stored) => {
      const current = panelStates.get(staged.tabId) ?? staged;
      const sessionState = stored[storageKey] as PanelCaptureState | undefined;
      const matchingSession = preserveMatchingPanelDraft(current, sessionState);
      const restoredFromSession = current.autoRunToken && current.projectExplicit
        ? matchingSession
        : preserveTabProjects(matchingSession, sessionState);
      // If the user already typed during the short restore window, their live
      // values win over the older session snapshot.
      const restored: PanelCaptureState = {
        ...restoredFromSession,
        ...(current.draft !== undefined ? { draft: current.draft } : {}),
        ...(current.transcript !== undefined ? { transcript: current.transcript } : {}),
        ...(current.projects !== undefined ? { projects: current.projects } : {}),
        ...(current.projectExplicit !== undefined ? { projectExplicit: current.projectExplicit } : {}),
        ...(current.projectAssociationId !== undefined ? { projectAssociationId: current.projectAssociationId } : {}),
        ...(current.projectAssociationScope !== undefined ? { projectAssociationScope: current.projectAssociationScope } : {}),
        ...(current.tags !== undefined ? { tags: current.tags } : {}),
        ...(current.commandResult !== undefined ? { commandResult: current.commandResult } : {}),
        ...(current.generationSourceIds !== undefined ? { generationSourceIds: current.generationSourceIds } : {}),
        ...(current.pinnedSourceIds !== undefined ? { pinnedSourceIds: current.pinnedSourceIds } : {}),
        ...(current.autoRunToken !== undefined ? { autoRunToken: current.autoRunToken } : {}),
        ...(current.commandActivitySourceId !== undefined ? { commandActivitySourceId: current.commandActivitySourceId } : {}),
        ...(current.commandRunRequestId !== undefined ? { commandRunRequestId: current.commandRunRequestId } : {}),
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
  if (!current) return false;
  const next: PanelCaptureState = {
    ...current,
    intent: "generate",
    generationSourceIds: undefined,
    pinnedSourceIds: undefined,
    updatedAt: Date.now(),
  };
  await persistPanelState(next);
  broadcastPanelState(next);
  return true;
}

async function returnPanelToPage(tabId: number) {
  const current = await restorePanelState(tabId);
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
    context.targetSessionId,
  );
  if (!next) return false;
  const preserved = preserveTabProjects(next, current);
  await persistPanelState(preserved);
  broadcastPanelState(preserved);
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
    context.selectionText,
    context.targetText,
    context.source,
    context.targetAvailable,
    context.candidateServerURL,
    context.pageText,
    context.targetSessionId,
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
  pageText?: string,
  targetSessionId?: string,
) {
  const state = panelStateForTab(tab, intent, source, selectionText, targetText, undefined, targetAvailable, candidateServerURL, targetSessionId);
  if (!state) return;
  const current = await restorePanelState(state.tabId);
  const merged = preserveTabProjects(preserveMatchingPanelDraft({ ...state, pageText }, current), current);
  await persistPanelState(merged);
  broadcastPanelState(merged);
}

async function refreshPanelContextFromPage(tab: chrome.tabs.Tab, targetChanged = false) {
  if (typeof tab.id !== "number") return;
  const current = await restorePanelState(tab.id);
  const context = await readPageCaptureContext(tab);
  if (targetChanged && current?.intent === "generate") {
    const next: PanelCaptureState = {
      ...current,
      source: context.source,
      selectionText: context.selectionText,
      targetText: context.targetAvailable ? context.targetText ?? "" : undefined,
      targetSessionId: context.targetAvailable ? context.targetSessionId : undefined,
      targetAvailable: context.targetAvailable,
      pageText: context.pageText,
      candidateServerURL: context.candidateServerURL,
      updatedAt: Date.now(),
    };
    await persistPanelState(next);
    broadcastPanelState(next);
    return;
  }
  if (!acceptsPassivePageContext(current)) return;
  await setPanelContext(
    tab,
    "page",
    context.selectionText,
    context.targetText,
    context.source,
    context.targetAvailable,
    context.candidateServerURL,
    context.pageText,
    context.targetSessionId,
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

async function openVoiceCommandPanel(tab?: chrome.tabs.Tab) {
  if (!tab || typeof tab.id !== "number") return;
  const isGoogleDocs = (() => {
    try { return new URL(tab.url ?? "").hostname === "docs.google.com"; } catch { return false; }
  })();
  if (isGoogleDocs) {
    const routed = await routeGoogleDocsLauncherAction(tab.id, googleDocsLauncherActionMessage("command-open"));
    if (routed) return;
  } else {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "logue:start-voice-command" }) as { ok?: boolean } | undefined;
      if (response?.ok) return;
    } catch {
      // Restricted pages cannot mount the inline Launcher; keep the Side Panel
      // fallback so the shortcut still has a recoverable destination.
    }
  }
  // Restricted pages cannot host the product-owned Launcher. Do not silently
  // switch modes or create a Side Panel command the user did not review.
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
    const error = new Error(message) as Error & {
      captureId?: string;
      run?: unknown;
    };
    if (typeof value === "object" && value && "capture_id" in value) {
      error.captureId = String((value as { capture_id: unknown }).capture_id);
    }
    if (typeof value === "object" && value && "run" in value) {
      error.run = (value as { run: unknown }).run;
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

function pendingVoiceFallbackPlan(record: PendingVoiceRecord): PendingVoicePlan {
  let domain = "";
  try {
    domain = record.pageUrl ? new URL(record.pageUrl).hostname : "";
  } catch {
    // A recovered note can keep an opaque page URL without inventing a domain.
  }
  return {
    kind: "material",
    transcription: {
      pageUrl: record.pageUrl ?? "",
      pageTitle: record.pageTitle ?? "Recovered voice note",
      instructions: "Transcribe this recording faithfully as a saved voice note.",
    },
    save: {
      kind: "voice",
      source: {
        url: record.pageUrl ?? "",
        title: record.pageTitle ?? "Recovered voice note",
        domain,
      },
      projects: [],
      suggested_projects: [],
      tags: [],
    },
  };
}

async function transcribePendingVoice(apiBase: string, record: PendingVoiceRecord, plan: PendingVoicePlan) {
  if (record.transcription) return record.transcription;
  let request = plan.transcription;
  if (request.profileRequest && !request.appliedContext) {
    const profileRequest = request.profileRequest;
    const query = new URLSearchParams({
      url: request.pageUrl,
      project: profileRequest.project ?? "",
      disable_project_profile: String(Boolean(profileRequest.disable_project_profile)),
      use_default_profile: String(Boolean(profileRequest.use_default_profile)),
      profile_project: profileRequest.profile_project ?? "",
      language: profileRequest.primary_language ?? "",
      topic_vocabulary_id: profileRequest.topic_vocabulary_id ?? "",
    });
    const context = await parseResponse(await logueFetch(`${apiBase}/v1/context?${query.toString()}`)) as CaptureContext;
    const profile = context.resolved_voice_profile;
    request = {
      ...request,
      projectContext: [profile.personal_context, profile.project_overview].filter(Boolean).join("\n\n"),
      glossary: profile.vocabulary.join("\n"),
      appliedContext: {
        page_url: request.pageUrl,
        page_title: request.pageTitle,
        reference_project: profileRequest.project || undefined,
        profile_project: profile.project_name || undefined,
        personal_context: profile.personal_context || undefined,
        project_overview: profile.project_overview || undefined,
        glossary: profile.vocabulary,
        voice_profile_label: profile.label,
        project_profile_mode: profile.project_mode,
        primary_language: profile.primary_language,
        mixed_languages: profile.mixed_languages,
        custom_instructions: profile.custom_instructions || undefined,
        transcription_skill_id: profile.skill_id,
        transcription_skill_name: profile.skill_name,
        transcription_skill_revision: profile.skill_revision,
        transcription_skill_instructions: profile.skill_instructions,
        disable_project_profile: Boolean(profileRequest.disable_project_profile),
        use_default_profile: Boolean(profileRequest.use_default_profile),
        language_override: profileRequest.primary_language || undefined,
        topic_vocabulary_id: profile.topic_vocabulary_id || undefined,
        topic_vocabulary_name: profile.topic_vocabulary_name || undefined,
        recent_adopted_ids: context.recent_adopted_refs?.map((item) => item.id) ?? [],
        recent_adopted_texts: context.recent_adopted_refs?.map((item) => item.text) ?? context.recent_adopted,
      },
    };
  }
  const form = new FormData();
  form.append("request_id", record.id);
  form.append("audio", new Blob([decodeBase64(record.audioBase64)], { type: record.mimeType }), "logue-recording.webm");
  form.append("page_url", request.pageUrl ?? "");
  form.append("page_title", request.pageTitle ?? "");
  form.append("target_text", request.targetText ?? "");
  form.append("selected_text", request.selectedText ?? "");
  form.append("project_context", request.projectContext ?? "");
  form.append("glossary", request.glossary ?? "");
  form.append("instructions", request.instructions ?? "");
  if (request.appliedContext) form.append("applied_context", JSON.stringify(request.appliedContext));
  const value = await parseResponse(await logueFetch(`${apiBase}/v1/transcribe`, { method: "POST", body: form })) as {
    capture_id: string;
    raw_transcript: string;
    text: string;
    applied_context?: Record<string, unknown>;
  };
  const transcription = {
    captureId: value.capture_id,
    rawTranscript: value.raw_transcript,
    text: value.text,
    appliedContext: value.applied_context,
  };
  await markPendingVoiceTranscribed(record.id, transcription);
  return transcription;
}

async function retryPendingVoice(apiBase: string, id: string) {
  const record = await readPendingVoice(id);
  if (!record) throw new Error("The locally saved recording is no longer available.");
  const plan = record.plan ?? pendingVoiceFallbackPlan(record);
  await writePendingVoice({
    ...record,
    state: "retrying",
    attempts: record.attempts + 1,
    updatedAt: Date.now(),
    error: undefined,
  });
  try {
    if (plan.materialId) {
      const profile = plan.transcription.profileRequest ?? {};
      const materialId = encodeURIComponent(plan.materialId);
      const result = await parseResponse(await logueFetch(`${apiBase}/v1/items/${materialId}/retranscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_project: profile.project ?? "",
          profile_project: profile.profile_project ?? "",
          disable_project_profile: Boolean(profile.disable_project_profile),
          use_default_profile: Boolean(profile.use_default_profile),
          primary_language: profile.primary_language ?? "",
          topic_vocabulary_id: profile.topic_vocabulary_id ?? "",
        }),
      }));
      await removePendingVoice(id);
      return result;
    }
    const transcription = await transcribePendingVoice(apiBase, record, plan);
    const voiceFields = {
      request_id: record.id,
      raw_transcript: transcription.rawTranscript,
      transcript: transcription.text,
      capture_id: transcription.captureId,
      applied_context: transcription.appliedContext,
    };
    const endpoint = plan.kind === "selection" ? "/v1/selections" : "/v1/items";
    const body = plan.kind === "selection"
      ? { ...plan.save, ...voiceFields, annotation: transcription.text }
      : { ...plan.save, ...voiceFields, content: transcription.text };
    const result = await parseResponse(await logueFetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    if (plan.command && typeof record.tabId === "number") {
      const command = plan.command;
      const normalized = transcription.text.toLowerCase();
      const saysSelection = /\b(selection|selected text|highlight(?:ed)?)\b|选中|所选/.test(normalized);
      const saysPage = /\b(this page|the page|webpage|article)\b|网页|页面|文章/.test(normalized);
      const saysProject = /\bproject\b|项目/.test(normalized) || Boolean(command.project && normalized.includes(command.project.toLowerCase()));
      const inferredScopes = [saysSelection ? "selection" : "", saysPage ? "page" : "", saysProject ? "project" : ""].filter(Boolean);
      const scope = command.scope === "auto"
        ? (new Set(inferredScopes).size === 1 ? inferredScopes[0] : command.selection ? "selection" : "page")
        : command.scope;
      const activityId = (result as { id?: string } | null)?.id;
      if (activityId) {
        const needsClarification = new Set(inferredScopes).size > 1 ||
          (saysSelection && !command.selection) ||
          (saysProject && !command.project) ||
          (command.scope === "selection" && !command.selection) ||
          (command.scope === "project" && !command.project) ||
          (command.scope !== "auto" && inferredScopes.length === 1 && inferredScopes[0] !== command.scope);
        const resumeMessage = {
          type: "logue:resume-voice-command",
          instruction: transcription.text,
          scope: needsClarification ? "auto" : scope,
          project: command.project,
          source: command.source,
          selection: command.selection,
          pageText: command.pageText,
          targetText: command.targetText,
          targetSessionId: command.targetSessionId,
          targetAvailable: command.targetAvailable,
          activitySourceId: activityId,
          pendingVoiceId: record.id,
          needsClarification,
        };
        const isGoogleDocs = (() => {
          try { return new URL(command.source.url).hostname === "docs.google.com"; } catch { return false; }
        })();
        const response = isGoogleDocs
          ? { ok: await routeGoogleDocsLauncherAction(record.tabId, resumeMessage) }
          : await chrome.tabs.sendMessage(record.tabId, resumeMessage, typeof record.frameId === "number" ? { frameId: record.frameId } : undefined) as { ok?: boolean; error?: string } | undefined;
        if (!response?.ok) throw new Error(response?.error || "Could not restore Voice Command on its page.");
        return result;
      }
    }
    await removePendingVoice(id);
    return result;
  } catch (cause) {
    const current = await readPendingVoice(id);
    if (current) {
      await writePendingVoice({
        ...current,
        state: "failed",
        updatedAt: Date.now(),
        error: cause instanceof Error ? cause.message : "Could not save this recording.",
      });
    }
    throw cause;
  }
}

let pendingVoiceReplay: Promise<void> | undefined;

function replayPendingVoices(apiBase: string) {
  if (pendingVoiceReplay) return pendingVoiceReplay;
  pendingVoiceReplay = (async () => {
    const pending = (await listPendingVoices())
      .filter((record) => record.state !== "retrying")
      .sort((first, second) => first.createdAt - second.createdAt);
    for (const record of pending) {
      const current = await readPendingVoice(record.id);
      if (!current || current.state === "retrying") continue;
      await retryPendingVoice(apiBase, record.id).catch(() => undefined);
    }
  })().finally(() => {
    pendingVoiceReplay = undefined;
  });
  return pendingVoiceReplay;
}

async function replayPendingVoicesForConfiguredHost() {
  const apiBase = await getServerURL();
  const status = await parseResponse(await logueFetch(`${apiBase}/v1/status`));
  assertLogueServerStatus(status);
  await replayPendingVoices(apiBase);
}

async function deletePendingVoiceRecord(apiBase: string, id: string) {
  const record = await readPendingVoice(id);
  if (!record) throw new Error("The locally saved recording is no longer available.");
  if (record.plan?.materialId) {
    await parseResponse(
      await logueFetch(
        `${apiBase}/v1/items/${encodeURIComponent(record.plan.materialId)}`,
        { method: "DELETE" },
      ),
    );
  }
  await removePendingVoice(id);
}

async function handleApiMessage(message: ApiMessage) {
  const payload = message.payload ?? {};
  if (message.action === "pending-voice-status") return pendingVoiceQueueStatus();
  if (message.action === "pending-voice-list") return { items: await listPendingVoices() };
  if (message.action === "pending-voice-export") {
    const record = await readPendingVoice(String(payload.id ?? ""));
    if (!record) throw new Error("The locally saved recording is no longer available.");
    return { audioBase64: record.audioBase64, mimeType: record.mimeType, pageTitle: record.pageTitle, createdAt: record.createdAt };
  }
  if (message.action === "pending-voice-queue") {
    const record = await queuePendingVoice({
      id: String(payload.id ?? ""),
      audioBase64: typeof payload.audioBase64 === "string" ? payload.audioBase64 : undefined,
      mimeType: typeof payload.mimeType === "string" ? payload.mimeType : undefined,
      tabId: typeof payload.tabId === "number" ? payload.tabId : undefined,
      frameId: typeof payload.frameId === "number" ? payload.frameId : undefined,
      pageUrl: typeof payload.pageUrl === "string" ? payload.pageUrl : undefined,
      pageTitle: typeof payload.pageTitle === "string" ? payload.pageTitle : undefined,
      plan: payload.plan as PendingVoicePlan | undefined,
    });
    return pendingVoiceSummary(record);
  }
  if (message.action === "pending-voice-mark-transcribed") {
    const record = await markPendingVoiceTranscribed(String(payload.id ?? ""), payload.transcription as PendingVoiceTranscription);
    return pendingVoiceSummary(record);
  }
  if (message.action === "pending-voice-complete") {
    await removePendingVoice(String(payload.id ?? ""));
    return null;
  }
  const apiBase = message.action === "test-server"
    ? normalizeServerURL(String(payload.serverURL ?? ""))
    : await getServerURL();
  if (message.action === "pending-voice-retry") return retryPendingVoice(apiBase, String(payload.id ?? ""));
  if (message.action === "pending-voice-delete") {
    await deletePendingVoiceRecord(apiBase, String(payload.id ?? ""));
    return null;
  }
  if (message.action === "test-server") {
    const pairingCode = String(payload.pairingCode ?? "").trim();
    if (pairingCode) {
      await chrome.storage.local.set({ [`${pairingCodeStoragePrefix}${new URL(apiBase).origin}`]: pairingCode });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const status = await parseResponse(await logueFetch(`${apiBase}/v1/status`, { signal: controller.signal }));
      assertLogueServerStatus(status);
      await parseResponse(await logueFetch(`${apiBase}/v1/settings`, { signal: controller.signal }));
      void replayPendingVoices(apiBase);
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
    const status = await parseResponse(await logueFetch(`${apiBase}/v1/status`));
    assertLogueServerStatus(status);
    void replayPendingVoices(apiBase);
    return status;
  }
  if (message.action === "context") {
    const query = new URLSearchParams({
      url: String(payload.pageUrl ?? ""),
      project: String(payload.project ?? ""),
      disable_project_profile: String(Boolean(payload.disable_project_profile)),
      use_default_profile: String(Boolean(payload.use_default_profile)),
      profile_project: String(payload.profile_project ?? ""),
      language: String(payload.primary_language ?? ""),
      topic_vocabulary_id: String(payload.topic_vocabulary_id ?? ""),
    });
    return parseResponse(await logueFetch(`${apiBase}/v1/context?${query.toString()}`));
  }
  if (message.action === "save-project-association") {
    return parseResponse(await logueFetch(`${apiBase}/v1/project-associations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: payload.scope, url: payload.pageUrl, project: payload.project }),
    }));
  }
  if (message.action === "create-project") {
    return parseResponse(await logueFetch(`${apiBase}/v1/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name, overview: payload.overview }),
    }));
  }
  if (message.action === "delete-project-association") {
    return parseResponse(await logueFetch(`${apiBase}/v1/project-associations/${encodeURIComponent(String(payload.id ?? ""))}`, { method: "DELETE" }));
  }
  if (message.action === "skills") {
    return parseResponse(await logueFetch(`${apiBase}/v1/skills`));
  }
  if (message.action === "settings") {
    return parseResponse(await logueFetch(`${apiBase}/v1/settings`));
  }
  if (message.action === "page-materials") {
    const query = new URLSearchParams({ source_url: String(payload.pageUrl ?? "") });
    return parseResponse(await logueFetch(`${apiBase}/v1/items?${query.toString()}`));
  }
  if (message.action === "project-sources") {
    const query = new URLSearchParams({ project: String(payload.project ?? ""), query: String(payload.query ?? "") });
    return parseResponse(await logueFetch(`${apiBase}/v1/project-sources?${query.toString()}`));
  }
  if (message.action === "skill-run") {
    return parseResponse(
      await logueFetch(`${apiBase}/v1/skill-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "adopt-skill-run") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await logueFetch(`${apiBase}/v1/skill-runs/${id}/adopt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output: payload.adoptedOutput,
          action: payload.action,
          adoption_id: payload.adoptionId,
          target: payload.target,
        }),
      }),
    );
  }
  if (message.action === "adopt-skill-run-document") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await logueFetch(`${apiBase}/v1/skill-runs/${id}/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          content: payload.content,
          document_id: payload.documentId,
          project: payload.project,
          source_ids: payload.sourceIds,
          context_source_ids: payload.contextSourceIds,
          expected_revision: payload.expectedRevision,
          adoption_id: payload.adoptionId,
          action: payload.adoptionAction,
          target: payload.target,
        }),
      }),
    );
  }
  if (message.action === "create-document") {
    return parseResponse(
      await logueFetch(`${apiBase}/v1/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "cancel-material-save") {
    const requestId = encodeURIComponent(String(payload.requestId ?? ""));
    return parseResponse(await logueFetch(`${apiBase}/v1/cancellations/${requestId}`, { method: "POST" }));
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
    return parseResponse(await logueFetch(`${apiBase}/v1/transcribe`, { method: "POST", body: form }));
  }
  if (message.action === "save-voice-comment") {
    const audioBase64 = String(payload.audioBase64 ?? "");
    if (!audioBase64) throw new Error("The recording is empty.");
    const mimeType = String(payload.mimeType ?? "audio/webm");
    const form = new FormData();
    form.append("audio", new Blob([decodeBase64(audioBase64)], { type: mimeType }), "logue-recording.webm");
    form.append("material", JSON.stringify({
      request_id: payload.requestId,
      source: payload.source,
      suggested_projects: payload.suggestedProjects ?? [],
      tags: payload.tags ?? [],
      applied_context: payload.appliedContext,
    }));
    return parseResponse(await logueFetch(`${apiBase}/v1/voice-comments`, { method: "POST", body: form }));
  }
  if (message.action === "save-material") {
    return parseResponse(
      await logueFetch(`${apiBase}/v1/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "update-material") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await logueFetch(`${apiBase}/v1/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.changes ?? {}),
      }),
    );
  }
  if (message.action === "update-comment-bundle") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await logueFetch(`${apiBase}/v1/items/${id}/bundle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.changes ?? {}),
      }),
    );
  }
  if (message.action === "update-source-anchor") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(await logueFetch(`${apiBase}/v1/items/${id}/anchor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.input ?? {}),
    }));
  }
  if (message.action === "adopt-voice-material") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await logueFetch(`${apiBase}/v1/items/${id}/adopt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adoption_id: payload.adoptionId,
          action: payload.action,
          content: payload.content,
          target: payload.target,
          undone: payload.undone,
        }),
      }),
    );
  }
  if (message.action === "link-voice-comment") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(await logueFetch(`${apiBase}/v1/items/${id}/link-comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: payload.content, source_content: payload.sourceContent, source: payload.source, projects: payload.projects ?? [], tags: payload.tags ?? [] }),
    }));
  }
  if (message.action === "delete-material") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(await logueFetch(`${apiBase}/v1/items/${id}`, { method: "DELETE" }));
  }
  if (message.action === "retranscribe-material") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await logueFetch(`${apiBase}/v1/items/${id}/retranscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.options ?? {}),
      }),
    );
  }
  if (message.action === "save-selection") {
    return parseResponse(
      await logueFetch(`${apiBase}/v1/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "delete-capture") {
    return parseResponse(
      await logueFetch(`${apiBase}/v1/captures/${encodeURIComponent(String(payload.id ?? ""))}`, {
        method: "DELETE",
      }),
    );
  }
  throw new Error("Unknown Logue API action.");
}

async function resolveTabProjects(tab: chrome.tabs.Tab): Promise<string[]> {
  if (typeof tab.id !== "number") return [];
  const tabId = tab.id;
  const current = await restorePanelState(tabId);
  const selectedProject = explicitProjects(current)[0] ?? "";
  if (current?.projectExplicit && !selectedProject) return [];
  const pageUrl = tab.url ?? tab.pendingUrl ?? current?.source.url ?? "";
  let context: CaptureContext;
  try {
    context = await handleApiMessage({
      type: "logue:api",
      action: "context",
      payload: { pageUrl, project: selectedProject },
    }) as CaptureContext;
  } catch {
    // Existing tab intent remains usable while the Host is offline. A new tab
    // has no resolvable rule until the Host returns.
    return explicitProjects(current);
  }

  const latest = await restorePanelState(tabId);
  const liveTab = await chrome.tabs.get(tabId).catch(() => tab);
  const liveURL = liveTab.url ?? liveTab.pendingUrl ?? "";
  const tabChanged = Boolean(liveURL && liveURL !== pageUrl);
  const association = context.project_associations?.[0];
  if ((latest?.updatedAt ?? 0) !== (current?.updatedAt ?? 0)) {
    if (tabChanged) {
      if (selectedProject && context.projects.some((project) => project.name === selectedProject)) return [selectedProject];
      return current?.projectExplicit ? [] : association ? [association.project_name] : [];
    }
    return explicitProjects(latest);
  }

  if (selectedProject && context.projects.some((project) => project.name === selectedProject)) return [selectedProject];
  if (current?.projectExplicit) {
    if (tabChanged) return [];
    const next: PanelCaptureState = {
      ...current,
      projects: [],
      projectAssociationId: undefined,
      projectAssociationScope: undefined,
      generationSourceIds: undefined,
      pinnedSourceIds: undefined,
      updatedAt: Date.now(),
    };
    await persistPanelState(next);
    broadcastPanelState(next);
    return [];
  }

  if (tabChanged) return association ? [association.project_name] : [];
  if (!association) {
    if (current?.projects !== undefined || current?.projectAssociationId) {
      const next: PanelCaptureState = {
        ...current,
        projects: undefined,
        projectExplicit: false,
        projectAssociationId: undefined,
        projectAssociationScope: undefined,
        generationSourceIds: undefined,
        pinnedSourceIds: undefined,
        updatedAt: Date.now(),
      };
      await persistPanelState(next);
      broadcastPanelState(next);
    }
    return [];
  }
  const next: PanelCaptureState = current ? {
    ...current,
    projects: [association.project_name],
    projectExplicit: false,
    projectAssociationId: association.id,
    projectAssociationScope: association.scope,
    generationSourceIds: selectedProject === association.project_name ? current.generationSourceIds : undefined,
    pinnedSourceIds: selectedProject === association.project_name ? current.pinnedSourceIds : undefined,
    updatedAt: Date.now(),
  } : {
    tabId,
    intent: "page",
    source: sourceFromTab(liveTab),
    targetAvailable: false,
    projects: [association.project_name],
    projectExplicit: false,
    projectAssociationId: association.id,
    projectAssociationScope: association.scope,
    updatedAt: Date.now(),
  };
  await persistPanelState(next);
  broadcastPanelState(next);
  return [association.project_name];
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

void replayPendingVoicesForConfiguredHost().catch(() => undefined);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (
    !isSelectionMenu(info.menuItemId) ||
    !tab || typeof tab.id !== "number" || !info.selectionText
  ) return;
  if (isSaveSelectionMenu(info.menuItemId)) {
    const captureTab = info.pageUrl ? { ...tab, url: info.pageUrl } : tab;
    void resolveTabProjects(captureTab).then((projects) => handleApiMessage({
        type: "logue:api",
        action: "save-selection",
        payload: { ...selectionSavePayload(captureTab, info.selectionText!, createRequestId()), projects },
      })).catch(() => undefined);
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
  if (command === voiceWriteShortcut && tab?.id) {
    void discoverLiveInputTargets()
      .then((targets) =>
        targets.find((target) => target.tabId === tab.id),
      )
      .then((target) =>
        target
          ? chrome.tabs.sendMessage(
              target.tabId,
              { type: "logue:start-inline-voice" },
              { frameId: target.frameId },
            )
          : undefined,
      )
      .catch(() => undefined);
    return;
  }
  if (command === voiceCommandShortcut) {
    void openVoiceCommandPanel(tab).catch(() => undefined);
    return;
  }
  if (command === sidePanelCommand && tab) void toggleTabPanel(tab).catch(() => undefined);
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
  if ((!changeInfo.url && changeInfo.status !== "loading") || !openPanelTabs.has(tabId)) return;
  void refreshPanelContextFromPage(tab, true);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message?.type === "logue:web-target-bridge") {
    void handleWebTargetBridge(message, sender)
      .then(sendResponse)
      .catch((cause: unknown) => sendResponse({ ok: false, error: cause instanceof Error ? cause.message : "Could not reach the selected input." }));
    return true;
  }
  const projectRequestTabId = tabProjectRequestSender(message, sender.tab?.id);
  if (projectRequestTabId !== undefined) {
    void resolveTabProjects(sender.tab!)
      .then((projects) => sendResponse({ ok: true, value: projects }))
      .catch(() => sendResponse({ ok: true, value: [] }));
    return true;
  }

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
    if (message.action === "stop" && inlineRecorderSessions.has(message.sessionId)) inlineRecorderSessions.set(message.sessionId, { tabId, frameId });
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
    if (message.event === "stopped") {
      const target = inlineRecorderSessions.get(message.sessionId);
      if (!target) return false;
      void persistStoppedRecording(message, target)
        .then(() => forwardInlineRecorderEvent(message))
        .catch((cause: unknown) => forwardInlineRecorderEvent({
          type: "logue:extension-recorder-event",
          event: "error",
          sessionId: message.sessionId,
          error: cause instanceof Error ? cause.message : "The recording could not be saved locally.",
        }));
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

  if (message?.type === "logue:page-context-ready" || message?.type === "logue:page-context-changed") {
    const tab = sender.tab;
    if (tab && typeof tab.id === "number") {
      syncSidePanelOption(tab.id);
    }
    if (tab && typeof tab.id === "number" && openPanelTabs.has(tab.id)) {
      void refreshPanelContextFromPage(tab, true).catch(() => undefined);
    }
    return false;
  }

  if (message?.type === "logue:recording-bridge-event") {
    if (typeof sender.tab?.id === "number") {
      const tabId = sender.tab.id;
      const forward = (event: RecordingBridgeEvent) => {
        const panelEvent: RecordingPanelEvent = {
          ...event,
          type: "logue:recording-event",
          tabId,
        };
        void chrome.runtime.sendMessage(panelEvent).catch(() => undefined);
      };
      if (message.event === "stopped") {
        void persistStoppedRecording(
          message,
          { tabId, frameId: typeof sender.frameId === "number" ? sender.frameId : 0 },
        ).then(() => forward(message)).catch((cause: unknown) => forward({
          type: "logue:recording-bridge-event",
          event: "error",
          sessionId: message.sessionId,
          error: cause instanceof Error ? cause.message : "The recording could not be saved locally.",
        }));
      } else {
        forward(message);
      }
    }
    return false;
  }

  if (message?.type === "logue:open-side-panel") {
    const tab = sender.tab;
    if (!tab || typeof tab.id !== "number") return false;
    void restorePanelState(tab.id).then((current) => {
      const openedState: PanelCaptureState = {
        tabId: tab.id!,
        intent: message.intent,
        source: message.source,
        selectionText: message.selectionText?.trim() || undefined,
        targetText: message.targetAvailable ? message.targetText ?? "" : undefined,
        targetSessionId: message.targetAvailable ? message.targetSessionId : undefined,
        targetAvailable: Boolean(message.targetAvailable),
        autoStartToken: message.autoStartRecording ? createRequestId() : undefined,
        autoRunToken: message.autoRun ? createRequestId() : undefined,
        draft: message.draft?.trim() || undefined,
        projects: message.projects?.filter(Boolean).slice(0, 1),
        projectExplicit: Boolean(message.projects?.length),
        commandActivitySourceId: message.commandActivitySourceId,
        commandRunRequestId: message.commandRunRequestId,
        updatedAt: Date.now(),
      };
      const nextState = message.projects?.length
        ? openedState
        : preserveTabProjects(openedState, current);
      return openPanelWithPreparedState(
        () => { stagePanelState(nextState); },
        () => openPanel(tab.id!),
      );
    }).then(() => sendResponse({ ok: true })).catch((error: unknown) => sendResponse({
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

  if (message?.type === "logue:resolve-tab-projects") {
    if (typeof message.tabId !== "number") {
      sendResponse({ ok: true, value: undefined });
      return false;
    }
    void chrome.tabs.get(message.tabId).then(async (tab) => {
      await resolveTabProjects(tab);
      return restorePanelState(message.tabId!);
    }).then((value) => sendResponse({ ok: true, value })).catch((cause: unknown) => sendResponse({
      ok: false,
      error: cause instanceof Error ? cause.message : "Could not resolve the active Project.",
    }));
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

  if (message?.type === "logue:consume-panel-autorun") {
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
      const result = consumePanelAutoRun(current, message.token);
      if (result.consumed) await persistPanelState(result.state);
      sendResponse({ ok: true, consumed: result.consumed });
    }).catch((error: unknown) => sendResponse({
      ok: false,
      consumed: false,
      error: error instanceof Error ? error.message : "Could not run this command.",
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
        run:
          error instanceof Error && "run" in error
            ? (error as Error & { run?: unknown }).run
            : undefined,
      }),
    );
  return true;
});
