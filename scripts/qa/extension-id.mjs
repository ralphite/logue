/**
 * The extension we just loaded, by id.
 *
 * `load-unpacked.mjs` writes it down at install time. Everything else is
 * guesswork: Chrome runs component extensions whose targets look exactly like
 * ours, and the worker that could identify us is asleep most of the time —
 * two checks have already run against the Web Store's extension and failed on
 * a page that was never Logue's.
 */
export async function extensionId(port) {
  if (process.env.LOGUE_EXTENSION_ID) return process.env.LOGUE_EXTENSION_ID;
  const { readFileSync } = await import("node:fs");
  try {
    return readFileSync(new URL(`./.extension-${port}`, import.meta.url), "utf8").trim();
  } catch {
    // Not loaded by our own script — fall back to a target that can only be
    // ours, and say plainly when there is none.
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const mine = targets.find((t) => t.url.endsWith("/background.js") || t.url.includes("/sidepanel.html"));
    return mine?.url.split("/")[2];
  }
}
