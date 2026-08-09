/** Runs in the offscreen document; owns the microphone for the whole extension. */

import { tagOf } from "./messages";
import { cancel, holding, recording, start, stop } from "./recorder";

chrome.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
  const tag = tagOf(message);
  if (!tag) return undefined;

  if (tag === "logue:offscreen-start") {
    start().then(
      () => respond({ ok: true }),
      (error: unknown) => respond({ ok: false, message: describe(error) }),
    );
    return true;
  }

  if (tag === "logue:offscreen-stop") {
    stop().then(
      (result) => respond({ ok: true, ...result }),
      (error: unknown) => respond({ ok: false, message: describe(error) }),
    );
    return true;
  }

  if (tag === "logue:offscreen-cancel") {
    cancel();
    respond({ ok: true });
    return false;
  }

  // Whether words are in flight right now. The worker asks before closing
  // this document or reloading the extension — either would end a recording.
  if (tag === "logue:offscreen-busy") {
    // Two different questions, and conflating them is what froze self-update:
    // "is a microphone live" decides whether a reload would cost someone their
    // words; "is there audio nobody has collected" decides whether closing
    // this document would throw words away. After the ceiling the first is
    // false and the second is true — and the second cannot last, because the
    // recorder lets abandoned audio go after a few minutes.
    respond({ ok: true, busy: recording(), holding: holding() });
    return false;
  }

  return undefined;
});

function describe(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access is blocked. Allow it for this extension in Chrome settings.";
  }
  return error instanceof Error ? error.message : "Could not record.";
}
