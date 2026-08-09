/**
 * The service worker: owns the offscreen recorder, the side panel, and the
 * keyboard commands. It holds no product state — the Host does that.
 */

import { HOST } from "./api";
import { shouldReload } from "./build";
import { tagOf, type HostReply } from "./messages";
import { all as pendingVoice, forget } from "./pending";
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

/**
 * The offscreen document does not outlive the recording it was opened for.
 *
 * It used to: nothing closed it, so `hasDocument` stayed true from the first
 * recording until the browser quit. That read as harmless — an idle page —
 * but the self-update check treats an open document as a live microphone and
 * stands down. One recording, and this browser silently stopped taking new
 * builds; the fix for a stuck recorder could not reach the person stuck on
 * it, because the stuck recorder was what kept the fix out.
 */
async function closeOffscreen(): Promise<void> {
  try {
    if (await chrome.offscreen.hasDocument?.()) await chrome.offscreen.closeDocument();
  } catch {
    // Already closing, or never open. The next build check asks again.
  }
}

/**
 * One key, both directions.
 *
 * The handler only ever opened, so pressing the shortcut over an open panel
 * did nothing at all — which reads as a broken shortcut, not as a panel that
 * is already where you asked for it. Chrome has no `close()`; disabling the
 * panel is what shuts it, and it is re-enabled immediately so the next press
 * can open it again.
 */
async function toggleSidePanel(windowId: number): Promise<void> {
  const open = (await chrome.runtime.getContexts?.({ contextTypes: ["SIDE_PANEL"] }))?.length ?? 0;
  if (open === 0) {
    await chrome.sidePanel.open({ windowId });
    return;
  }
  await chrome.sidePanel.setOptions({ enabled: false });
  await chrome.sidePanel.setOptions({ enabled: true });
}

/** True while words are in flight — the one moment a reload must wait for. */
async function offscreenBusy(): Promise<boolean> {
  if (!(await chrome.offscreen.hasDocument?.())) return false;
  try {
    const reply: unknown = await chrome.runtime.sendMessage({ type: "logue:offscreen-busy" });
    return Boolean(reply && typeof reply === "object" && "busy" in reply && reply.busy);
  } catch {
    // A document that cannot answer is not recording; it is a leftover from a
    // build that predates the question. Do not let it stall updates forever.
    return false;
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void buildMenus();
  // An update or a reload from chrome://extensions orphans open tabs just as
  // thoroughly as our own does. A first install has no tabs to heal.
  if (details.reason !== "install") void healOpenTabs();
});

const SAVE_SELECTION = "logue-save-selection";

/**
 * Right-click on a selection and keep it.
 *
 * The first version had this and the rebuild dropped it, which took away the
 * one way to capture from a page without going through a floating bar — the
 * way that works on a page where the bar cannot be placed, and the way people
 * reach for out of habit on every other extension they have.
 *
 * Rebuilt from scratch each time rather than added to: `create` throws on a
 * duplicate id, and a worker starts many times a day.
 */
async function buildMenus(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: SAVE_SELECTION,
      title: "Save to Logue",
      contexts: ["selection"],
    });
  } catch {
    // No menus API, or a race with another start-up doing the same thing.
  }
}

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SAVE_SELECTION) return;
  const text = (info.selectionText ?? "").trim();
  if (!text) return;
  void relayToHost({
    path: "/v1/materials",
    method: "POST",
    body: JSON.stringify({
      kind: "selection",
      content: text,
      // The page it came from, which is what makes it a Source rather than a
      // loose paragraph — the same shape the selection bar sends.
      source: { url: info.pageUrl ?? tab?.url ?? "", title: tab?.title ?? "", domain: domainOf(info.pageUrl ?? "") },
    }),
  });
});

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const HEALING = "logue:healing";
const HEAL_NEXT = "logue:heal-next";

/**
 * Heal on the way back from a reload, and only then.
 *
 * `onInstalled` was the obvious hook and the wrong one: it does not fire for
 * `chrome.runtime.reload()`, which is the whole self-update path — so the
 * healing existed only for the case that never needed it. The worker starts
 * again on the way back from a reload, but it also starts a hundred times a
 * day for ordinary messages, and re-injecting into every tab each time would
 * be absurd. So the intent is written down before the reload and read once
 * after it.
 */
async function healIfAsked(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(HEAL_NEXT);
    if (stored[HEAL_NEXT] !== true) return;
    await chrome.storage.local.remove(HEAL_NEXT);
    await Promise.all([healOpenTabs(), healSidePanel()]);
  } catch {
    // Storage is unavailable, so there is no note to act on.
  }
}

/**
 * Put the side panel back after a reload.
 *
 * A reload destroys every extension page, and an open side panel is one — but
 * its container is not. What is left is the Logue panel frame with Chrome's
 * own "Your file couldn't be accessed" inside it, and nothing running in there
 * to notice or recover: the code that would heal it died with the document.
 * The content scripts have been healed since the update path existed; this
 * surface was simply missed, and it only started showing because updates
 * started happening.
 *
 * Re-pointing is the lever: Chrome navigates the panel when its path changes.
 * The path carries a count rather than the build, because the two reloads that
 * matter most — a half-finished deploy, and a Reload pressed by hand — leave
 * the build exactly as it was, and a path that has not changed navigates
 * nothing. This runs only on the way back from a reload, so counting up every
 * time never disturbs a panel someone is reading.
 */
const HEALS = "logue:panel-heals";

async function healSidePanel(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(HEALS);
    const count = (typeof stored[HEALS] === "number" ? stored[HEALS] : 0) + 1;
    await chrome.storage.local.set({ [HEALS]: count });
    await chrome.sidePanel.setOptions({ path: `sidepanel.html?back=${count}`, enabled: true });
  } catch {
    // No panel API, or nothing open. Opening one later loads it fresh anyway.
  }
}

