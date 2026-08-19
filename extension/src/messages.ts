import type { TextAnchor } from "./anchor";
/**
 * The typed contract between content script, side panel, and background.
 *
 * One union, one narrow function. Anything the background does not recognise is
 * ignored rather than guessed at — other extensions post on this channel too.
 */

export type ToBackground =
  | { type: "logue:build" }
  | { type: "logue:host"; path: string; method?: string; body?: string }
  /**
   * Is there a Logue at this address? Asked before the address is kept, so a
   * typo cannot leave the extension pointed at nothing with no way back.
   */
  | { type: "logue:server-probe"; server: string }
  | { type: "logue:open-panel" }
  /** Try the queued recordings now, rather than waiting for the next check. */
  | { type: "logue:pending-send" }
  /**
   * A Skill picked off the selection toolbar. The answer goes to the panel,
   * the same as the one picked off the right-click menu — so the worker runs
   * it, rather than the page running it and drawing the answer itself.
   */
  | {
      type: "logue:run-skill-on-selection";
      skillId: string;
      skillName: string;
      text: string;
      url: string;
      title: string;
      project?: string;
    }
  /**
   * Open the one page in Chrome that grants an extension the microphone.
   *
   * The worker opens it because a content script cannot, and because a link to
   * a `chrome://` URL is not clickable from an extension page either — leaving
   * a message that names a destination nobody can reach.
   */
  | { type: "logue:open-microphone-settings" }
  | { type: "logue:record-start"; sessionId: string }
  | { type: "logue:record-stop"; sessionId: string }
  | { type: "logue:record-cancel"; sessionId: string }
  /**
   * What is selected on the page, pushed as it changes.
   *
   * The panel used to reach into the page for this with
   * `chrome.scripting.executeScript` at the moment something was pressed —
   * which gets the words and nothing else. Only the page can make a
   * `TextAnchor`, and only while the Range exists; taken later, from a string,
   * a passage cannot say which copy of itself it was. Pushed from here, a
   * comment on a passage can be found again on the page months later.
   *
   * `text` empty means the selection was cleared.
   */
  | { type: "logue:selection"; text: string; anchor?: TextAnchor; url: string; title: string };

/**
 * The Host's answer, relayed.
 *
 * `ok: false` means the request never happened — the Host is not running. A
 * request that reached it and came back a 404 is `ok: true` with that status,
 * because "the Host said no" and "there is no Host" are different problems and
 * only one of them is the person's to fix.
 */
export type HostReply = { ok: true; status: number; text: string } | { ok: false; message: string };

export type FromBackground =
  | { type: "logue:start-voice" }
  /** Find a saved passage on this page and scroll to it. */
  | { type: "logue:locate"; anchor: TextAnchor }
  /** Take an anchor from whatever is selected right now, to repair an old one. */
  | { type: "logue:anchor-here" }
  | { type: "logue:start-command" }
  /** What is on this page, asked for by the worker on the person's behalf. */
  | { type: "logue:read-page" }
  /** A Skill just ran on this page; the panel has something new to show. */
  | { type: "logue:thread-changed" }
  /** ⌘⇧K, when the panel is already open: start listening. */
  | { type: "logue:listen" };

/** The one place a message is narrowed; everything else receives a typed value. */
export function tagOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) return undefined;
  const tag: unknown = value.type;
  return typeof tag === "string" && tag.startsWith("logue:") ? tag : undefined;
}

// Every tag the union above carries. The type and this set are two halves of
// one fact, and a tag added to only one of them type-checks perfectly while
// being dropped at runtime — which is how "read the page" answered nothing.
const FROM_BACKGROUND = new Set<string>([
  "logue:start-voice",
  "logue:locate",
  "logue:anchor-here",
  "logue:start-command",
  "logue:read-page",
  "logue:thread-changed",
  "logue:listen",
]);

export function isFromBackground(value: unknown): value is FromBackground {
  const tag = tagOf(value);
  return tag !== undefined && FROM_BACKGROUND.has(tag);
}

/**
 * This script has outlived the extension that injected it.
 *
 * Replacing an extension does not stop the content scripts it already put on
 * open pages. They keep running — keep tracking the caret, keep drawing bars —
 * against a `chrome.runtime` that will never answer again. `chrome.runtime.id`
 * is the one thing that goes undefined, and it is the difference between a
 * worker that is merely asleep (normal, ignore it) and one that is gone.
 */
export function orphaned(): boolean {
  // Reading `id` on an invalidated context does not answer `undefined` — it
  // throws. So the check written to detect orphaning was the thing that broke
  // on it: `send` caught the failed `sendMessage`, called this, and threw
  // again from inside its own catch. The promise rejected instead of
  // resolving, every `.then` waiting on a reply never ran, and the handler
  // that removes the dead bar from the page never ran either. The page kept a
  // Logue surface whose every button reached nothing, and nothing said why.
  try {
    return chrome.runtime?.id === undefined;
  } catch {
    return true;
  }
}

let onOrphaned: (() => void) | undefined;

/** Runs once, the first time this script is found to be an orphan. */
export function whenOrphaned(handler: () => void): void {
  onOrphaned = handler;
}

function checkOrphaned(): void {
  if (!orphaned()) return;
  const handler = onOrphaned;
  onOrphaned = undefined;
  handler?.();
}

export async function send<T = unknown>(
  message: ToBackground,
  /**
   * How long to wait before giving up on an answer.
   *
   * `sendMessage` promises a reply and does not always keep it: if the worker
   * is torn down while a request is in flight the promise settles neither
   * way, and the surface that was waiting waits for ever. A recording bar
   * that says "Starting mic…" with no error and no way out was this — the
   * background has its own 15s deadline, and the reply carrying that failure
   * is exactly what the dead port swallowed. Left off, the wait is unbounded,
   * which is right for anything a person is not watching.
   */
  withinMs?: number,
): Promise<T | undefined> {
  try {
    const asked = chrome.runtime.sendMessage(message);
    const reply: unknown = withinMs
      ? await Promise.race([
          asked,
          new Promise((resolve) => setTimeout(() => resolve(undefined), withinMs)),
        ])
      : await asked;
    // The background's replies are ours; the union above is the contract.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return reply as T;
  } catch {
    // The worker restarts freely, so a dropped message is not worth showing —
    // unless there is no extension left to restart, which is not a dropped
    // message but the end of this script.
    //
    // Nothing here may throw: this is the path every caller falls back to,
    // and a throw from inside it turns "no answer" into a rejected promise
    // that silently strands whoever was waiting.
    try {
      checkOrphaned();
    } catch {
      // Already gone, and there is nothing left to tell.
    }
    return undefined;
  }
}

/**
 * Watch for the end even when nothing is being sent.
 *
 * The caret bar is drawn from the page alone and needs no round trip, so a
 * script that has been orphaned mid-session would otherwise keep drawing it
 * with every button dead.
 */
export function watchForOrphaning(everyMs = 10_000): () => void {
  const timer = setInterval(checkOrphaned, everyMs);
  // Chrome throttles a hidden tab's timers to roughly once a minute, so the
  // interval alone can leave a dead bar sitting there for the whole minute
  // after someone switches back. Coming to the page is the moment it matters.
  document.addEventListener("visibilitychange", checkOrphaned);
  window.addEventListener("focus", checkOrphaned);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", checkOrphaned);
    window.removeEventListener("focus", checkOrphaned);
  };
}
