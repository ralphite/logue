/**
 * The typed contract between content script, side panel, and background.
 *
 * One union, one narrow function. Anything the background does not recognise is
 * ignored rather than guessed at — other extensions post on this channel too.
 */

export type ToBackground =
  | { type: "logue:open-panel" }
  | { type: "logue:record-start"; sessionId: string }
  | { type: "logue:record-stop"; sessionId: string }
  | { type: "logue:record-cancel"; sessionId: string }
  | { type: "logue:page-context" };

export type FromBackground =
  | { type: "logue:recording-started"; sessionId: string }
  | { type: "logue:recording-stopped"; sessionId: string; audio: string; mediaType: string }
  | { type: "logue:recording-failed"; sessionId: string; message: string }
  | { type: "logue:start-voice" }
  | { type: "logue:start-command" };

/** The one place a message is narrowed; everything else receives a typed value. */
export function tagOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) return undefined;
  const tag: unknown = value.type;
  return typeof tag === "string" && tag.startsWith("logue:") ? tag : undefined;
}

export function isFromBackground(value: unknown): value is FromBackground {
  return tagOf(value) !== undefined;
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
