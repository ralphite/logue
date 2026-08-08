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

export type FromBackground = { type: "logue:start-voice" } | { type: "logue:start-command" };

/** The one place a message is narrowed; everything else receives a typed value. */
export function tagOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) return undefined;
  const tag: unknown = value.type;
  return typeof tag === "string" && tag.startsWith("logue:") ? tag : undefined;
}

const FROM_BACKGROUND = new Set(["logue:start-voice", "logue:start-command"]);

export function isFromBackground(value: unknown): value is FromBackground {
  const tag = tagOf(value);
  return tag !== undefined && FROM_BACKGROUND.has(tag);
}

export async function send<T = unknown>(message: ToBackground): Promise<T | undefined> {
  try {
    const reply: unknown = await chrome.runtime.sendMessage(message);
    // The background's replies are ours; the union above is the contract.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return reply as T;
  } catch {
    // The worker restarts freely; a dropped message is not an error worth showing.
    return undefined;
  }
}
