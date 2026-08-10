// F11 — the unchangeable things at the top of a Source, told apart, with the
// derived transcript below them.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2000);
  const voice = await api.eval(`fetch('/v1/materials', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => (d.materials.filter(m => m.capture_id).sort((a,b) => a.created_at < b.created_at ? 1 : -1)[0] ?? {}).id)`);
  check("there is a voice Source to look at", Boolean(voice), String(voice));

  await api.goto(`http://127.0.0.1:8787/stream/${voice}`);
  await api.sleep(3000);

  const order = JSON.parse(await api.eval(`(() => {
    const main = document.querySelector('main');
    const y = (el) => el ? Math.round(el.getBoundingClientRect().top) : null;
    // The innermost one: the panel's own root <section> also contains this
    // text, and matching it made the whole page look like the block.
    const heading = [...main.querySelectorAll('h2')].find(h => /What this came from/.test(h.textContent ?? ''));
    const section = heading?.parentElement ?? null;
    const audio = main.querySelector('audio');
    const transcript = [...main.querySelectorAll('p')].find(p => (p.textContent ?? '').length > 20 && section && !section.contains(p));
    return JSON.stringify({
      section: Boolean(section),
      labels: section ? [...section.querySelectorAll('span, h2')].map(s => s.textContent.trim()).filter(t => t.length < 40) : [],
      audioTop: y(audio),
      transcriptTop: y(transcript),
      sectionTop: y(section),
    });
  })()`));
  check("the originals have a place of their own", order.section === true, JSON.stringify(order.labels));
  check("…and it sits above the transcript", order.sectionTop !== null && order.transcriptTop !== null && order.sectionTop < order.transcriptTop, `section ${order.sectionTop} vs transcript ${order.transcriptTop}`);
  check("the recording is inside it", order.audioTop !== null && order.audioTop >= order.sectionTop, `audio ${order.audioTop}`);
  check("the two kinds are named apart", order.labels.some(l => /recording/i.test(l)), JSON.stringify(order.labels));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
