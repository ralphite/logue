/**
 * The typed contract between content script, side panel, and background.
 *
 * One union, one narrow function. Anything the background does not recognise is
 * ignored rather than guessed at — other extensions post on this channel too.
 */

export type ToBackground =
  | { type: "logue:build" }
  | { type: "logue:host"; path: string; method?: string; body?: string }
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
  | { type: "logue:record-start"; sessionId: string }
  | { type: "logue:record-stop"; sessionId: string }
  | { type: "logue:record-cancel"; sessionId: string };

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
  | { type: "logue:start-command" }
  /** What is on this page, asked for by the worker on the person's behalf. */
  | { type: "logue:read-page" }
  /** A Skill just ran on this page; the panel has something new to show. */
  | { type: "logue:thread-changed" };

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
  "logue:start-command",
  "logue:read-page",
  "logue:thread-changed",
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
  return chrome.runtime?.id === undefined;
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

export async function send<T = unknown>(message: ToBackground): Promise<T | undefined> {
  try {
    const reply: unknown = await chrome.runtime.sendMessage(message);
    // The background's replies are ours; the union above is the contract.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return reply as T;
  } catch {
    // The worker restarts freely, so a dropped message is not worth showing —
    // unless there is no extension left to restart, which is not a dropped
    // message but the end of this script.
    checkOrphaned();
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
