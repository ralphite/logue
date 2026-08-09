// One recording, no navigation, ninety seconds of patience. Does the
// transcription come back at all?
const SR = `document.getElementById('logue-host').shadowRoot`;
export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — settle', content: '<p>Settle probe.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const r = document.createRange(); r.selectNodeContents(editor); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  })()`);
  await api.sleep(1500);
  await api.eval(`[...${SR}.querySelectorAll('button')].find(b => /^Voice ·/.test(b.getAttribute('aria-label')||'')).click()`);
  await api.sleep(4000);
  await api.eval(`[...${SR}.querySelectorAll('button')].find(b => /Transcribe and insert/.test(b.getAttribute('aria-label')||'')).click()`);
  const started = Date.now();
  for (let i = 0; i < 60; i++) {
    await api.sleep(1500);
    const now = await api.eval(`(() => {
      const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
      const editor = document.querySelector('main [contenteditable="true"]');
      return JSON.stringify({
        buttons: bar ? [...bar.querySelectorAll('button')].map(b => b.getAttribute('aria-label')) : null,
        bar: bar ? bar.textContent.replace(/\s+/g,' ').trim().slice(0, 50) : null,
        landed: /spoken aloud|something real/.test(editor?.textContent ?? ''),
      });
    })()`);
    const state = JSON.parse(now);
    if (state.landed || (state.buttons ?? []).some(b => /Undo/.test(b || ""))) {
      console.log(`landed after ${((Date.now()-started)/1000).toFixed(1)}s:`, now);
      return;
    }
    if (i % 6 === 0) console.log(`${((Date.now()-started)/1000).toFixed(0)}s:`, now);
  }
  console.log("never landed in 90s");
}
