// X27 — an open tab notices it has been replaced. It goes on its own when
// nothing is in the air, and waits to be told when something is.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

/** Make the next status answers claim a build this page did not load with. */
const PRETEND = `(() => {
  const real = window.fetch;
  window.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '');
    if (!url.includes('/v1/status')) return real(input, init);
    return real(input, init).then(async (r) => {
      const body = await r.json();
      body.build = 'PRETEND.' + body.build;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  };
  window.__alive = 'yes';   // gone after a real reload
  return 'patched';
})()`;

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2500);
  const build = await api.eval(`fetch('/v1/status', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.build)`);
  check("the Host says which build it serves", Boolean(build), String(build));

  // ── nothing unsaved: it takes itself out of the way ─────────────────────
  await api.eval(PRETEND);
  for (let i = 0; i < 30; i++) {
    await api.sleep(1500);
    if ((await api.eval(`typeof window.__alive`)) === "undefined") break;
  }
  const reloaded = await api.eval(`typeof window.__alive`);
  check("with nothing unsaved, the page replaces itself", reloaded === "undefined", `__alive: ${reloaded}`);

  // ── something unsaved: it waits, and says why ───────────────────────────
  // A document of our own: typing into one of the owner's to test a reload
  // would be testing with their words.
  const docId = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — freshness', content: '<p>Typed into by the freshness check.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);
  // Hold the save open. Autosave lands in about a second, so waiting twenty
  // for the status check proves nothing about the window that matters: the
  // one where the Host is slow, or off, and the only copy is in this tab.
  await api.eval(`(() => {
    const real = window.fetch;
    window.fetch = (input, init) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? '');
      const method = String(init?.method ?? 'GET').toUpperCase();
      if (url.includes('/v1/documents/') && method !== 'GET') return new Promise(() => {});
      return real(input, init);
    };
    return 'held';
  })()`);
  await api.eval(PRETEND);
  // Really change the content: an input event over unchanged text is not a
  // change, and the editor is right to ignore it. The first version of this
  // check dispatched the event alone and proved nothing.
  const typed = await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    if (!editor) return 'no editor';
    editor.focus();
    const p = document.createElement('p');
    p.textContent = 'An unsaved sentence, mid-typing.';
    editor.append(p);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '.' }));
    return 'typed';
  })()`);
  check("a document is open and has been typed into", typed === "typed", typed);

  let bar = null;
  for (let i = 0; i < 30; i++) {
    await api.sleep(1500);
    bar = await api.eval(`(() => { const b = [...document.querySelectorAll('[role="status"]')].find(x => /newer Logue/.test(x.textContent)); return b ? b.textContent.replace(/\\s+/g,' ').trim().slice(0,90) : null; })()`);
    if (bar) break;
  }
  const survived = await api.eval(`typeof window.__alive`);
  check("with words unsaved, it does NOT reload underneath you", survived === "string", `__alive: ${survived}`);
  check("…it says so instead", Boolean(bar), String(bar));
  const buttons = JSON.parse(await api.eval(`JSON.stringify([...document.querySelectorAll('[role="status"] button')].map(b => b.textContent.trim()))`));
  check("…offering Reload and Not yet", buttons.includes("Reload") && buttons.includes("Not yet"), JSON.stringify(buttons));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
