/**
 * The service worker: owns the offscreen recorder, the side panel, and the
 * keyboard commands. It holds no product state — the Host does that.
 */

import { tagOf } from "./messages";
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
