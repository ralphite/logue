// F5 — words learned from decisions, suggested from writing, never from transcripts.
// Runs against the deployed Host with the owner's real workspace.
const APP = "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const get = (api, path) => api.eval(`fetch('${path}', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json())`);

export async function run(api) {
  await api.goto(`${APP}/settings`);
  await api.sleep(2500);

  // The section is on screen, and it says what it is.
  const section = await api.eval(`(() => {
    const heads = [...document.querySelectorAll('main h2')].map(h => h.textContent.trim());
    const known = heads.find(h => /Words Logue knows/.test(h));
    const body = document.querySelector('main').textContent;
    return { known: Boolean(known), saysNever: /nothing is learned from a transcript/i.test(body) };
  })()`);
  check("Settings has a section for the words Logue knows", section.known);
  check("…and says plainly that transcripts are never learned from", section.saysNever);

  // The real workspace's own writing produces suggestions, and none of them
  // are words the transcripts already say.
  const before = await get(api, "/v1/vocabulary");
  check("suggestions come from the real workspace", Array.isArray(before.candidates), `${before.candidates?.length ?? "?"} suggested, ${before.learned?.length ?? "?"} known`);

  const overlap = await api.eval(`fetch('/v1/materials', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => {
    const spoken = d.materials.filter(m => m.kind === 'voice').map(m => (m.content || '').toLowerCase()).join('\\n');
    return ${JSON.stringify((before.candidates ?? []).map(c => c.term))}.filter(t => spoken.includes(t.toLowerCase()));
  })`);
  check("no suggestion is a word the transcripts already produce", overlap.length === 0, JSON.stringify(overlap));

  // A correction is learned outright, and reaches the next recording's plan.
  const mat = await api.eval(`fetch('/v1/materials', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.materials.find(m => m.kind === 'voice' && m.capture_id)?.id)`);
  const learnedNow = await api.eval(`fetch('/v1/materials/${mat}/retranscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ correction: { spoken: 'zeffrin', preferred: 'Zephyrine' }, remember: true }) }).then(r => r.json()).then(() => fetch('/v1/vocabulary', { headers: { 'X-Logue-Client': 'web' } })).then(r => r.json())`);
  const term = (learnedNow.learned ?? []).find(t => t.term === "Zephyrine");
  check("a correction is learned outright", Boolean(term), JSON.stringify(term ?? null));
  check("…and carries the reason in words", /corrected this/i.test(term?.reason ?? ""), term?.reason ?? "");

  // It is in the plan the very next recording would use.
  //
  // Read from a fresh transcription rather than by re-running an old one:
  // a recording with nothing in it is now refused outright ("Nothing was heard
  // the second time either"), which is right, and left this check reading
  // `material` off an error. The plan is what the claim is about anyway.
  const silence = `(() => {
    const rate = 48000, samples = rate;
    const bytes = new Uint8Array(44 + samples * 2);
    const view = new DataView(bytes.buffer);
    const tag = (at, text) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    tag(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); tag(8, 'WAVEfmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    tag(36, 'data'); view.setUint32(40, samples * 2, true);
    let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  })()`;
  const plan = await api.eval(`fetch('/v1/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ audio: ${silence}, media_type: 'audio/wav', seconds: 1 }) }).then(r => r.json()).then(d => d.applied_context?.terms ?? [])`);
  check("the learned word is in the next recording's plan", plan.includes("Zephyrine"), JSON.stringify(plan.slice(0, 6)));

  // On screen, with its reason, and removable.
  await api.goto(`${APP}/settings`);
  await api.sleep(2200);
  const shown = await api.eval(`(() => {
    const rows = [...document.querySelectorAll('main div')].filter(d => /^Zephyrine/.test(d.textContent.trim()));
    const row = rows[rows.length - 1];
    if (!row) return { shown: false };
    return { shown: true, text: row.textContent.trim().slice(0, 80), forget: Boolean(row.querySelector('button[aria-label^="Forget"]')) };
  })()`);
  check("the learned word is on screen with its reason", shown.shown && /corrected this/i.test(shown.text), JSON.stringify(shown));
  check("…and can be taken back from there", shown.forget === true);

  await api.eval(`(() => { const rows = [...document.querySelectorAll('main div')].filter(d => /^Zephyrine/.test(d.textContent.trim())); rows[rows.length - 1].querySelector('button[aria-label^="Forget"]').click(); })()`);
  await api.sleep(1500);
  const after = await get(api, "/v1/vocabulary");
  check("forgetting removes it", !(after.learned ?? []).some(t => t.term === "Zephyrine"), JSON.stringify((after.learned ?? []).map(t => t.term)));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
