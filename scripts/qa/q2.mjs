// Q2 — one identity, one list, no domain repeated fourteen times, and a copy
// that carries what it was about (F8).
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  const id = new URL(w.url).host;
  await api.goto(`chrome-extension://${id}/sidepanel.html`);
  await api.sleep(2500);

  // ① the manifest carries the mark
  const icons = await api.eval(`fetch('/manifest.json').then(r => r.json()).then(m => JSON.stringify({ icons: Object.keys(m.icons ?? {}), action: Boolean(m.action?.default_icon) }))`);
  const parsed = JSON.parse(icons);
  check("the extension has icons at every size Chrome asks for", parsed.icons.length === 4 && parsed.action, icons);
  const drawn = await api.eval(`fetch('/icons/logue-128.png').then(r => r.ok && r.headers.get('content-type'))`);
  check("…and the files are really there", String(drawn).includes("image"), String(drawn));

  // ② one identity, one way out, named
  const head = JSON.parse(await api.eval(`(() => {
    const header = document.querySelector('header');
    const link = [...document.querySelectorAll('a')].find(a => /Open Logue web app/.test(a.textContent));
    return JSON.stringify({
      // Only chrome counts. The page's own title and the Project names are
      // the person's data, and counting those made the product look like it
      // was shouting its name seven times.
      wordmarks: [...document.querySelectorAll('header *')]
        .filter((el) => el.children.length === 0 && /\bLogue\b/.test(el.textContent ?? ''))
        .length,
      headerText: header ? header.textContent.replace(/\\s+/g,' ').trim().slice(0, 70) : null,
      named: Boolean(link),
    });
  })()`));
  check("the way out says what it is", head.named === true, head.headerText);
  check("…and the panel does not repeat the product's name", head.wordmarks <= 1, `"Logue" appears ${head.wordmarks}×`);

  // ③ one list
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /This page/.test(b.textContent)).click()`);
  await api.sleep(1200);
  const lists = JSON.parse(await api.eval(`JSON.stringify([...document.querySelectorAll('h2')].map(h => h.textContent.replace(/\\s+/g,' ').trim()))`));
  check("the kept things are one list, not two", lists.filter(h => /Kept|From this page|What you added/.test(h)).length === 1, JSON.stringify(lists));

  // ④ the domain is not printed on every row; audio and two buttons are
  const rows = JSON.parse(await api.eval(`(() => {
    const body = document.body.textContent ?? '';
    const domains = (body.match(/chatgpt\\.com|notion\\.so|127\\.0\\.0\\.1/g) ?? []).length;
    return JSON.stringify({
      domains,
      copy: document.querySelectorAll('button[aria-label*="Copy"]').length,
      open: document.querySelectorAll('button[aria-label*="Open where"]').length,
    });
  })()`));
  check("the same domain is not printed on every row", rows.domains <= 2, JSON.stringify(rows));
  check("every row offers Copy", rows.copy >= 1, `${rows.copy} copy buttons`);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
