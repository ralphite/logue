/**
 * Recordings the Host was not there to take.
 *
 * "A recording is saved before it is transcribed" held for a model failure —
 * the Host keeps the audio and only the words are missing. It did not hold for
 * the Host being off: the transcribe call failed, the error was shown, and the
 * audio went with the page. Someone who spoke for a minute into a laptop whose
 * Host had stopped lost the minute.
 *
 * So the audio waits here instead, in the extension's own storage, and the
 * worker sends it the moment the Host answers again.
 */

const KEY = "logue:pending-voice";

/**
 * Ten, because base64 audio is large and this storage is not.
 *
 * `chrome.storage.local` holds about 10MB without asking for more, and a
 * minute of speech is roughly a quarter of a megabyte once encoded. Ten is
 * many days of a Host being down; past that, saying so is better than filling
 * the quota and failing at some unrelated write later.
 */
export const LIMIT = 10;

/**
 * And six megabytes, because counting recordings was the wrong unit.
 *
 * Ten one-minute notes are about two and a half megabytes; ten ten-minute
 * ones are twenty-five, and `chrome.storage.local` holds about ten. Under a
 * count alone the tenth long recording is refused by the quota rather than by
 * us — a rejected write, an error from somewhere else, and no way to tell the
 * person which of their recordings did not survive. Six leaves room for
 * everything else the extension keeps.
 */
export const BUDGET = 6 * 1024 * 1024;

/** Roughly what these occupy, which for base64 is one byte per character. */
function weight(entries: PendingVoice[]): number {
  return entries.reduce((total, one) => total + one.audio.length, 0);
}

export interface PendingVoice {
  id: string;
  audio: string;
  mediaType: string;
  /** How long it ran. Stored because a queued recording has to describe
      itself to the person waiting for it, and audio bytes do not say. */
  seconds?: number;
  /** Failed attempts. A recording that failed twice is a different thing
      from one that has not been tried, and the panel says which. */
  tries?: number;
  project?: string;
  overrides?: unknown;
  source?: unknown;
  parentIds?: string[];
  nearby?: string;
  at: string;
}

function isPending(value: unknown): value is PendingVoice {
  if (typeof value !== "object" || value === null) return false;
  return "id" in value && typeof value.id === "string" && "audio" in value && typeof value.audio === "string";
}

export async function all(): Promise<PendingVoice[]> {
  try {
    const stored = await chrome.storage.local.get(KEY);
    const found: unknown = stored[KEY];
    return Array.isArray(found) ? found.filter(isPending) : [];
  } catch {
    return [];
  }
}

/** Keeps a recording. Returns false when there is no room, rather than silently dropping it. */
export async function keep(recording: Omit<PendingVoice, "id" | "at">): Promise<boolean> {
  const waiting = await all();
  if (waiting.length >= LIMIT) return false;
  if (weight(waiting) + recording.audio.length > BUDGET) return false;
  const entry: PendingVoice = {
    ...recording,
    id: `pending_${Date.now()}_${waiting.length}`,
    at: new Date().toISOString(),
  };
  try {
    await chrome.storage.local.set({ [KEY]: [...waiting, entry] });
    return true;
  } catch {
    // Out of quota. The caller says so rather than pretending it was kept.
    return false;
  }
}

/** Record another failed attempt, so the panel can say "tried twice". */
export async function noteTry(id: string): Promise<void> {
  const waiting = await all();
  const next = waiting.map((one) => {
    if (one.id !== id) return one;
    one.tries = (one.tries ?? 0) + 1;
    return one;
  });
  await chrome.storage.local.set({ [KEY]: next });
}

export async function forget(id: string): Promise<void> {
  const waiting = await all();
  try {
    await chrome.storage.local.set({ [KEY]: waiting.filter((one) => one.id !== id) });
  } catch {
    // It stays queued and will be tried again, which is the safe direction.
  }
}
