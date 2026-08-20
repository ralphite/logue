/**
 * The service worker: owns the offscreen recorder, the side panel, and the
 * keyboard commands. It holds no product state — the Host does that.
 */

import { shouldReload } from "./build";
import { tagOf, type HostReply } from "./messages";
import { settingsUrl as microphoneSettingsUrl } from "./microphone";
import { all as pendingVoice, forget, noteTry } from "./pending";
import { noteTry as noteCaptureTry, tries as captureTries, worthRetrying, type Held } from "./unfinished";
import { siblingOf } from "./paths";
import { currentServer, isLoopback } from "./server";

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

/**
 * Every ask of the offscreen document comes back — including when it doesn't.
 *
 * `sendMessage` carries no deadline of its own: sent to a listener that never
 * answers, it simply never settles. `getUserMedia` does exactly that when the
 * operating system is holding a microphone prompt nobody has answered, or when
 * another app owns the device — and neither `createDocument` nor the reply
 * ever arrives. The only symptom is a bar reading "Starting mic…" with a
 * spinner, forever, and nothing on it that ends the wait.
 *
 * A refusal is a state someone can leave. Silence is not, so this turns one
 * into the other.
 */
async function toOffscreen<T>(type: string, deadlineMs = 15_000): Promise<T> {
  const ask = (async () => {
    await ensureOffscreen();
    return await chrome.runtime.sendMessage({ type });
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("The microphone did not come up.")), deadlineMs);
  });
  try {
    const reply: unknown = await Promise.race([ask, deadline]);
    // The offscreen document is ours; its reply shape is the contract above.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return reply as T;
  } finally {
    clearTimeout(timer);
  }
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

/** Set when ⌘⇧K asks for a conversation, read by the panel as it mounts. */
const LISTEN = "logue:listen-at";

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
async function offscreenState(): Promise<{ busy: boolean; holding: boolean }> {
  if (!(await chrome.offscreen.hasDocument?.())) return { busy: false, holding: false };
  try {
    const reply: unknown = await chrome.runtime.sendMessage({ type: "logue:offscreen-busy" });
    if (!reply || typeof reply !== "object") return { busy: false, holding: false };
    return {
      busy: "busy" in reply && Boolean(reply.busy),
      holding: "holding" in reply && Boolean(reply.holding),
    };
  } catch {
    // A document that cannot answer is not recording; it is a leftover from a
    // build that predates the question. Do not let it stall updates forever.
    return { busy: false, holding: false };
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
const SKILL_MENU = "logue-skill:";

/**
 * One string, two levels down a reply whose shape the Host owns.
 *
 * Read through a Map rather than by index: an index into an object typed
 * `unknown` needs an assertion, and an assertion here is a claim about a
 * payload that arrived over the wire — exactly the place not to make one.
 */
function pickString(body: unknown, outer: string, inner: string): string {
  const nested = fieldOf(body, outer);
  const value = fieldOf(nested, inner);
  return typeof value === "string" ? value : "";
}

function fieldOf(value: unknown, name: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  return new Map(Object.entries(value)).get(name);
}

/** The Skills that are about a whole page, which is what a right-click offers. */
interface PageSkill {
  id: string;
  name: string;
  contexts?: string[];
  enabled?: boolean;
}

async function pageSkills(): Promise<PageSkill[]> {
  const reply = await relayToHost({ path: "/v1/skills" });
  if (!reply.ok || reply.status !== 200) return [];
  try {
    const body: unknown = JSON.parse(reply.text);
    const all = body && typeof body === "object" && "skills" in body ? body.skills : [];
    if (!Array.isArray(all)) return [];
    return all
      .filter((one): one is PageSkill => Boolean(one) && typeof one === "object" && "id" in one && "name" in one)
      .filter((one) => one.enabled !== false && (one.contexts ?? []).includes("page"));
  } catch {
    return [];
  }
}

/** When the menus were last rebuilt, so a tab switch does not rebuild them
    again within the half-minute. Worker-lifetime only, which is enough: a
    fresh worker rebuilds on start anyway. */
let menusBuiltAt = 0;

async function buildMenus(): Promise<void> {
  menusBuiltAt = Date.now();
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: SAVE_SELECTION,
      title: "Save to Logue",
      contexts: ["selection"],
    });
    // The Skills that apply to a page, on the menu you get by right-clicking
    // one. Which Skills those are is the Skill's own `contexts` — no second
    // list to keep in step with the first.
    for (const skill of await pageSkills()) {
      chrome.contextMenus.create({
        id: `${SKILL_MENU}${skill.id}`,
        title: `${skill.name} — this page`,
        contexts: ["page"],
      });
    }
  } catch {
    // No menus API, or a race with another start-up doing the same thing.
  }
}

