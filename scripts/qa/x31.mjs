// X31 — the length a recording really is, and a file you can seek in.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const SR = `document.getElementById('logue-host').shadowRoot`;

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);

  // Range, asked for the way a scrubber asks.
  const ranged = await api.eval(`fetch('/v1/captures/nope/audio').then(r => r.status)`);
  const docId = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — duration', content: '<p>Recorded into by the duration check.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);

  // Record a real four seconds and accept it.
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

  let made;
  for (let i = 0; i < 40; i++) {
    await api.sleep(1500);
    made = JSON.parse(await api.eval(`fetch('/v1/materials', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => {
      const voice = d.materials.filter(m => m.capture_id).sort((a, b) => a.created_at < b.created_at ? 1 : -1)[0];
      return JSON.stringify(voice ? { id: voice.id, capture: voice.capture_id, seconds: voice.capture_seconds, at: voice.created_at } : null);
    })`));
    if (made && Date.now() - new Date(made.at).getTime() < 120000) break;
  }
  check("a recording just made is on the Host", Boolean(made), JSON.stringify(made));
  check("…and it knows how long it was", (made?.seconds ?? 0) >= 2, `${made?.seconds}s`);

  // The Host answers a range, which is what seeking needs.
  const range = JSON.parse(await api.eval(`fetch('/v1/captures/${made.capture}/audio', { headers: { Range: 'bytes=0-99' } }).then(r => JSON.stringify({ status: r.status, range: r.headers.get('content-range'), accept: r.headers.get('accept-ranges') }))`));
  check("the Host serves a byte range", range.status === 206 && /bytes 0-99\//.test(range.range ?? ""), JSON.stringify(range));
  check("…and says it accepts them", range.accept === "bytes", JSON.stringify(range));

  // The player shows the number rather than 0:00.
  await api.goto(`http://127.0.0.1:8787/stream/${made.id}`);
  await api.sleep(3000);
  const shown = await api.eval(`(() => {
    const audio = document.querySelector('main audio');
    const label = [...document.querySelectorAll('main span')].map(s => s.textContent.trim()).find(t => /^\\d+:\\d\\d$/.test(t));
    return JSON.stringify({ player: Boolean(audio), label: label ?? null });
  })()`);
  const seen = JSON.parse(shown);
  check("the Source page shows the length beside the player", seen.player && seen.label && seen.label !== "0:00", shown);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
