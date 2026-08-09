// X29 — the tick takes the microphone's slot, and a dragged bar still belongs
// to a caret. Both measured by geometry, not by looking.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const SR = `document.getElementById('logue-host').shadowRoot`;

async function until(api, expr, label, timeout = 30000) {
  const start = Date.now();
  for (;;) {
    const v = await api.eval(expr);
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error(`${label} — never happened`);
    await api.sleep(500);
  }
}

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.documents[0]?.id)`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  })()`);
  await until(api, `Boolean(${SR}.querySelector('[aria-label="Logue voice"]'))`, "the bar");

  // The grip is visible before anything is hovered.
  const grip = await api.eval(`(() => {
    const g = [...${SR}.querySelectorAll('button')].find(b => /Move|drag/i.test(b.getAttribute('aria-label') || ''));
    if (!g) return null;
    const style = getComputedStyle(g);
    return JSON.stringify({ color: style.color, transparent: style.color === 'rgba(0, 0, 0, 0)' });
  })()`);
  check("the drag handle is visible without hovering", grip && !JSON.parse(grip).transparent, String(grip));

  // Where the microphone is, before recording.
  const micAt = JSON.parse(await api.eval(`(() => {
    const mic = [...${SR}.querySelectorAll('button')].find(b => /^Voice ·/.test(b.getAttribute('aria-label') || ''));
    const r = mic.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
  })()`));

  await api.eval(`[...${SR}.querySelectorAll('button')].find(b => /^Voice ·/.test(b.getAttribute('aria-label') || '')).click()`);
  await until(api, `Boolean([...${SR}.querySelectorAll('button')].find(b => /Transcribe and insert/.test(b.getAttribute('aria-label') || '')))`, "the tick");

  const row = JSON.parse(await api.eval(`(() => {
    const sr = ${SR};
    const at = (re) => { const b = [...sr.querySelectorAll('button, [role="timer"]')].find(el => re.test(el.getAttribute('aria-label') || el.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
    return JSON.stringify({ tick: at(/Transcribe and insert/), cross: at(/Cancel/), timer: at(/Recording, \\d+ seconds/) });
  })()`));
  check("the tick lands where the microphone was", row.tick && Math.abs(row.tick.x - micAt.x) <= 2 && Math.abs(row.tick.y - micAt.y) <= 2, `mic ${JSON.stringify(micAt)} vs tick ${JSON.stringify(row.tick)}`);
  check("the cross is to its right", row.cross && row.cross.x > row.tick.x, JSON.stringify(row.cross));
  check("the timer is last", row.timer && row.timer.x > row.cross.x, JSON.stringify(row.timer));

  await api.eval(`[...${SR}.querySelectorAll('button')].find(b => /Cancel/.test(b.getAttribute('aria-label') || '')).click()`);
  await api.sleep(800);

  // Drag the bar, then take the caret away: it must go with it.
  await api.eval(`(() => {
    const host = document.getElementById('logue-host');
    const sr = host.shadowRoot;
    const grip = [...sr.querySelectorAll('button')].find(b => /Move|drag/i.test(b.getAttribute('aria-label') || ''));
    const r = grip.getBoundingClientRect();
    const opts = (x, y) => ({ bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1 });
    grip.dispatchEvent(new PointerEvent('pointerdown', opts(r.left + 5, r.top + 5)));
    window.dispatchEvent(new PointerEvent('pointermove', opts(r.left + 220, r.top + 160)));
    window.dispatchEvent(new PointerEvent('pointerup', opts(r.left + 220, r.top + 160)));
  })()`);
  await api.sleep(700);
  check("the bar is still there after a drag", (await api.eval(`Boolean(${SR}.querySelector('[aria-label="Logue voice"]'))`)) === true);

  await api.eval(`(() => { getSelection().removeAllRanges(); document.querySelector('main [contenteditable="true"]').blur(); document.body.focus(); })()`);
  await api.sleep(2500);
  const stillThere = await api.eval(`Boolean(${SR}.querySelector('[aria-label="Logue voice"]'))`);
  check("and it leaves when nothing is focused, dragged or not", stillThere === false, `bar present: ${stillThere}`);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