/**
 * The last thing a Skill did, waiting for the panel to show it.
 *
 * Written before the panel opens rather than passed to it: opening a side
 * panel is a request, not a call, and the panel decides for itself when it is
 * ready to read. Written against the page it was run on — see thread.ts.
 */

/**
 * A Skill run whose answer belongs in the panel.
 *
 * Both ways of asking end here — the page's right-click menu, and the Skill
 * list on the selection toolbar — because an answer should have one place to
 * land. It used to have two: the menu wrote into the panel while the selection
 * toolbar unfolded its own block over the page, so the same Skill on the same
 * page put its result somewhere different depending on how it was reached.
 *
 * The caller supplies the text and the line that names it; keeping the Source,
 * running the Skill, and everything the panel reads is written once, here.
 */
async function runSkillIntoThread(options: {
  skillId: string;
  skillName: string;
  /** The line above the answer: "Simplify, on the passage you selected". */
  heading: string;
  /** What is being run on, and how to keep it as a Source. */
  keep: { kind: "page" | "selection"; content: string; url: string; title: string };
  project?: string;
}): Promise<void> {
  const { skillId, skillName, keep, project } = options;
  try {
    if (!keep.content.trim()) throw new Error("There was nothing to read.");

    // Saved as a Source first, so the answer stands on something that exists
    // and can be followed afterwards — the same rule as everywhere else.
    const kept = await relayToHost({
      path: "/v1/materials",
      method: "POST",
      body: JSON.stringify({
        kind: keep.kind,
        content: keep.content,
        project,
        source: { url: keep.url, title: keep.title, domain: domainOf(keep.url) },
      }),
    });
    if (!kept.ok || kept.status >= 400) throw new Error("Logue could not keep this.");
    const sourceId = pickString(JSON.parse(kept.text), "material", "id");

    const ran = await relayToHost({
      path: "/v1/runs",
      method: "POST",
      body: JSON.stringify({
        skill_id: skillId,
        instruction: `${skillName} — ${keep.title || keep.url || "this page"}`,
        project,
        source_ids: sourceId ? [sourceId] : [],
      }),
    });
    if (!ran.ok || ran.status >= 400) throw new Error("The model did not answer.");
    const answered: unknown = JSON.parse(ran.text);
    const output = pickString(answered, "run", "original_output").trim();
    if (!output) throw new Error(pickString(answered, "run", "error") || "The model answered with nothing.");

    // The answer, kept as a Source hanging off the passage it was run on.
    //
    // It used to be written into a storage key the panel read as a
    // conversation — which meant it existed only there, vanished when the
    // conversation was cleared, and could not be found in the app at all.
    // As a derived Source it lands in the panel's one list under the thing
    // it came from, and survives everything.
    await relayToHost({
      path: "/v1/materials",
      method: "POST",
      body: JSON.stringify({
        kind: "derived",
        content: output,
        project,
        parent_ids: sourceId ? [sourceId] : [],
        source: { url: keep.url, title: keep.title, domain: domainOf(keep.url) },
      }),
    });
  } catch (cause) {
    // Nothing to write the failure into but the log: the passage is kept
    // either way, and the panel offers the Skill again on it.
    console.warn("Logue: could not run", skillName, cause);
  }
}

