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

export interface PendingVoice {
  id: string;
  audio: string;
  mediaType: string;
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

export async function forget(id: string): Promise<void> {
  const waiting = await all();
  try {
    await chrome.storage.local.set({ [KEY]: waiting.filter((one) => one.id !== id) });
  } catch {
    // It stays queued and will be tried again, which is the safe direction.
  }
}
