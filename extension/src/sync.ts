/**
 * The panel follows the workspace instead of believing its first answer.
 *
 * The other half of `web/src/app/sync.ts`, and the same report behind it:
 * *"ext widget/sidepanel and webapp should have data synced."* A panel that
 * loaded its Projects, Documents and Sources once showed them until it was
 * closed and opened again — while the app next to it was writing into the
 * same Host.
 *
 * The panel asks only while it is on screen. A side panel behind another
 * window is not being read, and a browser with ten of them open must not
 * become ten pollers.
 */

import { useSyncExternalStore } from "react";
import { host } from "./api";

/** How often to ask. The question reads no files on the Host. */
const EVERY_MS = 1500;

let at = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

async function ask(): Promise<void> {
  if (document.visibilityState === "hidden") return;
  try {
    const changes = await host.changes();
    if (changes.at === at) return;
    at = changes.at;
    for (const listener of listeners) listener();
  } catch {
    // A Host that is not answering is said where something was actually being
    // asked for. A missed heartbeat is not its own message.
  }
}

function onVisible(): void {
  if (document.visibilityState === "visible") void ask();
}

function watch(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    timer = self.setInterval(() => void ask(), EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    void ask();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      self.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      timer = undefined;
    }
  };
}

/**
 * How many writes this workspace has seen. Only its changing means anything.
 *
 * Put it in a hook's dependencies and that hook re-runs whenever anything —
 * this panel, the app, the Host itself — writes something.
 */
export function useWatermark(): number {
  return useSyncExternalStore(watch, () => at, () => at);
}
