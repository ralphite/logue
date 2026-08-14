/**
 * The app follows the workspace instead of believing its first answer.
 *
 * His report, 2026-08-12: *"bugs: ext widget/sidepanel and webapp should have
 * data synced."* Both surfaces pulled once and then went quiet — say something
 * in the side panel, and the app showed the list from before it until someone
 * reloaded the page. One workspace, two windows disagreeing about it.
 *
 * So every surface asks the Host, on a short timer, whether anything has been
 * written. The question costs nothing — `/v1/changes` reads no files — and the
 * answer is a counter per kind of record. When a number moves, whatever reads
 * that kind reloads itself, quietly, without a spinner and never over words
 * that have not been saved.
 */

import { useSyncExternalStore } from "react";
import { api } from "../api";

/** How often to ask. Short enough to feel immediate, cheap enough to be free. */
const EVERY_MS = 1500;

let at = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

async function ask(): Promise<void> {
  // Nobody is reading. A tab in the background must not keep the Host busy —
  // and when it comes back it asks at once, below.
  if (document.visibilityState === "hidden") return;
  try {
    const changes = await api.changes();
    if (changes.at === at) return;
    at = changes.at;
    for (const listener of listeners) listener();
  } catch {
    // The Host being down is said elsewhere, by whatever was actually asking
    // for something. A missed heartbeat is not its own message.
  }
}

function watch(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    timer = window.setInterval(() => void ask(), EVERY_MS);
    // Coming back to the tab should not cost a wait: ask on the way in.
    document.addEventListener("visibilitychange", onVisible);
    void ask();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      timer = undefined;
    }
  };
}

function onVisible(): void {
  if (document.visibilityState === "visible") void ask();
}

/**
 * How many writes this workspace has seen. Only its changing means anything.
 *
 * A Host that restarted starts at zero, which is a change like any other and
 * makes every surface reload — after a restart, the honest answer.
 */
export function useWatermark(): number {
  return useSyncExternalStore(watch, () => at, () => at);
}
