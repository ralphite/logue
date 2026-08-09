// P5 — the panel's Esc/Enter belong to the recording, not to the ask box.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  const panel = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;
  await api.goto(panel);
  await api.sleep(2500);
  await api.eval(`chrome.storage.local.remove(['logue:thread', 'logue:listen-at'])`);
  await api.goto(panel);
  await api.sleep(2500);

  await api.eval(`[...document.querySelectorAll('button')].find(b => /Talk to Logue/.test(b.getAttribute('aria-label') || '')).click()`);
  await api.sleep(3000);
  check("recording", (await api.eval(`/Listening/.test(document.body.textContent)`)) === true);

  // Esc while typing in the ask box must not cancel the recording.
  const survived = await api.eval(`(() => {
    const box = document.querySelector('textarea');
    box.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return /Listening/.test(document.body.textContent);
  })()`);
  await api.sleep(600);
  check("Esc in the ask box does not cancel the recording", survived === true && (await api.eval(`/Listening/.test(document.body.textContent)`)) === true);

  // Enter while typing must make a newline, not accept.
  const stillGoing = await api.eval(`(() => {
    const box = document.querySelector('textarea');
    box.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return /Listening/.test(document.body.textContent);
  })()`);
  await api.sleep(800);
  check("Enter in the ask box does not accept the recording", stillGoing === true);

  // Away from the box, both keys still work.
  await api.eval(`document.body.focus(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await api.sleep(900);
  check("Esc outside the box still cancels", (await api.eval(`/Listening/.test(document.body.textContent)`)) === false);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
