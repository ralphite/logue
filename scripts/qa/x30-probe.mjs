const SR = `document.getElementById('logue-host').shadowRoot`;
export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — receipt probe', content: '<p>Probe.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  })()`);
  await api.sleep(1500);
  await api.eval(`(() => {
    const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
    [...bar.querySelectorAll('button')].find(b => /^Voice ·/.test(b.getAttribute('aria-label') || '')).click();
  })()`);
  for (let i = 1; i <= 16; i++) {
    await api.sleep(1500);
    console.log(i * 1.5 + "s:", await api.eval(`(() => {
      const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
      if (!bar) return 'no bar';
      return JSON.stringify({ buttons: [...bar.querySelectorAll('button')].map(b => b.getAttribute('aria-label')), text: bar.textContent.replace(/\\s+/g,' ').trim().slice(0, 60) });
    })()`));
    if (i === 3) await api.eval(`(() => {
      const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
      const tick = [...bar.querySelectorAll('button')].find(b => /Transcribe and insert/.test(b.getAttribute('aria-label') || ''));
      if (tick) tick.click();
    })()`);
  }
}
