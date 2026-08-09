/**
 * Microphone capture, running in an offscreen document.
 *
 * A content script cannot hold a microphone permission that survives page
 * navigation, and the service worker has no DOM. An offscreen document is the
 * one place in an MV3 extension that has both.
 */

let recorder: MediaRecorder | undefined;
let chunks: Blob[] = [];
let stream: MediaStream | undefined;
let ceiling: ReturnType<typeof setTimeout> | undefined;
let abandon: ReturnType<typeof setTimeout> | undefined;
let startedAt = 0;

/**
 * Ten minutes, after which the microphone stops itself and keeps what it has.
 *
 * Not a limit on what anyone may say — it is the point past which carrying on
 * costs more than it returns. Everything recorded lives in memory until the
 * stop, and a recording nobody ends (a tab left open, a session forgotten)
 * would otherwise grow until something else breaks. Stopping keeps the audio;
 * it is the one outcome that loses nothing.
 */
export const MAX_MS = 10 * 60 * 1000;

/** How long the ceiling's kept audio waits for somebody to come for it. */
export const ABANDONED_MS = 3 * 60 * 1000;

/** The one whose end is worth warning about: past a minute this is a long one. */
export const LONG_MS = 60 * 1000;

/** How long the current recording has been running, in milliseconds. */
export function elapsed(): number {
  return recorder && startedAt ? Date.now() - startedAt : 0;
}

/** True once the ceiling stopped it — the audio is waiting, the microphone is not. */
export function capped(): boolean {
  return chunks.length > 0 && recorder?.state === "inactive";
}

export function preferredMimeType(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export async function start(): Promise<void> {
  // A recorder left behind by a session nobody finished — a tab closed
  // mid-recording, a surface that went away while the microphone was open —
  // used to refuse every recording after it, for good. The bar said "Already
  // recording" over a page with no recording on it and offered no way out.
  // Whatever it was holding is unreachable by then, so let it go.
  if (recorder) cancel();
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = preferredMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  // A second at a time, so a recording that ends unexpectedly — the ceiling
  // below, a tab closing, the page going away — still has everything up to
  // that second. Without it a single chunk arrives at stop, and anything that
  // prevents the stop takes the whole recording with it.
  recorder.start(1000);
  startedAt = Date.now();

  const active = recorder;
  ceiling = setTimeout(() => {
    // Stop the microphone but keep the chunks: the words are already spoken,
    // and the person still has to be able to accept them.
    if (active.state !== "inactive") active.stop();
    stream?.getTracks().forEach((track) => track.stop());
    // …but not forever. A page that went away — closed, navigated, its
    // content script gone — is never coming back for them, and until it does
    // this document stays open and self-update keeps standing aside for a
    // recording nobody is making. That is X10 again, through the door the
    // ceiling opened. A live page collects at the ceiling too (useVoice has
    // the same clock), so this grace period only ever ends abandoned ones.
    abandon = setTimeout(release, ABANDONED_MS);
  }, MAX_MS);
}

function release() {
  clearTimeout(ceiling);
  clearTimeout(abandon);
  ceiling = undefined;
  abandon = undefined;
  startedAt = 0;
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  recorder = undefined;
}

/** Stops and returns the recording as base64, which is how the Host takes it. */
export async function stop(): Promise<{ audio: string; mediaType: string }> {
  const active = recorder;
  if (!active) throw new Error("Not recording.");
  const mediaType = active.mimeType.split(";")[0] || "audio/webm";

  const blob =
    // Already stopped, because the ceiling ended it. Waiting for `onstop` here
    // would wait forever — the event fired minutes ago — and ten minutes of
    // speech would hang on Accept and never come back.
    active.state === "inactive"
      ? new Blob(chunks, { type: mediaType })
      : await new Promise<Blob>((resolve) => {
          active.onstop = () => resolve(new Blob(chunks, { type: mediaType }));
          active.stop();
        });
  release();
  chunks = [];

  return { audio: base64Of(await blob.arrayBuffer()), mediaType };
}

/**
 * Base64, a slice at a time.
 *
 * One character at a time is fine for a sentence and not for ten minutes:
 * two and a half million appends to a growing string, on the thread the page
 * is drawn on. `apply` over a slice hands the work to the engine, and the
 * slice is small enough not to overflow the argument list.
 */
function base64Of(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const SLICE = 0x8000;
  let binary = "";
  for (let at = 0; at < bytes.length; at += SLICE) {
    binary += String.fromCharCode(...bytes.subarray(at, at + SLICE));
  }
  return btoa(binary);
}

export function cancel(): void {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  chunks = [];
  release();
}

/** Whether a recording is in progress — someone's words are in flight. */
export function recording(): boolean {
  // The microphone being live, not an object still existing. Everything that
  // asks this is really asking "would interrupting cost someone their words
  // right now?" — and after the ceiling has stopped the microphone, it would
  // not. Answering yes there is how a capped recording froze self-update for
  // good: `release()` runs only on stop or cancel, and an abandoned recording
  // gets neither.
  return recorder?.state === "recording";
}

/** Kept audio nobody has collected, waiting to be handed over. */
export function holding(): boolean {
  return recorder !== undefined && recorder.state !== "recording";
}
