/**
 * The one place the microphone is asked for.
 *
 * The recorder lives in the offscreen document, which has no window — so Chrome
 * has nowhere to draw its permission prompt and rejects outright with
 * NotAllowedError. That is not a person denying anything: on a fresh profile the
 * permission reads `prompt`, meaning nobody was ever asked. Two releases went
 * out where the microphone could not be granted through any of the product's own
 * surfaces, and the message said "allow it in Chrome settings" without naming a
 * page that exists.
 *
 * The Side Panel is a real window at the same extension origin, and a grant made
 * there covers the offscreen document. So the asking happens here.
 */

/** The offscreen document's answer when Chrome refused without asking anyone. */
export const MICROPHONE_BLOCKED = "microphone-blocked";

export type MicrophoneOutcome =
  /** Held now — the recorder can have it. */
  | "granted"
  /** Asked and refused, or dismissed. Only Chrome's settings can undo this. */
  | "denied"
  /** This context has no window to be asked in; someone else has to ask. */
  | "unavailable";

/**
 * Whether Chrome would draw a prompt here.
 *
 * Extension pages only. A content script runs at the page's origin, so a grant
 * won there belongs to the page and does nothing for the recorder — and the
 * offscreen document is the case this whole module exists for.
 */
export function canAsk(): boolean {
  return typeof window !== "undefined" && globalThis.location?.protocol === "chrome-extension:";
}

/** What Chrome currently holds, or `unknown` where it will not say. */
export async function reading(): Promise<PermissionState | "unknown"> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" });
    return status.state;
  } catch {
    return "unknown";
  }
}

/**
 * Ask, if asking is possible and something is still missing.
 *
 * Nothing is recorded here — the prompt is the entire point, and the device is
 * released immediately so the recorder can open it a moment later.
 */
export async function ask(): Promise<MicrophoneOutcome> {
  if (!canAsk()) return "unavailable";
  if ((await reading()) === "granted") return "granted";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch {
    return "denied";
  }
}

/**
 * The page in Chrome that grants this by hand.
 *
 * The microphone list under Site settings never lists an extension, and there is
 * no entry point to this page from anywhere a person would look — which is why
 * the product has to open it rather than describe it.
 */
export function settingsUrl(): string {
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(`chrome-extension://${chrome.runtime.id}`)}`;
}

/**
 * What to say once Chrome is holding the microphone back.
 *
 * Two sentences, because the two places are two different next steps: a panel
 * can send someone to the setting, a web page cannot even ask.
 */
export function blockedMessage(): string {
  return canAsk()
    ? "Chrome is not letting Logue use the microphone. Allow it for Logue, then try again."
    : "Logue needs the microphone once. Open Logue with ⌘⇧L, start a recording there, and allow it.";
}
