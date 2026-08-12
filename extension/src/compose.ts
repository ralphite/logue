/**
 * Adding words to what is already written, without taking any of it away.
 *
 * Speaking into the panel used to send a message of its own and leave whatever
 * had been typed sitting in the box — unread by the model and unsent. Someone
 * who typed half a question and finished it out loud got the half they spoke,
 * answered without the half they typed, and then found the rest still waiting
 * for them.
 */

/** The words, dropped in at the caret, with one space and no lost characters. */
export function joinAtCaret(typed: string, caret: number, words: string): string {
  const at = Math.max(0, Math.min(typed.length, caret));
  const before = typed.slice(0, at).trimEnd();
  const after = typed.slice(at);
  // A space between two things that both have text, and never at the start.
  const gap = before ? " " : "";
  return `${before}${gap}${words}${after}`;
}
