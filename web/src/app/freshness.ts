/**
 * The page notices when it has been replaced, and says so before it goes.
 *
 * A build here is named by its content hash, so deploying replaces
 * `index-<hash>.js` and deletes the old one. A tab that was already open is
 * then running code whose remaining chunks no longer exist — it does not go
 * stale, it breaks, and the only way out was a manual reload. The extension
 * has looked after itself since X2; this half never did.
 *
 * There is no dev server to run this through, by rule: one machine, one Logue,
 * one address. So this is not hot reloading — nothing is patched in place.
 * The page asks the Host which build it is serving, and when the answer stops
 * matching the one it loaded with, it reloads. What it will not do is reload
 * over unsaved words: an update that costs someone a paragraph is a worse bug
 * than the one it fixes.
 */

import { useEffect, useState } from "react";
import { api } from "../api";

/** How often to ask. Rare enough to be free, often enough to catch a deploy. */
const EVERY_MS = 20_000;

/** Editors hold this while they have something not yet written to the Host. */
let holding = 0;

/** The build this page came from, learned from the first answer. */
let loadedWith: string | undefined;

/**
 * Say that something is unsaved for as long as `pending` is true.
 *
 * A count rather than a flag: two editors can be dirty at once, and the last
 * one to become clean is the one that releases the page.
 */
export function useHoldsUnsaved(pending: boolean): void {
  useEffect(() => {
    if (!pending) return;
    holding += 1;
    return () => {
      holding -= 1;
    };
  }, [pending]);
}

export function somethingUnsaved(): boolean {
  return holding > 0;
}

/** How long hands must be off before a swap may happen in front of someone. */
const IDLE_MS = 120_000;

/** The last moment the person did anything in this tab. */
let lastActiveAt = Date.now();

export function noteActivity(): void {
  lastActiveAt = Date.now();
}

/**
 * Whether the page may trade itself for the newer build right now.
 *
 * "Nothing unsaved" alone was not enough: autosave makes a page clean
 * between two keystrokes, and the swap fired there — under his hands, the
 * caret and half a sentence went with it. The page swaps when nobody is
 * watching (the tab hidden or the window elsewhere) or when the hands have
 * been off for a while; never over unsaved words, as before.
 */
export function swapVerdict(unsaved: boolean, watching: boolean, idleMs: number): boolean {
  if (unsaved) return false;
  if (!watching) return true;
  return idleMs >= IDLE_MS;
}

export function canSwapNow(): boolean {
  const watching = document.visibilityState === "visible" && document.hasFocus();
  return swapVerdict(somethingUnsaved(), watching, Date.now() - lastActiveAt);
}

/**
 * The build the Host is serving, once it differs from the one we loaded with.
 *
 * `undefined` while they agree, which is almost always.
 */
export function useNewerBuild(): string | undefined {
  const [newer, setNewer] = useState<string>();

  useEffect(() => {
    let stopped = false;

    const ask = async () => {
      try {
        const status = await api.status();
        const build = status.build ?? "";
        // A Host with nothing deployed reports "" — a checkout running from
        // source has no deployed build to be behind, and reloading for that
        // would be a loop.
        if (stopped || !build) return;
        // The first answer is what this page counts as its own; every later
        // one is compared against it.
        loadedWith ??= build;
        if (loadedWith !== build) setNewer(build);
      } catch {
        // The Host being unreachable is its own message elsewhere; a missed
        // freshness check is not worth a second one.
      }
    };

    void ask();
    const timer = window.setInterval(() => void ask(), EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  return newer;
}