/**
 * Put the surfaces back on pages that were already open.
 *
 * Reloading an extension orphans every content script it had running: the
 * code stays on the page, `chrome.runtime` stops answering it, and the bar
 * quietly does nothing until someone reloads the tab. Since the whole point of
 * updating in the background is that nobody has to do anything, the tabs have
 * to be healed too.
 *
 * It can still fail — a tab the extension has no permission for, a page that
 * refuses injection — and silence about that was the worst kind of wrong: the
 * healing looked like it worked while every open tab kept running the build
 * that had just been replaced.
 */
async function healOpenTabs(): Promise<void> {
  const failures: string[] = [];
  let healed = 0;
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id === undefined) return;
        try {
          // Resolved the same way the offscreen page is: an installed build
          // may not have the worker at the extension root.
          const worker = chrome.runtime.getManifest().background;
          const from = worker && "service_worker" in worker ? worker.service_worker : "";
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [siblingOf(from, "content.js")] });
          healed += 1;
        } catch (cause) {
          failures.push(`${tab.url ?? tab.id}: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
      }),
    );
  } catch (cause) {
    failures.push(`could not list tabs: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  // Kept where it can be read without a debugger attached at the right moment
  // — the worker is asleep by the time anyone thinks to look.
  const note = { at: new Date().toISOString(), healed, failures };
  try {
    await chrome.storage.local.set({ [HEALING]: note });
  } catch {
    // Storage is the nice-to-have here; the console line below is the record.
  }
  if (failures.length > 0) console.warn("Logue could not put its surfaces back on every open tab:", note);
}

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

/**
 * Send the recordings made while the Host was off.
 *
 * Oldest first, and one at a time: the point is that they arrive, not that
 * they arrive quickly. A recording is only forgotten here once the Host has
 * both transcribed it and saved it — a half-done one stays queued, because
 * being sent twice costs a duplicate and being dropped costs the words.
 */
// oxlint-disable no-await-in-loop -- deliberately one at a time; see above.
async function sendPending(): Promise<number> {
  const waiting = await pendingVoice();
  let sent = 0;
  for (const one of waiting) {
    try {
      const heard = await relayToHost({
        path: "/v1/transcribe",
        method: "POST",
        body: JSON.stringify({
          audio: one.audio,
          media_type: one.mediaType,
          project: one.project,
          overrides: one.overrides,
          nearby: one.nearby,
        }),
      });
      if (!heard.ok || heard.status !== 200) break;
      const said: unknown = JSON.parse(heard.text);
      if (typeof said !== "object" || said === null || !("capture_id" in said) || !("text" in said)) break;
      const capture_id = String(said.capture_id);
      const text = String(said.text);
      const applied_context = "applied_context" in said ? said.applied_context : undefined;
      // Nothing heard in it is still a finished recording: the Host has the
      // audio now, so this queue's job is done either way.
      if (text.trim()) {
        const saved = await relayToHost({
          path: "/v1/voice-materials",
          method: "POST",
          body: JSON.stringify({
            capture_id,
            text,
            source: one.source,
            project: one.project,
            parent_ids: one.parentIds,
            applied_context,
          }),
        });
        if (!saved.ok || saved.status !== 200) break;
      }
      await forget(one.id);
      sent += 1;
    } catch {
      // The Host went away again mid-queue. What is left stays left.
      break;
    }
  }
  return sent;
}
// oxlint-enable no-await-in-loop

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
    // A reload tears down the offscreen document, so never reload while a
    // recording is in progress: that is a live microphone, and words already
    // spoken. But an *idle* document must not stand in the way — it once did,
    // and a single recording froze self-update for the rest of the session.
    // Close it and carry on; if it will not close, wait for the next check.
    if (await offscreenBusy()) return;
    await closeOffscreen();
    if (await chrome.offscreen.hasDocument?.()) return;
    const installed = await installedBuild();
    const stored = await chrome.storage.local.get(RELOADED_FOR);
    const reloadedFor = typeof stored[RELOADED_FOR] === "string" ? stored[RELOADED_FOR] : "";
    if (!shouldReload({ running: runningBuild(), installed, reloadedFor })) return;
    // Both recorded before reloading: the worker is about to stop
    // mid-statement, and the tabs it leaves behind are still running the build
    // being replaced.
    await chrome.storage.local.set({ [RELOADED_FOR]: installed, [HEAL_NEXT]: true });
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
  if (alarm.name !== BUILD_ALARM) return;
  void keepUpToDate();
  // The same five minutes is the right cadence for this: a Host that has come
  // back should not need a page opened before it hears what it missed.
  void sendPending();
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
        (result) => {
          respond(result);
          // The audio is in hand; the document has nothing left to hold.
          void closeOffscreen();
        },
        (error: unknown) => respond({ ok: false, message: String(error) }),
      );
      return true;

    case "logue:record-cancel":
      toOffscreen<{ ok: boolean }>("logue:offscreen-cancel").then(
        () => {
          respond({ ok: true });
          void closeOffscreen();
        },
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
      // And it is the moment someone would want the recordings they made
      // while the Host was off to have gone in. Waiting for the five-minute
      // alarm would be waiting for nothing in particular.
      void sendPending();
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
      if (tab?.windowId !== undefined) await toggleSidePanel(tab.windowId);
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
void healIfAsked();
void sendPending();
// On every start, not only on install: a reload clears the extension's menus
// and `onInstalled` does not fire for `chrome.runtime.reload()` — the same
// trap that once left orphaned tabs and a dead side panel behind an update.
void buildMenus();
