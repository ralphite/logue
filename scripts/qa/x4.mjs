/**
 * X4 — a popup stays on the screen, in the narrow place it opens in.
 *
 * His report: *"bug: dropdown/popup position. should fix base component to
 * handle all cases"*, with the panel's "Into · …" list running off the edge.
 * The two components that float over a trigger each placed themselves with
 * `absolute` and one rule — flip up if there is no room below — which misses
 * both of the things that actually happen: an ancestor with `overflow` clips
 * it, and a list wider than its trigger runs off the side.
 *
 * This measures the real thing in the real panel, at a side panel's width.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/x4.mjs
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Open a named control and measure where its popup landed. */
const OPEN = (label) => `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const trigger = [...document.querySelectorAll('button')].find(
    (b) => ((b.getAttribute('aria-label') || b.textContent || '').trim()) === ${JSON.stringify(label)}
  );
  if (!trigger) return JSON.stringify({ found: false });
  trigger.click();
  await wait(400);
  const popup = document.querySelector('[role="listbox"], [role="menu"]');
  if (!popup) return JSON.stringify({ found: true, open: false });
  const box = popup.getBoundingClientRect();
  const style = getComputedStyle(popup);
  return JSON.stringify({
    found: true,
    open: true,
    position: style.position,
    left: Math.round(box.left),
    right: Math.round(box.right),
    top: Math.round(box.top),
    bottom: Math.round(box.bottom),
    width: Math.round(box.width),
    window: { w: window.innerWidth, h: window.innerHeight },
    // What a person can actually press: a popup clipped by an ancestor is not
    // merely cut off, its hidden half stops taking clicks.
    hit: (() => {
      const at = document.elementFromPoint(box.left + box.width / 2, box.bottom - 6);
      return Boolean(at && popup.contains(at));
    })(),
  });
})()`;

export async function run(a) {
  const id = await extensionId(PORT);
  if (!id) throw new Error("no extension id");
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(500);
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);

  // A side panel's width, which is where he saw it.
  await a.send("Emulation.setDeviceMetricsOverride", {
    width: 400,
    height: 700,
    deviceScaleFactor: 0,
    mobile: false,
  });
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(2500);

  for (const label of ["Where the words are added", "Project scope", "More"]) {
    const seen = JSON.parse(await a.eval(OPEN(label)));
    if (!seen.found) {
      console.log(`SKIP  ${label} — not on this panel`);
      continue;
    }
    check(`X4 — ${label}: the popup opens`, seen.open, JSON.stringify(seen));
    if (!seen.open) continue;
    check(`X4 — ${label}: it stays on the screen`, seen.left >= 0 && seen.right <= seen.window.w,
      `${seen.left}…${seen.right} of ${seen.window.w}`);
    check(`X4 — ${label}: and inside the window vertically`, seen.top >= 0 && seen.bottom <= seen.window.h,
      `${seen.top}…${seen.bottom} of ${seen.window.h}`);
    check(`X4 — ${label}: nothing clips it, so all of it can be pressed`, seen.hit, seen.position);
    // Close it again before the next one.
    await a.eval(`(() => { document.body.click(); return 'ok'; })()`);
    await a.sleep(300);
  }

  await a.screenshot(new URL("./x4-popup.png", import.meta.url).pathname);
}
