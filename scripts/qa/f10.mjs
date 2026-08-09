// F10 and the four it governs — one shell, so both bars answer the same way.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const SR = `document.getElementById('logue-host').shadowRoot`;

async function until(api, expr, label, ms = 25000) {
  const start = Date.now();
  for (;;) {
    const v = await api.eval(expr);
    if (v) return v;
    if (Date.now() - start > ms) throw new Error(`${label} — never happened`);
    await api.sleep(500);
  }
}

const handleOf = (bar) => `(() => {
  const bars = [...${SR}.querySelectorAll('[role="group"]')];
  const bar = bars.find(b => (b.getAttribute('aria-label') || '') === ${JSON.stringify(bar)});
  if (!bar) return null;
  const grip = [...bar.querySelectorAll('button')].find(b => /^Move/.test(b.getAttribute('aria-label') || ''));
  if (!grip) return JSON.stringify({ present: false });
  const style = getComputedStyle(grip);
  return JSON.stringify({ present: true, transparent: style.color === 'rgba(0, 0, 0, 0)', label: grip.getAttribute('aria-label') });
})()`;

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — one shell', content: '<p>A paragraph long enough to select and to type after.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);

  // ── the caret bar ───────────────────────────────────────────────────────
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  })()`);
  await until(api, `Boolean(${SR}.querySelector('[aria-label="Logue voice"]'))`, "the caret bar");
  const caretGrip = JSON.parse(await api.eval(handleOf("Logue voice")));
  check("the caret bar has a handle, visible without hovering", caretGrip.present && !caretGrip.transparent, JSON.stringify(caretGrip));

  // ── the selection bar: the one that had none ────────────────────────────
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    const target = [...editor.querySelectorAll('p')].find(p => p.textContent.trim().length > 20) ?? editor;
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  })()`);
  await until(api, `Boolean(${SR}.querySelector('[aria-label="Selection actions"]'))`, "the selection bar");
  const selGrip = JSON.parse(await api.eval(handleOf("Selection actions")));
  check("the selection bar has one too — it had none at all", selGrip.present && !selGrip.transparent, JSON.stringify(selGrip));
  check("…and both call it the same thing", caretGrip.label === selGrip.label, `${caretGrip.label} / ${selGrip.label}`);

  // F9: hold the bar itself, away from any button, and it moves.
  // Press, let React render, then move: the window listeners that carry a
  // drag are attached in an effect, so a pointerdown and a pointermove in one
  // synchronous script are a press nobody was listening for yet.
  const dragged = await api.eval(`(() => {
    const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Selection actions');
    const before = bar.getBoundingClientRect();
    window.__from = { x: before.right - 3, y: before.top + 3, left: Math.round(before.left) };
    bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: window.__from.x, clientY: window.__from.y, button: 0, pointerId: 7 }));
    return JSON.stringify({ before: window.__from.left });
  })()`);
  await api.sleep(400);
  await api.eval(`(() => {
    const opts = (x, y) => ({ bubbles: true, composed: true, clientX: x, clientY: y, button: 0, pointerId: 7 });
    window.dispatchEvent(new PointerEvent('pointermove', opts(window.__from.x + 120, window.__from.y + 90)));
    window.dispatchEvent(new PointerEvent('pointerup', opts(window.__from.x + 120, window.__from.y + 90)));
  })()`);
  await api.sleep(500);
  const movedTo = await api.eval(`(() => {
    const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Selection actions');
    return bar ? Math.round(bar.getBoundingClientRect().left) : null;
  })()`);
  check("holding the bar itself moves it", movedTo !== null && movedTo !== JSON.parse(dragged).before, `${JSON.parse(dragged).before} → ${movedTo}`);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
