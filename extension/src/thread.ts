/**
 * One conversation per page.
 *
 * There used to be exactly one, under a single fixed key, with nothing tying
 * it to where you were. So a question asked about an article stayed on screen
 * over a Google Doc, above an unrelated answer, reading as though the two had
 * anything to do with each other. What is on this page is the panel's whole
 * subject; the conversation had been the one part of it that ignored the page.
 *
 * Kept rather than cleared on leaving: going back to an article should bring
 * back what you asked about it. Bounded, though — a browser visits a lot of
 * pages, and a store that only grows is a store that eventually breaks.
 */

/** What the panel and the worker both read. One object, so pruning is one write. */
const THREADS = "logue:threads";

/** The single global conversation this replaced. Removed the first time we look. */
const LEGACY = "logue:thread";

/** How many pages keep their conversation. Beyond this, the oldest goes. */
export const REMEMBERED_PAGES = 20;

export interface ThreadMessage {
  from: "logue" | "skill" | "you";
  text: string;
  at: string;
  steps?: { did: string; detail: string; proposed?: boolean }[];
  proposal?: { id: string; tool: string; reason?: string; title?: string } | null;
  sources?: unknown[];
}

interface Stored {
  /** When this page's conversation was last touched, for pruning. */
  at: string;
  messages: ThreadMessage[];
}

/**
 * Which page this is, for the purpose of "the same page".
 *
 * The fragment is dropped: `#section-2` is a place within one page, not a
 * different page, and treating it as one would split a conversation in half
 * the moment someone clicked a table of contents. The query is kept — for
 * plenty of sites it is the whole address.
 */
export function pageKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

async function all(): Promise<Record<string, Stored>> {
  const bag = await chrome.storage.local.get([THREADS, LEGACY]);
  // The one global conversation cannot be attributed to any page, and keeping
  // it would reproduce the exact bug this replaced — the same messages on
  // every page. It goes, once.
  if (bag[LEGACY] !== undefined) void chrome.storage.local.remove(LEGACY);
  const found: unknown = bag[THREADS];
  if (!found || typeof found !== "object") return {};
  // Storage is shared ground; anything in there that is not ours is not ours.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return found as Record<string, Stored>;
}

export async function readThread(url: string): Promise<ThreadMessage[]> {
  const stored = (await all())[pageKey(url)];
  return Array.isArray(stored?.messages) ? stored.messages : [];
}

export async function writeThread(url: string, messages: ThreadMessage[], at: string): Promise<void> {
  const threads = await all();
  threads[pageKey(url)] = { at, messages };
  await chrome.storage.local.set({ [THREADS]: prune(threads) });
}

export async function clearThread(url: string): Promise<void> {
  const threads = await all();
  delete threads[pageKey(url)];
  await chrome.storage.local.set({ [THREADS]: threads });
}

/** Newest first, and only as many as we said we would keep. */
function prune(threads: Record<string, Stored>): Record<string, Stored> {
  const entries = Object.entries(threads).toSorted((a, b) => (a[1].at < b[1].at ? 1 : -1));
  return Object.fromEntries(entries.slice(0, REMEMBERED_PAGES));
}
