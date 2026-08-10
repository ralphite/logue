/**
 * Which Logue this browser talks to.
 *
 * "One machine, one Logue, one address" was true while the Host could only be
 * reached at 127.0.0.1. It stops being true the moment the Host is published —
 * a tunnel, a reverse proxy, another computer on the desk — and a hard-coded
 * address is not something a person can fix from inside Chrome. So the address
 * is stored once, and every call in the extension reads it.
 *
 * It lives in `chrome.storage.local`, which survives an upgrade: the installer
 * replaces the contents of a stable folder rather than the folder, precisely so
 * settings like this one are not thrown away.
 */

export const DEFAULT_SERVER = "http://127.0.0.1:8787";
const KEY = "logue:server";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** The authority a person typed, with any port removed. */
function hostOf(typed: string): string {
  return (typed.split("/")[0] ?? "").replace(/:\d+$/, "");
}

/** An address on this machine or this network, as opposed to a published name. */
function onThisNetwork(host: string): boolean {
  return LOOPBACK.has(host.toLowerCase()) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
}

/**
 * What a person typed, as an address the extension can call.
 *
 * Throws rather than guessing: an address that is silently wrong turns every
 * later call into "Logue is not running", which sends people looking at the
 * wrong thing entirely.
 */
export function readAddress(typed: string): string {
  const trimmed = typed.trim();
  if (!trimmed) throw new Error("Enter the address Logue is running at.");
  // Nobody types a scheme for a tunnel they were handed. A name without one is
  // a published address, which is https; an IP or localhost without one is a
  // machine on this network, which is not.
  const guessed = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${onThisNetwork(hostOf(trimmed)) ? "http" : "https"}://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(guessed);
  } catch {
    throw new Error(`“${trimmed}” is not an address Logue can reach.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Logue talks to http and https addresses.");
  }
  if (!parsed.hostname) throw new Error(`“${trimmed}” is not an address Logue can reach.`);
  // Only the origin is kept. Every call appends `/v1/…` to this, so a path left
  // on the end would build addresses that exist nowhere.
  return `${parsed.protocol}//${parsed.host}`;
}

/** Whether the Host at this address is the one on this computer. */
export function isLoopback(server: string): boolean {
  try {
    return LOOPBACK.has(new URL(server).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function currentServer(): Promise<string> {
  const stored = await chrome.storage.local.get(KEY);
  const value: unknown = stored[KEY];
  return typeof value === "string" && value ? value : DEFAULT_SERVER;
}

export async function rememberServer(server: string): Promise<void> {
  await chrome.storage.local.set({ [KEY]: server });
}

/** Every surface follows the address at once, without being reopened. */
export function whenServerChanges(handler: (server: string) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== "local" || !(KEY in changes)) return;
    const next: unknown = changes[KEY]?.newValue;
    handler(typeof next === "string" && next ? next : DEFAULT_SERVER);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