async function runSkillOnPage(skillId: string, skillName: string, tab: chrome.tabs.Tab): Promise<void> {
  const where = tab.title || tab.url || "this page";
  const page: unknown =
    tab.id === undefined
      ? undefined
      : await chrome.tabs.sendMessage(tab.id, { type: "logue:read-page" }).catch(() => undefined);
  const text =
    page && typeof page === "object" && "text" in page && typeof page.text === "string" ? page.text.trim() : "";
  await runSkillIntoThread({
    skillId,
    skillName,
    heading: `${skillName}, on ${where}`,
    keep: { kind: "page", content: text, url: tab.url ?? "", title: tab.title ?? "" },
  });
}

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  const id = String(info.menuItemId);
  if (id.startsWith(SKILL_MENU) && tab) {
    // A menu click is a real gesture, which is the only way a side panel may
    // be opened. Opened first, so the work happens where it can be watched
    // rather than finishing into a panel nobody has seen yet.
    if (tab.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId });
    const skillId = id.slice(SKILL_MENU.length);
    void (async () => {
      const found = (await pageSkills()).find((one) => one.id === skillId);
      await runSkillOnPage(skillId, found?.name ?? "That Skill", tab);
    })();
    return;
  }
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
  // Read per call rather than cached: the worker outlives a change of address,
  // and half the extension still calling the old one is not a state worth
  // having. A `storage.local` read is cheaper than the request that follows.
  const server = await currentServer();
  try {
    const response = await fetch(`${server}${message.path}`, {
      method: message.method ?? "GET",
      headers: { "Content-Type": "application/json", "X-Logue-Client": "extension" },
      body: message.body,
    });
    return { ok: true, status: response.status, text: await response.text() };
  } catch {
    // Naming the address is the whole message when it can be any address: "not
    // running on this Mac" sends someone to the wrong computer entirely.
    return {
      ok: false,
      message: isLoopback(server) ? "Logue is not running on this computer." : `Logue is not answering at ${server}.`,
    };
  }
}

