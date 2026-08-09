/**
 * CUJ 5 — ask about the page, in the page, and get citations you can open.
 * Real Host, real model.
 */
const PAGE = "http://127.0.0.1:8899/editor.html";
const HOST = "http://127.0.0.1:8787";

const READ = `(() => {
  const h = document.getElementById('logue-host');
  const sr = h && h.shadowRoot;
  const box = sr && sr.querySelector('[aria-label="Ask Logue"]');
  const alert = sr && sr.querySelector('[role="alert"]');
  const chips = box ? [...box.querySelectorAll('button')].filter(b => /^\\d+$/.test(b.textContent.trim())) : [];
  return JSON.stringify({
    error: (h && h.dataset.logueError) || (alert && alert.textContent) || null,
    open: !!box,
    busy: box ? box.textContent.includes('Run') && !!box.querySelector('svg.animate-\\\\[logue-spin_0\\\\.8s_linear_infinite\\\\]') : false,
    answer: box ? (box.querySelector('p') || {}).textContent : null,
    chips: chips.map(c => c.textContent.trim()),
    sourceLine: box ? (box.textContent.match(/(\\d+) Sources/) || [])[0] : null,
  });
})()`;

async function until(api, check, label, timeout = 120000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await api.eval(READ));
    if (check(state)) return state;
    if (state.error) throw new Error(`${label}: ${state.error}`);
    if (Date.now() - started > timeout) throw new Error(`${label}: timed out — ${JSON.stringify(state)}`);
    await api.sleep(700);
  }
}

export async function run(api) {
  await api.goto(PAGE);
  await api.sleep(1200);

  // Focus the editor so the voice bar — and its Ask button — appear.
  await api.eval(`(() => {
    const doc = document.getElementById('doc');
    doc.focus();
    const range = document.createRange();
    range.selectNodeContents(doc);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return 'focused';
  })()`);
  await api.sleep(1200);

  await api.eval(`(() => {
    const bar = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Logue voice"]');
    [...bar.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Ask Logue').click();
    return 'opened';
  })()`);
  await until(api, (s) => s.open, "ask box never opened", 15000);
  console.log("ask box open");

  await api.eval(`(() => {
    const box = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Ask Logue"]');
    const area = box.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, 'In one sentence, why does asynchronous research produce better feedback?');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    // Page scope reads what has already been saved from this page.
    const scope = box.querySelector('select[aria-label="Scope"]');
    const setSelect = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setSelect.call(scope, 'page');
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    return 'typed';
  })()`);

  await api.eval(`(() => {
    const box = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Ask Logue"]');
    [...box.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Run')).click();
    return 'ran';
  })()`);

  const state = await until(api, (s) => Boolean(s.answer) && !s.answer.includes("Ask about"), "answer never arrived");
  console.log("answer:", JSON.stringify(String(state.answer).slice(0, 160)));
  console.log("citations:", JSON.stringify(state.chips), "|", state.sourceLine);

  // Opening a citation must reveal the passage it points at.
  let passage = null;
  if (state.chips.length > 0) {
    await api.eval(`(() => {
      const box = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Ask Logue"]');
      [...box.querySelectorAll('button')].find(b => /^\\d+$/.test(b.textContent.trim())).click();
      return 'opened citation';
    })()`);
    await api.sleep(600);
    passage = await api.eval(`(() => {
      const box = document.getElementById('logue-host').shadowRoot.querySelector('[aria-label="Ask Logue"]');
      const quoted = [...box.querySelectorAll('p')].at(-1);
      return quoted ? quoted.textContent.slice(0, 90) : null;
    })()`);
    console.log("citation opens:", JSON.stringify(passage));
  }

  const runs = JSON.parse(await api.eval(`fetch("${HOST}/v1/runs").then(r => r.text())`)).runs;
  const latest = runs[0];
  console.log("run:", latest.status, "| sources frozen:", latest.sources.length, "| skill rev:", latest.skill_revision);

  const ok =
    latest.status === "complete" &&
    latest.sources.length > 0 &&
    state.chips.length > 0 &&
    Boolean(passage);
  console.log(ok ? "PASS CUJ 5 — answer cites Sources you can open" : "FAIL CUJ 5");
  if (!ok) process.exitCode = 1;

  await api.screenshot(new URL("./cuj5-ask.png", import.meta.url).pathname);
}
