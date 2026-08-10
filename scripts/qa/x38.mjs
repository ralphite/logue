// X38 — one conversation per page, and the tab is called Chat.
//
// There was exactly one conversation, under a fixed key, with nothing tying it
// to where you were. A question asked about an article stayed on screen over a
// Google Doc, above an unrelated answer.
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const HOST = "http://127.0.0.1:8787";

export async function run(api) {
  await api.goto(`${HOST}/stream`);
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  if (!worker) throw new Error("the extension's worker is not running");
  const panelUrl = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;

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

  await api.goto(panelUrl);
  await api.sleep(2000);

  // Start clean, and leave the legacy global conversation behind to prove it
  // is dropped rather than shown on every page.
  await api.eval(`chrome.storage.local.set({ 'logue:thread': [{ from: 'you', text: 'ASKED SOMEWHERE, SHOWN EVERYWHERE', at: '2026-01-01T00:00:00Z' }] })
    .then(() => chrome.storage.local.remove('logue:threads'))`);

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

  // Run a Skill on each page, which is what writes a conversation.
  const runOn = async (tabId, url, label) =>
    JSON.parse(
      await api.eval(`(async () => {
      const context = await fetch('${HOST}/v1/context?project=').then(r => r.json());
      const skill = (context.skills ?? []).find(s => s.enabled && (s.contexts ?? []).includes('selection'));
      const answer = await chrome.runtime.sendMessage({
        type: 'logue:run-skill-on-selection', skillId: skill.id, skillName: ${JSON.stringify("SKILL")},
        text: ${JSON.stringify(label)}, url: ${JSON.stringify(url)}, title: ${JSON.stringify(label)},
      }).catch(e => ({ error: String(e) }));
      return JSON.stringify({ sent: Boolean(answer?.ok), skill: skill.name });
    })()`),
    );
  const first = await runOn(tabA, where.a, "A passage that belongs to the first page and nowhere else.");
  check("a Skill ran on the first page", first.sent === true, JSON.stringify(first));
  await api.sleep(12000);
  const second = await runOn(tabB, where.b, "A different passage, belonging only to the second page.");
  check("a Skill ran on the second page", second.sent === true, JSON.stringify(second));
  await api.sleep(12000);

  const stored = JSON.parse(
    await api.eval(`(async () => {
    const bag = await chrome.storage.local.get(['logue:threads', 'logue:thread']);
    const threads = bag['logue:threads'] ?? {};
    const at = (url) => { const u = new URL(url); return u.origin + u.pathname + u.search; };
    const of = (url) => (threads[at(url)]?.messages ?? []).map(m => (m.text ?? '').slice(0, 60));
    return JSON.stringify({
      pages: Object.keys(threads).length,
      a: of(${JSON.stringify(where.a)}),
      b: of(${JSON.stringify(where.b)}),
      legacyStillThere: bag['logue:thread'] !== undefined,
    });
  })()`),
  );
  check("each page has its own conversation", stored.pages >= 2, `${stored.pages} pages have one`);
  check(
    "the first page's conversation is about the first page",
    stored.a.some((t) => /first page/i.test(t)) && !stored.a.some((t) => /second page/i.test(t)),
    JSON.stringify(stored.a),
  );
  check(
    "…and the second page's is about the second",
    stored.b.some((t) => /second page/i.test(t)) && !stored.b.some((t) => /first page/i.test(t)),
    JSON.stringify(stored.b),
  );
  check("the one global conversation is gone", stored.legacyStillThere === false, String(stored.legacyStillThere));

  // What the panel shows depends on which tab is in front.
  const shownOn = async (tabId) => {
    await api.eval(`chrome.tabs.update(${tabId}, { active: true })`);
    await api.sleep(2500);
    await api.eval(`location.reload()`);
    await api.sleep(2500);
    return await api.eval(`document.body.innerText`);
  };
  const onA = await shownOn(tabA);
  check("on the first page, the panel shows the first page's words", /first page/i.test(onA) && !/second page/i.test(onA),
    `first: ${/first page/i.test(onA)}, second: ${/second page/i.test(onA)}`);
  const onB = await shownOn(tabB);
  check("on the second page, the second page's", /second page/i.test(onB) && !/first page/i.test(onB),
    `first: ${/first page/i.test(onB)}, second: ${/second page/i.test(onB)}`);
  check("nothing from the global conversation is on screen", !/ASKED SOMEWHERE/i.test(onA + onB));

  // The rename.
  const named = JSON.parse(
    await api.eval(`(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')].map(b => b.textContent.trim());
    const heading = document.querySelector('h1')?.textContent ?? '';
    return JSON.stringify({ tabs, heading, anyTalk: /talk/i.test(document.body.innerText) });
  })()`),
  );
  check("the tab is called Chat", named.tabs.includes("Chat"), JSON.stringify(named.tabs));
  check("…and the word Talk is nowhere in the panel", named.anyTalk === false, named.heading);

  await api.eval(`chrome.tabs.remove([${tabA}, ${tabB}])`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
