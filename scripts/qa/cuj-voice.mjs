/**
 * CUJ 1 — voice into an editable page.
 * Real microphone audio (a fake device fed a real WAV), real Host, real model.
 */
const PAGE = "http://127.0.0.1:8899/editor.html";

const READ = `(() => {
  const h = document.getElementById('logue-host');
  const sr = h && h.shadowRoot;
  const bar = sr && sr.querySelector('[aria-label="Logue voice"]');
  const candidate = sr && sr.querySelector('[aria-label="Transcript"]');
  const settled = sr && sr.querySelector('[aria-label="Inserted"]');
  const alert = sr && sr.querySelector('[role="alert"]');
  const label = (el) => el ? [...el.querySelectorAll('button')].map(b => b.getAttribute('aria-label')) : null;
  return JSON.stringify({
    tracked: h && h.dataset.logueTarget,
    error: (h && h.dataset.logueError) || (alert && alert.textContent) || null,
    barButtons: label(bar),
    barText: bar ? bar.textContent : null,
    candidateText: candidate ? (candidate.querySelector('textarea') || {}).value : null,
    settled: !!settled,
    docText: (document.getElementById('doc') || {}).innerText,
  });
})()`;

async function until(api, check, label, timeout = 60000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await api.eval(READ));
    if (check(state)) return state;
    if (state.error) throw new Error(`${label}: ${state.error}`);
    if (Date.now() - started > timeout) throw new Error(`${label}: timed out — ${JSON.stringify(state)}`);
    await api.sleep(500);
  }
}

export async function run(api) {
  await api.goto(PAGE);
  await api.sleep(1200);

  // Focus the editor and put the caret at the end, the way a person would.
  await api.eval(`(() => {
    const doc = document.getElementById('doc');
    doc.focus();
    const range = document.createRange();
    range.selectNodeContents(doc);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return 'focused';
  })()`);

  let state = await until(api, (s) => Boolean(s.barButtons), "voice bar never appeared");
  console.log("bar:", JSON.stringify(state.barButtons), "| tracked:", state.tracked);

  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Voice ·')).click();
    return 'recording';
  })()`);

  state = await until(api, (s) => (s.barText || "").includes("Accept"), "recording never started");
  console.log("recording started");

  // Let the fake device play a few seconds of real speech.
  await api.sleep(6000);

  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => b.textContent.includes('Accept')).click();
    return 'stopped';
  })()`);

  state = await until(api, (s) => s.candidateText !== null && s.candidateText !== undefined, "transcript never arrived", 120000);
  console.log("transcript:", JSON.stringify(state.candidateText));

  await api.eval(`(() => {
    const sr = document.getElementById('logue-host').shadowRoot;
    const panel = sr.querySelector('[aria-label="Transcript"]');
    [...panel.querySelectorAll('button')].find(b => b.textContent.includes('Insert')).click();
    return 'inserted';
  })()`);

  state = await until(api, (s) => s.settled, "insert never settled");
  console.log("document now:", JSON.stringify(state.docText));

  await api.screenshot(new URL("./cuj1-voice.png", import.meta.url).pathname);

  const transcript = String(state.candidateText || "");
  const inserted = String(state.docText || "").includes(transcript.slice(0, 12));
  console.log(inserted ? "PASS CUJ 1 — spoken text reached the page" : "FAIL CUJ 1 — text did not land");
  if (!inserted) process.exitCode = 1;
}
