/**
 * Recordings that have not become words yet, wherever they are stopped.
 *
 * There are exactly two places one can be stuck, and until now only the first
 * was anybody's job:
 *
 *  * **In the browser.** The Host never got it — it was off, or the address was
 *    wrong. `pending.ts` holds the audio and the worker sends it when the Host
 *    answers. That path worked.
 *  * **On the Host.** The audio arrived and was written to disk before the
 *    model was asked, and then the model refused. The Host has it and always
 *    did — but the only thing that knew its id was the surface that made it,
 *    and a surface is a browser tab. Close the tab and "the recording was kept"
 *    was true and useless. Counted on the author's own workspace the day this
 *    was written: 292 recordings on disk, **86 with nothing pointing at them**.
 *
 * This module is the second half, and the place both halves are read as one
 * list. The Host is the record of what it holds — the extension does not keep
 * a second copy of that and cannot disagree with it.
 */

import { host } from "./api";

/**
 * How many times the worker will try a recording on its own before leaving it.
 *
 * Three was written for a model that refuses for a reason. A model that is
 * *busy* refuses for the evening: on 2026-08-13 three recordings sat there
 * saying "the words did not come back" while the log filled with 503s. The
 * audio is safe either way, so for a failure that passes, the worker keeps
 * asking for about an hour — twelve turns of the five-minute alarm — before
 * it leaves the recording to the person.
 */
export const AUTOMATIC_TRIES = 3;
export const TRIES_WHILE_BUSY = 12;

/** Whether the failure is the kind that passes on its own. */
export function passing(message?: string): boolean {
  return /\b(429|500|502|503|504)\b|busy|high demand|unavailable|overload/i.test(message ?? "");
}

/**
 * Only a recording made in the last half hour is retried without being asked.
 *
 * A workspace accumulates recordings that failed for good reasons — silence,
 * a cancelled thought, a test — and a worker that retried all of them would
 * turn every one into a Source nobody wanted. Recent means "the person is
 * probably still in the room, waiting for words they expected".
 */
export const RECENT_MS = 30 * 60 * 1000;

/**
 * And this long when the model was merely busy.
 *
 * A recording that failed because the service was overloaded is not a
 * recording anybody decided about — it is one nobody has managed to ask yet.
 */
export const BUSY_MS = 6 * 60 * 60 * 1000;

const TRIES_KEY = "logue:capture-tries";

/** A recording the Host is holding, with no words yet. */
export interface Held {
  captureId: string;
  seconds: number;
  createdAt: string;
  /** What the model said when it refused, when it said anything. */
  message?: string;
}

export async function held(): Promise<Held[]> {
  const { captures } = await host.captures();
  return captures.map((one) => ({
    captureId: one.capture_id,
    seconds: one.seconds ?? 0,
    createdAt: one.created_at,
    message: one.message,
  }));
}

/** How many times each held recording has been tried on its own. */
export async function tries(): Promise<Record<string, number>> {
  try {
    const stored = await chrome.storage.local.get(TRIES_KEY);
    const found: unknown = stored[TRIES_KEY];
    if (typeof found !== "object" || found === null) return {};
    const counted: Record<string, number> = {};
    for (const [id, value] of Object.entries(found)) {
      if (typeof value === "number") counted[id] = value;
    }
    return counted;
  } catch {
    return {};
  }
}

export async function noteTry(captureId: string): Promise<void> {
  const counted = await tries();
  counted[captureId] = (counted[captureId] ?? 0) + 1;
  try {
    await chrome.storage.local.set({ [TRIES_KEY]: counted });
  } catch {
    // Not being able to count an attempt is not a reason to stop making them.
  }
}

/**
 * Which of these the worker should try by itself, and in what order.
 *
 * Newest first: the recording someone is waiting for is the last one they
 * made. Old ones are not abandoned — they are listed in the panel with a
 * button, which is the difference between "we gave up" and "we stopped
 * guessing".
 */
export function worthRetrying(items: Held[], counted: Record<string, number>, now: number): Held[] {
  return items
    .filter((one) => now - Date.parse(one.createdAt) < (passing(one.message) ? BUSY_MS : RECENT_MS))
    .filter((one) => (counted[one.captureId] ?? 0) < (passing(one.message) ? TRIES_WHILE_BUSY : AUTOMATIC_TRIES))
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
