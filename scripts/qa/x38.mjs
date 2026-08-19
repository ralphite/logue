/**
 * X38 — what you said on one page stays on that page.
 *
 * There was exactly one conversation, under a fixed key, with nothing tying it
 * to where you were: a question asked about an article stayed on screen over a
 * Google Doc, above an unrelated answer.
 *
 * Rewritten on 2026-08-14 for the panel N13 left behind. The old check read
 * `logue:threads` in the extension's own storage and looked for a tab called
 * Chat; there are no tabs now, and no conversation of its own — the list is
 * the page's Sources, held by the Host. The question it was asking is the one
 * that still matters, so it is asked of the thing that answers it now.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   LOGUE_QA_PORT=9899 node scripts/qa/cdp.mjs 9899 ./scripts/qa/x38.mjs
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const say = (words) => `(() => {
  const box = document.querySelector('textarea');
  if (!box) return 'no box';
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  set.call(box, ${JSON.stringify(words)});
  box.dispatchEvent(new Event('input', { bubbles: true }));
  const send = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Send');
  if (!send) return 'no send';
  send.click();
  return 'ok';
})()`;

export async function run(api) {
  const id = await extensionId(PORT);
  if (!id) throw new Error("no extension id");
  const panelUrl = `chrome-extension://${id}/sidepanel.html`;

  await api.goto(panelUrl);
  await api.sleep(1000);
  await api.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);

  // Two real pages in the owner's own app: a Source and a Project.
  const where = JSON.parse(
    await api.eval(`(async () => {
    const materials = await fetch('${HOST}/v1/materials?limit=50').then(r => r.json());
    const projects = await fetch('${HOST}/v1/projects').then(r => r.json());
    const source = (materials.materials ?? []).find(m => (m.content ?? '').length > 300);
    const project = (projects.projects ?? []).find(p => p.name === 'Logue QA') ?? (projects.projects ?? [])[0];
    return JSON.stringify({ a: '${HOST}/stream/' + source.id, b: '${HOST}/projects/' + project.id });
  })()`),
  );
  check("two real pages to talk about", Boolean(where.a && where.b), JSON.stringify(where));

  // The one conversation that used to be shown everywhere. Left in storage on
  // purpose: it must never appear again, on any page.
  await api.eval(
    `chrome.storage.local.set({ 'logue:thread': [{ from: 'you', text: 'ASKED SOMEWHERE, SHOWN EVERYWHERE', at: '2026-01-01T00:00:00Z' }] }).then(() => "ok")`,
  );

  const openPage = async (url) =>
    Number(
      await api.eval(`(async () => {
      const tab = await chrome.tabs.create({ url: ${JSON.stringify(url)}, active: true });
      await new Promise(r => setTimeout(r, 3000));
      return String(tab.id);
    })()`),
    );
  const tabA = await openPage(where.a);
  const tabB = await openPage(where.b);

  /**
   * Make the panel be about one page, and read what it shows.
   *
   * Waits for the list to arrive rather than sleeping a fixed time. The
   * entries come from the Host after the panel reloads, and a fixed 3.5s was
   * sometimes enough and sometimes not: the check disagreed with itself
   * between two runs on the same build, which is worse than a red check —
   * it makes every future red one arguable.
   */
  const on = async (tabId, expect) => {
    await api.eval(`chrome.tabs.update(${tabId}, { active: true }).then(() => "ok")`);
    await api.sleep(1200);
    await api.eval(`location.reload()`);
    // The panel has to finish deciding which page it is about before anything
    // is said into it — otherwise the words are filed against whichever page
    // it still thought it was on, which is the very thing this check is for.
    await api.sleep(3500);
    if (!expect) return await api.eval(`document.body.innerText`);
    for (let tries = 0; tries < 24; tries += 1) {
      const text = await api.eval(`document.body.innerText`);
      if (text.includes(expect)) return text;
      await api.sleep(500);
    }
    return await api.eval(`document.body.innerText`);
  };

  // -- said on the first page ----------------------------------------------
  await on(tabA);
  check("the panel is about the first page", (await api.eval(say(A_WORDS))) === "ok");
  await api.sleep(3500);

  await on(tabB);
  check("the panel is about the second page", (await api.eval(say(B_WORDS))) === "ok");
  await api.sleep(3500);

  const onA = await on(tabA, A_WORDS);
  check(
    "on the first page, the panel shows the first page's words",
    onA.includes(A_WORDS) && !onA.includes(B_WORDS),
    `first: ${onA.includes(A_WORDS)}, second: ${onA.includes(B_WORDS)}`,
  );
  const onB = await on(tabB, B_WORDS);
  check(
    "on the second page, the second page's",
    onB.includes(B_WORDS) && !onB.includes(A_WORDS),
    `first: ${onB.includes(A_WORDS)}, second: ${onB.includes(B_WORDS)}`,
  );
  check("nothing from the one global conversation is on screen", !/ASKED SOMEWHERE/i.test(onA + onB));

  // -- and the Host is where they live -------------------------------------
  const kept = await (await fetch(`${HOST}/v1/materials?q=${encodeURIComponent(MARK)}`)).json();
  check("both are Sources, each on its own page", kept.materials.length === 2, `${kept.materials.length}`);
  const pages = new Set(kept.materials.map((one) => one.source?.url));
  check("filed against the page each was said on", pages.size === 2, [...pages].join(" · "));

  // What this check made, it takes away again.
  for (const one of kept.materials) {
    await fetch(`${HOST}/v1/materials/${one.id}`, { method: "DELETE", headers: { "X-Logue-Client": "web" } });
  }
  await api.eval(`chrome.tabs.remove([${tabA}, ${tabB}]).then(() => "ok")`);
  await api.eval(`chrome.storage.local.remove('logue:thread').then(() => "ok")`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}

/** Findable afterwards, and unmistakable for anything else in the workspace. */
const MARK = "x38mark";
const A_WORDS = `A note that belongs to the first page and nowhere else ${MARK}`;
const B_WORDS = `A different note, belonging only to the second page ${MARK}`;
