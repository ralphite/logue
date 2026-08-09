// X28 — hovering the rail row whose record is missing a field must not take
// the page down. Run against the record that actually crashed it.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/documents");
  await api.sleep(3000);

  const broken = await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } })
    .then(r => r.json())
    .then(d => { const bad = d.documents.find(x => !Array.isArray(x.source_ids)); return bad ? JSON.stringify({ id: bad.id, title: bad.title }) : null; })`);
  check("the record that crashed it is still in the workspace", broken !== null, String(broken));
  if (!broken) return;
  const title = JSON.parse(broken).title;

  // Watch for the crash the way it showed up: the app's root goes empty.
  await api.eval(`window.__crashes = []; addEventListener('error', (e) => window.__crashes.push(String(e.message)))`);

  const hovered = await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...document.querySelectorAll('button')].find(b => !main.contains(b) && b.textContent.includes(${JSON.stringify(title)}));
    if (!row) return 'no row';
    const r = row.getBoundingClientRect();
    for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mousemove']) {
      row.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: r.left + 20, clientY: r.top + 10 }));
    }
    return 'hovered';
  })()`);
  check("the row is there and can be hovered", hovered === "hovered", String(hovered));

  await api.sleep(1500);
  const after = JSON.parse(await api.eval(`JSON.stringify({
    rootHasContent: (document.getElementById('root')?.textContent ?? '').trim().length > 50,
    crashes: window.__crashes,
    card: (() => { const c = [...document.querySelectorAll('div')].find(d => /cannot be previewed|Built on/.test(d.textContent) && d.textContent.length < 400); return c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0, 80) : null; })(),
  })`));
  check("the page is still standing", after.rootHasContent === true, JSON.stringify(after.crashes));
  check("nothing was thrown", (after.crashes ?? []).length === 0, JSON.stringify(after.crashes));
  check("and the card says something rather than nothing", Boolean(after.card), String(after.card));

  // A fresh document from the agent path carries the field now.
  const made = await api.eval(`fetch('/v1/agent/accept', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ proposal: { tool: 'draft_document', title: 'Logue QA — X28 field check', body: 'Written through documents.create.' } }) })
    .then(r => r.json()).then(d => JSON.stringify({ hasField: Array.isArray(d.document?.source_ids), title: d.document?.title }))`);
  const fresh = JSON.parse(made);
  check("a document the agent drafts now carries source_ids", fresh.hasField === true, made);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
