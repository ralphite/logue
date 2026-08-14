/**
 * CUJ 7 — the Side Panel: keep this page, scope it to a Project, ask about it.
 *
 * Rewritten for the panel N13 left behind: one list and one composer, no
 * Record / Keep / Ask, no tabs. The journey is the same one a person makes —
 * the controls it goes through are not.
 *
 *   ./scripts/qa/browser.sh 9666 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9666 ./scripts/qa/cuj-panel.mjs
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9666";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const ARTICLE = process.env.LOGUE_TEST_PAGE ?? "https://en.wikipedia.org/wiki/Speech_recognition";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const READ = `(() => {
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
  const alert = document.querySelector('[role="alert"]');
  return JSON.stringify({
    error: alert ? alert.textContent : null,
    buttons: [...document.querySelectorAll('button')].map(label).filter(Boolean),
    entries: document.querySelectorAll('article').length,
    text: document.body.innerText,
  });
})()`;

async function until(a, test, label, timeout = 90000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${state.text.slice(0, 300)}`);
    await a.sleep(600);
  }
}

const press = (label) => `(() => {
  const hit = [...document.querySelectorAll('button')].find(
    (b) => ((b.getAttribute('aria-label') || b.textContent || '').trim()) === ${JSON.stringify(label)}
  );
  if (!hit) return 'no button ' + ${JSON.stringify(label)};
  hit.click();
  return 'ok';
})()`;

export async function run(a) {
  const id = await extensionId(PORT);
  if (!id) throw new Error("no extension id");
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(500);
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);
  // A real page for the panel to be about. Opened from the panel itself, in
  // the background: the panel is never the page it is about, so an article in
  // another tab is what "this page" means here — and without one, keeping the
  // page has nothing to keep.
  await a.eval(
    `chrome.tabs.create({ url: ${JSON.stringify(ARTICLE)}, active: false }).then((t) => String(t.id))`,
  );
  await a.sleep(6000);
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(2500);

  const first = await until(a, (s) => s.buttons.includes("Send"), "the panel never rendered");
  check(
    "CUJ 7a — one composer, and the three verbs are gone",
    ["Talk", "Send", "Save this page"].every((one) => first.buttons.includes(one)) &&
      // Record and Keep are gone from the top of the panel. Ask is not: it is
      // a Skill now, on the entry it is about, which is his ruling A.
      !first.buttons.some((b) => /^(Record|Keep)$/.test(b)),
    first.buttons.join(" · "),
  );
  check("CUJ 7b — the scope is on the composer's own row", first.buttons.includes("Project"));
  if (first.error) console.log("panel error:", first.error);

  // -- keeping this page ---------------------------------------------------
  // Counted, not merely non-zero: this page may already have been kept, and a
  // list that was not empty to begin with answered "yes, an entry" before the
  // Host had written anything.
  const before = (await (await fetch(`${HOST}/v1/materials?kind=page`)).json()).materials.length;
  const rows = first.entries;
  await a.eval(press("Save this page"));
  const kept = await until(a, (s) => s.entries > rows, "keeping the page produced no entry");
  check("CUJ 7c — keeping this page is one press, and it lands in the list", kept.entries > rows);
  check("CUJ 7d — and the entry says which act it was", /Saved a page/.test(kept.text),
    kept.text.split("\n").slice(0, 4).join(" | "));

  // The row appears the moment the press lands; the Source appears when the
  // Host answers. Waiting for the second is what this line is about.
  let after = [];
  for (let tries = 0; tries < 40; tries += 1) {
    after = (await (await fetch(`${HOST}/v1/materials?kind=page`)).json()).materials;
    if (after.length > before) break;
    await a.sleep(500);
  }
  check("CUJ 7e — the Host holds it as a Source", after.length === before + 1, `${before} → ${after.length}`);
  const mine = after[0];

  // -- asking about it -----------------------------------------------------
  check("CUJ 7f — asking is offered on the thing that was kept", kept.buttons.includes("Ask"));
  await a.eval(press("Ask"));
  const answered = await until(
    a,
    (s) => /Answered/.test(s.text) || /Could not reach Logue/.test(s.text),
    "the ask never came back",
    120000,
  );
  check("CUJ 7g — the answer hangs under the entry it was asked about", /Answered/.test(answered.text),
    answered.text.slice(0, 200));

  await a.screenshot(new URL("./cuj-panel.png", import.meta.url).pathname);

  // What this check made, it takes away again.
  if (mine?.id) {
    await fetch(`${HOST}/v1/materials/${mine.id}`, { method: "DELETE", headers: { "X-Logue-Client": "web" } });
  }
}
