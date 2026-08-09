// D1 — the panel's new shape: one identity, three tabs, a conversation whose
// composer is pinned to the bottom, and the waiting recordings in reach.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  const panel = `chrome-extension://${new URL(w.url).host}/sidepanel.html`;
  await api.goto(panel);
  await api.sleep(2500);

  const head = JSON.parse(await api.eval(`(() => {
    const open = [...document.querySelectorAll('a')].find(a => /Open app/.test(a.textContent));
    const mark = document.querySelector('header svg');
    const rows = document.querySelectorAll('header > div').length;
    return JSON.stringify({
      openHasWords: Boolean(open) && open.textContent.trim().length > 2,
      mark: Boolean(mark),
      rows,
    });
  })()`));
  check("the header carries the app's own mark", head.mark === true);
  check("…and the way in says 'Open app' in words", head.openHasWords === true);
  check("…on its own row, above the page's", head.rows === 2, `rows: ${head.rows}`);

  const tabs = JSON.parse(await api.eval(`JSON.stringify([...document.querySelectorAll('[role="tab"]')].map(b => b.textContent.trim()))`));
  check("three tabs", tabs.length === 3, JSON.stringify(tabs));

  // The composer is the last thing in the panel, and it stays there.
  const composer = JSON.parse(await api.eval(`(() => {
    const box = document.querySelector('[aria-label="What to ask"]');
    if (!box) return JSON.stringify({ box: false });
    const r = box.getBoundingClientRect();
    const thread = document.querySelector('[role="tab"][aria-selected="true"]').textContent.trim();
    return JSON.stringify({ box: true, bottom: Math.round(r.bottom), viewport: window.innerHeight, tab: thread });
  })()`));
  check("the composer sits at the bottom of Talk",
    composer.box && composer.viewport - composer.bottom < 90, JSON.stringify(composer));

  // Switching tabs actually changes what is shown.
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /This page/.test(b.textContent)).click()`);
  await api.sleep(600);
  const onPage = JSON.parse(await api.eval(`JSON.stringify({
    save: Boolean([...document.querySelectorAll('button')].find(b => /Save this page/.test(b.textContent))),
    composer: Boolean(document.querySelector('[aria-label="What to ask"]')),
    sections: [...document.querySelectorAll('h2, h3, h4')].map(h => h.textContent.trim()).slice(0, 4),
  })`));
  check("This page shows what was kept, and no composer", onPage.save === true && onPage.composer === false, JSON.stringify(onPage));

  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /Project/.test(b.textContent)).click()`);
  await api.sleep(600);
  const project = await api.eval(`Boolean([...document.querySelectorAll('select')].find(s => s.getAttribute('aria-label') === 'Project'))`);
  check("Project has the picker", project === true);

  // A waiting recording appears, is described, and can be acted on.
  await api.eval(`chrome.storage.local.set({ 'logue:pending-voice': [
    { id: 'qa1', audio: 'AAAA', mediaType: 'audio/webm', at: new Date(Date.now() - 60000).toISOString(), seconds: 22, tries: 0 },
    { id: 'qa2', audio: 'AAAA', mediaType: 'audio/webm', at: new Date().toISOString(), seconds: 64, tries: 2 },
  ] })`);
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /Talk/.test(b.textContent)).click()`);
  await api.sleep(900);
  const banner = await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => /recordings waiting/.test(x.textContent)); return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
  check("the waiting recordings announce themselves", /2 recordings waiting/.test(String(banner)), String(banner));
  check("…and say how many failed", /1 failed/.test(String(banner)), String(banner));

  await api.eval(`[...document.querySelectorAll('button')].find(x => /recordings waiting/.test(x.textContent)).click()`);
  await api.sleep(600);
  const opened = JSON.parse(await api.eval(`JSON.stringify({
    actions: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /Try now|Export audio|Delete/.test(t)),
    described: /Failed 2 times/.test(document.body.textContent) && /22s/.test(document.body.textContent),
  })`));
  check("each one offers retry, export and delete", opened.actions.length >= 6, JSON.stringify(opened.actions.slice(0, 6)));
  check("…and describes itself in words", opened.described === true);

  await api.eval(`chrome.storage.local.remove('logue:pending-voice')`);
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
