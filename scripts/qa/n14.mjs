/**
 * N14 — the panel, measured against the design it was reviewed for.
 *
 * The three reviews of 2026-08-14 found twelve deviations between the panel
 * that shipped and the mock he confirmed. This is the half of them that can be
 * measured rather than looked at: what the answer does when the panel is
 * closed (the worst one — it disappeared), where the dividers fall, whether a
 * long entry can be got past, whether the things you press have edges, and
 * whether "Logue is not running" says so.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   LOGUE_QA_PORT=9899 node scripts/qa/cdp.mjs 9899 ./scripts/qa/n14.mjs
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const ARTICLE = process.env.LOGUE_TEST_PAGE ?? "https://en.wikipedia.org/wiki/Speech_recognition";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const READ = `(() => {
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
  return JSON.stringify({
    buttons: [...document.querySelectorAll('button')].map(label).filter(Boolean),
    entries: document.querySelectorAll('article').length,
    text: document.body.innerText,
  });
})()`;

async function until(a, test, label, timeout = 120000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${state.text.slice(0, 300)}`);
    await a.sleep(700);
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

/** Everything the layout findings were about, measured in one pass. */
const SHAPE = `(() => {
  const first = document.querySelector('article');
  const panel = document.documentElement.clientHeight;
  const ask = [...document.querySelectorAll('button')].find(
    (b) => (b.textContent || '').trim() === 'Ask'
  );
  const edge = (label) => {
    const one = [...document.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === label
    );
    if (!one) return null;
    const style = getComputedStyle(one);
    return {
      border: Math.round(parseFloat(style.borderTopWidth) * 100) / 100,
      background: style.backgroundColor,
      title: one.getAttribute('title'),
    };
  };
  return JSON.stringify({
    panel,
    tallest: Math.max(0, ...[...document.querySelectorAll('article')].map((a) => Math.round(a.getBoundingClientRect().height))),
    // The Ask button belongs to the entry it is about — not to a strip of its
    // own below it, which drew a second divider through every row.
    askInsideEntry: Boolean(ask && first && ask.closest('article')),
    // A bordered block between two entries is the strip that cut the line.
    strips: [...document.querySelectorAll('div')].filter((d) => {
      const style = getComputedStyle(d);
      return parseFloat(style.borderBottomWidth) > 0 && !d.closest('article') && d.closest('.logue-scroll');
    }).length,
    bookmark: edge('Save this page'),
    mic: edge('Talk'),
    citations: document.querySelectorAll('[aria-label^="Source "]').length,
  });
})()`;

export async function run(a) {
  const id = await extensionId(PORT);
  if (!id) throw new Error("no extension id");
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(500);
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);
  await a.eval(
    `chrome.tabs.create({ url: ${JSON.stringify(ARTICLE)}, active: false }).then((t) => String(t.id))`,
  );
  await a.sleep(6000);
  // A side panel's width, which is the width every one of these was found at.
  await a.send("Emulation.setDeviceMetricsOverride", { width: 400, height: 700, deviceScaleFactor: 0, mobile: false });
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(2500);

  const start = await until(a, (s) => s.buttons.includes("Send"), "the panel never rendered");
  const rows = start.entries;
  const before = (await (await fetch(`${HOST}/v1/materials?kind=page`)).json()).materials.length;

  // -- an entry, and what it looks like ------------------------------------
  await a.eval(press("Save this page"));
  await until(a, (s) => s.entries > rows, "keeping the page produced no entry");
  let page = [];
  for (let tries = 0; tries < 40; tries += 1) {
    page = (await (await fetch(`${HOST}/v1/materials?kind=page`)).json()).materials;
    if (page.length > before) break;
    await a.sleep(500);
  }
  const mine = page[0];
  check("N14a — the page was kept", page.length === before + 1, `${before} → ${page.length}`);
  await a.sleep(1500);

  const shape = JSON.parse(await a.eval(SHAPE));
  check("N14b — Ask is on the entry, not on a strip below it", shape.askInsideEntry, JSON.stringify(shape.strips));
  check("N14c — nothing draws a second divider between entries", shape.strips === 0, `${shape.strips} strips`);
  check(
    "N14d — a whole Wikipedia article folds instead of filling the panel",
    shape.tallest > 0 && shape.tallest < shape.panel * 0.75,
    `${shape.tallest}px of ${shape.panel}px`,
  );
  check(
    "N14e — the bookmark has an edge",
    shape.bookmark && shape.bookmark.border >= 1 && shape.bookmark.background !== "rgba(0, 0, 0, 0)",
    JSON.stringify(shape.bookmark),
  );
  check(
    "N14f — so does the microphone",
    shape.mic && shape.mic.border >= 1 && shape.mic.background !== "rgba(0, 0, 0, 0)",
    JSON.stringify(shape.mic),
  );
  check(
    "N14g — and neither of them says its word twice",
    shape.bookmark?.title === null && shape.mic?.title === null,
    `${shape.bookmark?.title} / ${shape.mic?.title}`,
  );

  // -- the one that mattered: an answer that survives the panel closing ----
  await a.eval(press("Ask"));
  const answered = await until(a, (s) => /Answered/.test(s.text), "the ask never came back", 180000);
  check("N14h — the answer hangs under the entry", /Answered/.test(answered.text));

  const derived = (await (await fetch(`${HOST}/v1/materials?kind=derived`)).json()).materials.filter((one) =>
    (one.parent_ids ?? []).includes(mine?.id),
  );
  check("N14i — and the Host holds it, hanging off what was asked about", derived.length === 1, `${derived.length}`);

  // Closing and re-opening the side panel is the ordinary way a side panel
  // ends. Until this passed, that threw every answer away.
  await a.goto("about:blank");
  await a.sleep(500);
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(3000);
  const again = await until(a, (s) => s.entries > 0, "the panel never came back");
  check("N14j — and it is still there after the panel is re-opened", /Answered/.test(again.text), again.text.slice(0, 160));

  const cites = JSON.parse(await a.eval(SHAPE)).citations;
  const written = derived[0]?.content ?? "";
  if (/\[Source \d/.test(written)) {
    check("N14k — its citations are chips, not printed text", cites > 0, `${cites} chips`);
  } else {
    console.log("SKIP  N14k — this answer cited nothing");
  }

  await a.screenshot(new URL("./n14-panel.png", import.meta.url).pathname);

  // -- Logue not running ---------------------------------------------------
  await a.eval(`chrome.storage.local.set({ "logue:server": "http://127.0.0.1:8" }).then(() => "ok")`);
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(3500);
  const off = JSON.parse(await a.eval(READ));
  check(
    "N14l — with Logue off, the panel says so and says the recordings are safe",
    /Logue is not running\. Recordings are kept here\./.test(off.text),
    off.text.slice(0, 160).replace(/\n/g, " | "),
  );
  check("N14m — and does not open the server form unasked", !off.text.includes("Logue server"), off.text.slice(0, 120));
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);

  // What this check made, it takes away again.
  for (const one of [...derived, mine].filter(Boolean)) {
    await fetch(`${HOST}/v1/materials/${one.id}`, { method: "DELETE", headers: { "X-Logue-Client": "web" } });
  }
}