/** Whether a Logue answers at an address, before that address is kept. */
async function probeServer(server: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch(`${server}/v1/status`, { headers: { "X-Logue-Client": "extension" } });
    if (!response.ok) return { ok: false, message: `That address answered ${response.status}, not Logue.` };
    const status: unknown = await response.json();
    // Something answers on most addresses. Only a Logue answers like one.
    if (!status || typeof status !== "object" || !("data_dir" in status)) {
      return { ok: false, message: "Something answered there, but it is not a Logue Host." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: `Nothing answered at ${server}.` };
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
      if (!heard.ok || heard.status !== 200) {
        // Count the attempt before giving up on this pass: a recording that
        // keeps failing should be able to say so rather than sitting in the
        // queue looking like it has simply not had its turn.
        await noteTry(one.id);
        break;
      }
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
            // The page text queued with the audio — filing reads it too.
            context: one.nearby,
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

/**
 * Try again, without being asked, on recordings the Host is holding.
 *
 * The other half of `sendPending`. That one covers a Host that was not there;
 * this one covers a Host that was there and a model that refused — the audio
 * is already on disk, and what is missing is another attempt at the words.
 *
 * Bounded on both sides: only recordings from the last half hour, and only a
 * few attempts each. Everything else stays listed in the panel with a button,
 * because a recording nobody can reach is the one thing this must never
 * produce, and a worker quietly re-transcribing a month of abandoned audio is
 * not the way to avoid it.
 */
// oxlint-disable no-await-in-loop -- one at a time, like sendPending.
async function retryHeld(): Promise<number> {
  let listed: { captures: { capture_id: string; seconds?: number; created_at: string }[] };
  try {
    const answer = await relayToHost({ path: "/v1/captures" });
    if (!answer.ok || answer.status !== 200) return 0;
    listed = JSON.parse(answer.text);
  } catch {
    // The Host is not answering. `sendPending` covers that case; this one has
    // nothing to do until it is back.
    return 0;
  }
  const items: Held[] = (listed.captures ?? []).map((one) => ({
    captureId: one.capture_id,
    seconds: one.seconds ?? 0,
    createdAt: one.created_at,
  }));
  const counted = await captureTries();
  let done = 0;
  for (const one of worthRetrying(items, counted, Date.now())) {
    await noteCaptureTry(one.captureId);
    try {
      const said = await relayToHost({
        path: `/v1/captures/${one.captureId}/transcribe`,
        method: "POST",
        body: "{}",
      });
      if (!said.ok || said.status !== 200) continue;
      const heard: unknown = JSON.parse(said.text);
      if (typeof heard !== "object" || heard === null || !("text" in heard)) continue;
      const text = String(heard.text);
      // Still nothing in it. The audio stays; another attempt is counted, and
      // after a few the panel is where it waits.
      if (!text.trim()) continue;
      const saved = await relayToHost({
        path: "/v1/voice-materials",
        method: "POST",
        body: JSON.stringify({
          capture_id: one.captureId,
          text,
          applied_context: "applied_context" in heard ? heard.applied_context : undefined,
        }),
      });
      if (saved.ok && saved.status === 200) done += 1;
    } catch {
      // Went away mid-pass; the next one will find it still waiting.
      break;
    }
  }
  return done;
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
  const server = await currentServer();
  // The folder a Host can see is this browser's folder only when both are on
  // this computer. A remote Host reports the build of a machine whose extension
  // folder this browser does not load, and reloading for that proves nothing.
  if (!isLoopback(server)) return "";
  const response = await fetch(`${server}/v1/status`);
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
    const offscreen = await offscreenState();
    // A live microphone: never interrupt it. Audio nobody has collected yet:
    // do not throw it away either — but that state releases itself after a
    // few minutes, so waiting here costs one or two checks, not the session.
    // Before the recorder let go, a recording that hit its ceiling on a page
    // that then went away pinned this open for good: X10, by a new door.
    if (offscreen.busy || offscreen.holding) return;
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
  void retryHeld();
  // Skills can be renamed, rearranged or turned off in the app; the beat
  // keeps the right-click menu from trailing the workspace indefinitely.
  void buildMenus();
});

// The flow that matters is arrange-then-right-click-somewhere-else: switching
// tabs — or windows, which fires no tab event — is the moment between those
// two, so both are when the menu is refreshed. Throttled, because switches
// are constant and the menu changes rarely; the throttle is short enough
// that arranging in one tab and returning ten seconds later reads fresh.
const rebuildMenusSoon = () => {
  if (Date.now() - menusBuiltAt < 10_000) return;
  void buildMenus();
};
chrome.tabs.onActivated.addListener(rebuildMenusSoon);
chrome.windows.onFocusChanged.addListener((window) => {
  if (window !== chrome.windows.WINDOW_ID_NONE) rebuildMenusSoon();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  const tag = tagOf(message);
  if (!tag) return undefined;

  switch (tag) {
    case "logue:record-start":
      // `code` travels with the failure: the surface that asked is the one that
      // knows what to offer next, and only it can tell a blocked microphone
      // from a recorder that broke.
      toOffscreen<{ ok: boolean; message?: string; code?: string }>("logue:offscreen-start").then(
        (result) => respond(result),
        (error: unknown) => respond({ ok: false, message: String(error) }),
      );
      return true;

    case "logue:open-microphone-settings":
      chrome.tabs.create({ url: microphoneSettingsUrl() }).then(
        () => respond({ ok: true }),
        (error: unknown) => respond({ ok: false, message: String(error) }),
      );
      return true;

    case "logue:run-skill-on-selection": {
      // Answered at once so the toolbar can put itself away; the panel is
      // where the waiting is shown, and it is already open by now — the page
      // asked for it inside the same click.
      // The union in messages.ts is the contract; the tag has been checked.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const ask = message as {
        skillId: string;
        skillName: string;
        text: string;
        url: string;
        title: string;
        project?: string;
      };
      void runSkillIntoThread({
        skillId: ask.skillId,
        skillName: ask.skillName,
        heading: `${ask.skillName}, on the passage you selected`,
        keep: { kind: "selection", content: ask.text, url: ask.url, title: ask.title },
        project: ask.project,
      });
      respond({ ok: true });
      return true;
    }

    case "logue:pending-send":
      // "Try now" in the panel. The periodic check would get there eventually;
      // a person watching a recording wait should not have to.
      // The panel follows the workspace on its own — see the extension's
      // `sync.ts` — so nothing has to be told about what this finds.
      void Promise.all([sendPending(), retryHeld()]);
      respond({ ok: true });
      return true;
    case "logue:record-stop":
      toOffscreen<{ ok: boolean; audio?: string; mediaType?: string; message?: string; heard?: boolean }>(
        "logue:offscreen-stop",
      ).then(
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

    case "logue:server-probe": {
      // The union in messages.ts is the contract; the tag has been checked.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const ask = message as { server: string };
      probeServer(ask.server).then(respond, () => respond({ ok: false, message: "That address could not be reached." }));
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
      void retryHeld();
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
    if (command === "start-conversation") {
      // The flag is written before the panel opens, because a side panel is
      // requested rather than called: it mounts on its own time and reads
      // this on arrival. A panel already open is told directly as well.
      await chrome.storage.local.set({ [LISTEN]: Date.now() });
      if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
      try {
        await chrome.runtime.sendMessage({ type: "logue:listen" });
      } catch {
        // Nothing open to hear it; the flag covers that case.
      }
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
void retryHeld();
// On every start, not only on install: a reload clears the extension's menus
// and `onInstalled` does not fire for `chrome.runtime.reload()` — the same
// trap that once left orphaned tabs and a dead side panel behind an update.
void buildMenus();
