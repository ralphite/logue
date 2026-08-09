// F6 — a real recording in the Logue app, and what the Host actually sent.
// The transcript itself is the stand-in's (S3 re-verifies its quality); what
// this proves is that the Transcription Skill's own words are the plan.
const APP = "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const READ = `(() => {
  const h = document.getElementById('logue-host');
  const sr = h && h.shadowRoot;
  const bar = sr && sr.querySelector('[aria-label="Logue voice"]');
  return JSON.stringify({
    bar: !!bar,
    barText: bar ? bar.textContent : null,
    labels: bar ? [...bar.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent) : null,
  });
})()`;

async function until(api, fn, label, timeout = 60000) {
  const start = Date.now();
  for (;;) {
    const s = JSON.parse(await api.eval(READ));
    if (fn(s)) return s;
    if (Date.now() - start > timeout) throw new Error(`${label} — ${JSON.stringify(s)}`);
    await api.sleep(600);
  }
}

export async function run(api) {
  // The slot names the cleanup Skill, and that is what /v1/context reports.
  const slot = await api.eval(`fetch('/v1/context', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.defaults.transcription)`);
  const named = await api.eval(`fetch('/v1/skills', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => { const s = d.skills.find(x => x.id === '${slot}'); return { name: s.name, prompt: s.instructions }; })`);
  check("the transcription slot names Transcription", named.name === "Transcription", `${slot} ${named.name}`);
  check("its prompt only removes, never adds",
    /Only remove; never add/.test(named.prompt) && /Do not swap a word for a more formal one/.test(named.prompt) &&
    /not a rewrite/i.test(named.prompt) && /filler words/i.test(named.prompt));

  // A real recording in the Logue app's own editor, on a real long document.
  const docId = await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => (x.content ?? '').length > 800); return (rich[0] ?? d.documents[0])?.id; })`);
  await api.goto(`${APP}/documents/${docId}`);
  await api.sleep(2500);
  const before = await api.eval(`fetch('/v1/materials', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.materials.length)`);

  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    return 'focused';
  })()`);
  await until(api, (s) => s.bar, "the voice bar never appeared in the Logue app");

  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Voice ·')).click();
    return 'go';
  })()`);
  await until(api, (s) => (s.barText || "").includes("Accept"), "recording never started");
  await api.sleep(5000);
  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => b.textContent.includes('Accept')).click();
    return 'stop';
  })()`);

  // The material the Host wrote, and the plan it froze onto it.
  let latest = null;
  for (let i = 0; i < 40; i++) {
    await api.sleep(1000);
    latest = await api.eval(`fetch('/v1/materials', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => { if (d.materials.length <= ${before}) return null; const m = d.materials[0]; return { kind: m.kind, content: (m.content ?? '').slice(0, 90), applied: m.applied_context ?? null }; })`);
    if (latest?.applied) break;
  }
  check("a real recording became a Source", Boolean(latest), latest ? `${latest.kind}: ${latest.content}` : "none arrived");
  check("the frozen plan names the Transcription Skill", latest?.applied?.skill?.name === "Transcription", JSON.stringify(latest?.applied?.skill ?? null));
  check("and carries its own words, not a fixed sentence",
    /take out only what nobody meant to say/.test(latest?.applied?.instructions ?? ""),
    (latest?.applied?.instructions ?? "").slice(0, 120));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
