// X26 + F7 — real paths in the address bar, and a section opens on a draft.
// Runs against the deployed Host (8787) — the same app the owner uses.
const APP = "http://127.0.0.1:8787";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

export async function run(api) {
  // -- F7: the app lands on a real path, no hash --------------------------
  await api.goto(APP);
  await api.sleep(2200);
  const landed = await api.eval(`location.pathname + location.hash`);
  check("the root lands on /stream with no hash", landed === "/stream", landed);

  // A real document to deep-link at (kept in Logue QA style, never deleted).
  const doc = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — real paths', content: '<p>A paragraph that proves the deep link opened the right document.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);

  // -- F7: a legacy #/ bookmark still resolves, and the address is rewritten
  await api.goto(`${APP}/#/documents/${doc}`);
  await api.sleep(2200);
  const legacy = await api.eval(`location.pathname + location.hash`);
  const legacyBody = await api.eval(`document.querySelector('main [contenteditable="true"]')?.textContent ?? ''`);
  check("a legacy #/ bookmark resolves and loses its hash", legacy === `/documents/${doc}`, legacy);
  check("…and the right document is open", /proves the deep link/.test(legacyBody));

  // -- F7: a real path survives a cold load (the Host's SPA fallback) -----
  await api.goto(`${APP}/documents/${doc}`);
  await api.sleep(2200);
  const cold = await api.eval(`location.pathname`);
  const coldBody = await api.eval(`document.querySelector('main [contenteditable="true"]')?.textContent ?? ''`);
  check("a real path survives a cold load", cold === `/documents/${doc}` && /proves the deep link/.test(coldBody), cold);

  // -- X26: a section with nothing chosen opens on a draft, address says so
  const skillsBefore = await api.eval(`fetch('/v1/skills', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.skills.length)`);
  await api.goto(APP);
  await api.sleep(2000);
  await api.eval(`[...document.querySelectorAll('nav a, nav button, header a, header button')].find(b => b.textContent.trim() === 'Skills').click()`);
  await api.sleep(900);
  const skillsPath = await api.eval(`location.pathname`);
  const skillsEditor = await api.eval(`(() => {
    const main = document.querySelector('main');
    if (/Pick a Skill from the list/.test(main.textContent)) return 'pick-page';
    const naming = main.querySelector('input, textarea, [contenteditable="true"]');
    return naming ? 'editor' : 'neither: ' + main.textContent.slice(0, 60);
  })()`);
  check("Skills opens on /skills/new", skillsPath === "/skills/new", skillsPath);
  check("…and it is a real editor, not a pick-from-the-list page", skillsEditor === "editor", skillsEditor);

  // -- X26/X7: the untouched draft never reaches the Host -----------------
  const skillsAfter = await api.eval(`fetch('/v1/skills', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.skills.length)`);
  check("an untouched draft writes nothing", skillsBefore === skillsAfter, `${skillsBefore} → ${skillsAfter}`);

  // -- X26: Documents opens on a draft too, and it is the document editor -
  await api.eval(`[...document.querySelectorAll('nav a, nav button, header a, header button')].find(b => b.textContent.trim() === 'Documents').click()`);
  await api.sleep(900);
  const docsPath = await api.eval(`location.pathname`);
  const docsEditor = await api.eval(`Boolean(document.querySelector('main [contenteditable="true"]'))`);
  check("Documents opens on /documents/new with the editor", docsPath === "/documents/new" && docsEditor, docsPath);

  // -- a rail row opens the real thing at its real address ----------------
  const opened = await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...document.querySelectorAll('button')].find(b => !main.contains(b) && /real paths/.test(b.textContent));
    if (!row) return 'no row';
    row.click();
    return 'clicked';
  })()`);
  await api.sleep(900);
  const rowPath = await api.eval(`location.pathname`);
  check("a rail row opens at its real address", opened === "clicked" && rowPath === `/documents/${doc}`, `${opened} ${rowPath}`);

  // -- Back walks to what was just read, and the app follows --------------
  await api.eval(`history.back()`);
  await api.sleep(900);
  const back1 = await api.eval(`location.pathname`);
  const back1Body = await api.eval(`document.querySelector('main [contenteditable="true"]') ? 'editor' : document.querySelector('main').textContent.slice(0, 40)`);
  check("Back returns to the draft just left, app in step", back1 === "/documents/new" && back1Body === "editor", `${back1} ${back1Body}`);

  await api.eval(`history.back()`);
  await api.sleep(900);
  const back2 = await api.eval(`location.pathname`);
  check("Back again reaches the Skills draft", back2 === "/skills/new", back2);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
