/**
 * The service worker: owns the offscreen recorder, the side panel, and the
 * keyboard commands. It holds no product state — the Host does that.
 */

import { HOST } from "./api";
import { shouldReload } from "./build";
import { tagOf, type HostReply } from "./messages";
import { siblingOf } from "./paths";

/**
 * The offscreen page sits beside this worker.
 *
 * The installer keeps a stable extension folder whose manifest points at a
 * versioned `releases/<id>/` directory, so a hard-coded "offscreen.html"
 * resolves to the extension root — where the file does not exist, and the only
 * symptom is a recording that never starts. Derive it from where this worker
 * actually lives instead.
 */
function offscreenPath(): string {
  const background = chrome.runtime.getManifest().background;
  const worker = background && "service_worker" in background ? background.service_worker : "";
  return siblingOf(worker, "offscreen.html");
}

async function ensureOffscreen(): Promise<void> {
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: offscreenPath(),
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Record the microphone for voice capture.",
  });
}

async function toOffscreen<T>(type: string): Promise<T> {
  await ensureOffscreen();
  const reply: unknown = await chrome.runtime.sendMessage({ type });
  // The offscreen document is ours; its reply shape is the contract above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return reply as T;
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// -- the only route to the Host -------------------------------------------

/**
 * Every Host call in the extension comes through here.
 *
 * A content script's `fetch` carries the *page's* origin, so letting the
 * surfaces call the Host directly forced it to answer
 * `Access-Control-Allow-Origin: *` — which also let any page you happened to
 * visit read and rewrite the whole workspace. This worker's requests carry the
 * extension's own origin and its declared host permission, so the Host can
 * refuse everyone else.
 */
async function relayToHost(message: { path: string; method?: string; body?: string }): Promise<HostReply> {
  try {
    const response = await fetch(`${HOST}${message.path}`, {
      method: message.method ?? "GET",
      headers: { "Content-Type": "application/json", "X-Logue-Client": "extension" },
      body: message.body,
    });
    return { ok: true, status: response.status, text: await response.text() };
  } catch {
    return { ok: false, message: "Logue is not running on this Mac." };
  }
}

// -- stay on the deployed build ------------------------------------------

const BUILD_ALARM = "logue:build-check";
const BUILD_CHECK_MINUTES = 5;
const RELOADED_FOR = "logue:reloaded-for";

/** Blank in a build that predates the stamp, which `shouldReload` treats as unknown. */
function runningBuild(): string {
  return chrome.runtime.getManifest().version_name ?? "";
}

async function installedBuild(): Promise<string> {
  const response = await fetch(`${HOST}/v1/status`);
  if (!response.ok) return "";
  const status: unknown = await response.json();
  const build = status && typeof status === "object" && "build" in status ? status.build : undefined;
  return typeof build === "string" ? build : "";
}

/**
 * Never throws.
 *
 * This runs on every worker start, and an unhandled rejection there can take
 * the worker down with it — which would cost the product recording and the
 * side panel to keep a housekeeping check alive.
 */
async function keepUpToDate(): Promise<void> {
  try {
    // A reload tears down the offscreen document, so never reload while one is
    // open: that is a live microphone, and words already spoken.
    if (await chrome.offscreen.hasDocument?.()) return;
    const installed = await installedBuild();
    const stored = await chrome.storage.local.get(RELOADED_FOR);
    const reloadedFor = typeof stored[RELOADED_FOR] === "string" ? stored[RELOADED_FOR] : "";
    if (!shouldReload({ running: runningBuild(), installed, reloadedFor })) return;
    // Recorded before reloading: the worker is about to stop mid-statement.
    await chrome.storage.local.set({ [RELOADED_FOR]: installed });
    chrome.runtime.reload();
  } catch {
    // The Host is off, or the browser withheld an API. Either way there is
    // nothing to compare against and nothing worth saying.
  }
}

async function scheduleBuildCheck(): Promise<void> {
  try {
    // Creating it unconditionally would restart the countdown every time the
    // worker wakes. On a page that talks to the worker at all, it would never
    // reach five minutes and so would never fire.
    if (await chrome.alarms.get(BUILD_ALARM)) return;
    await chrome.alarms.create(BUILD_ALARM, { periodInMinutes: BUILD_CHECK_MINUTES });
  } catch {
    // Without the alarm the check still runs on every worker start.
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BUILD_ALARM) void keepUpToDate();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  const tag = tagOf(message);
  if (!tag) return undefined;

  switch (tag) {
    case "logue:record-start":
      toOffscreen<{ ok: boolean; message?: string }>("logue:offscreen-start").then(
        (result) => respond(result),
        (error: unknown) => respond({ ok: false, message: String(error) }),
      );
      return true;

    case "logue:record-stop":
      toOffscreen<{ ok: boolean; audio?: string; mediaType?: string; message?: string }>("logue:offscreen-stop").then(
        (result) => respond(result),
        (error: unknown) => respond({ ok: false, message: String(error) }),
      );
      return true;

    case "logue:record-cancel":
      toOffscreen<{ ok: boolean }>("logue:offscreen-cancel").then(
        () => respond({ ok: true }),
        () => respond({ ok: true }),
      );
      return true;

    case "logue:host": {
      // The union in messages.ts is the contract; the tag has been checked.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const ask = message as { path: string; method?: string; body?: string };
      relayToHost(ask).then(respond, () => respond({ ok: false, message: "Logue could not reach the Host." }));
      return true;
    }

    case "logue:build":
      // Answer first: the check below can reload the extension, which would
      // tear this response channel down before the page ever heard back.
      respond({ build: runningBuild() });
      // Opening a page is the most likely moment a deploy goes unnoticed, so
      // the question doubles as the trigger — the worker had to wake to answer.
      void keepUpToDate();
      return false;

    case "logue:open-panel":
      if (sender.tab?.windowId !== undefined) void chrome.sidePanel.open({ windowId: sender.tab.windowId });
      respond({ ok: true });
      return false;

    default:
      return undefined;
  }
});

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (command === "toggle-side-panel") {
      if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    }
    if (tab?.id === undefined) return;
    const type = command === "start-voice" ? "logue:start-voice" : "logue:start-command";
    try {
      await chrome.tabs.sendMessage(tab.id, { type });
    } catch {
      // No content script on this page (a chrome:// tab, say). Nothing to do.
    }
  })();
});

// Last, so every listener above is registered before anything can await. A
// worker that dies during start-up answers no messages at all.
void scheduleBuildCheck();
void keepUpToDate();
