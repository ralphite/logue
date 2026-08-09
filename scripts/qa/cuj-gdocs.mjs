/**
 * CUJ 2 — voice into Google Docs.
 *
 * Docs paints on a canvas, so there is no focusable editable in the top
 * document; text goes in through a beforeinput event at its hidden sink. This
 * runs against a structural stand-in served as docs.google.com, which exercises
 * the real code path: the hostname check, finding the sink across an iframe,
 * and the beforeinput insertion.
 */
const PAGE = "https://docs.google.com/docs-mimic.html";
const HOST = "http://127.0.0.1:8787";

const READ = `(() => {
  const h = document.getElementById('logue-host');
  const sr = h && h.shadowRoot;
  const bar = sr && sr.querySelector('[aria-label="Logue voice"]');
  const candidate = sr && sr.querySelector('[aria-label="Transcript"]');
  const settled = sr && sr.querySelector('[aria-label="Inserted"]');
  const alert = sr && sr.querySelector('[role="alert"]');
  return JSON.stringify({
    error: (h && h.dataset.logueError) || (alert && alert.textContent) || null,
    tracked: h && h.dataset.logueTarget,
    barPresent: !!bar,
    barText: bar ? bar.textContent : null,
    candidateText: candidate ? (candidate.querySelector('textarea') || {}).value : null,
    settled: !!settled,
    typed: window.typed || '',
  });
})()`;

async function until(api, check, label, timeout = 90000) {
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
  await api.sleep(1500);

  // No click needed: on Docs the bar anchors to the editor surface itself.
  const state0 = await until(api, (s) => s.barPresent, "voice bar never appeared on Docs");
  console.log("bar anchored without focus | tracked:", state0.tracked);

  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Voice ·')).click();
    return 'recording';
  })()`);
  await until(api, (s) => (s.barText || "").includes("Accept"), "recording never started");
  console.log("recording started");
  await api.sleep(6000);

  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => b.textContent.includes('Accept')).click();
    return 'stopped';
  })()`);

  const withText = await until(api, (s) => Boolean(s.candidateText), "transcript never arrived", 120000);
  console.log("transcript:", JSON.stringify(withText.candidateText));

  await api.eval(`(() => {
    const panel = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Transcript"]');
    [...panel.querySelectorAll('button')].find(b => b.textContent.includes('Insert')).click();
    return 'inserted';
  })()`);

  const done = await until(api, (s) => s.settled, "insert never settled");
  console.log("Docs received:", JSON.stringify(done.typed));

  const materials = JSON.parse(await api.eval(`fetch("${HOST}/v1/materials?kind=voice").then(r => r.text())`)).materials;
  const saved = materials[0];
  const fromDocs = String(saved?.source?.domain || "") === "docs.google.com";

  const transcript = String(withText.candidateText || "");
  const landed = String(done.typed || "").includes(transcript.slice(0, 12));
  console.log(
    landed && fromDocs
      ? "PASS CUJ 2 — speech reached the Docs editor and was saved against the Doc"
      : `FAIL CUJ 2 — landed=${landed} sourceDomain=${saved?.source?.domain}`,
  );
  if (!landed || !fromDocs) process.exitCode = 1;

  await api.screenshot(new URL("./cuj2-gdocs.png", import.meta.url).pathname);
}
