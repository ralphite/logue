/**
 * A failed dictation row shows the audio, not only the error.
 *
 * The failure is caused on the throwaway refusing Host (n5-hosts.sh): the
 * audio reaches it and is written, the model rejects the key, and the row must
 * then hold three things at once — the player, the message, and Try again.
 * Chrome's built-in fake device (a tone) is enough here: the refusal is about
 * the key, not about the words.
 *
 *   scripts/qa/n5-hosts.sh start
 *   ./scripts/qa/browser.sh 9899
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/failed-row-audio.mjs
 */
const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const REAL = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
/** A real Host whose model will refuse everything. */
const REFUSING = process.env.LOGUE_REFUSING ?? "http://127.0.0.1:8798";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Every dictation row, read as the three things it can hold. */
const READ = `(() => {
  const rows = [...document.querySelectorAll('.logue-scroll > div.rounded-lg')].map((row) => ({
    audio: Boolean(row.querySelector('button[aria-label="Play"], button[aria-label="Pause"]')),
    failed: (row.querySelector('div.text-danger')?.textContent || '').trim(),
    retry: [...row.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Try again'),
    working: /Transcribing/.test(row.textContent),
  }));
  const labels = [...document.querySelectorAll('button')].map(
    (b) => (b.getAttribute('aria-label') || b.textContent || '').trim(),
  );
  return JSON.stringify({ rows, labels });
})()`;

const pressLabel = (text) => `(() => {
  const wanted = ${JSON.stringify(text)};
  const hit = [...document.querySelectorAll('button')].find(
    (b) => ((b.getAttribute('aria-label') || b.textContent || '').trim()) === wanted
  );
  if (!hit) return 'no button ' + wanted;
  hit.click();
  return 'ok';
})()`;

async function until(a, test, label, timeout = 60000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${JSON.stringify(state).slice(0, 500)}`);
    await a.sleep(700);
  }
}

export async function run(a) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const seen = targets.find((t) => t.url.startsWith("chrome-extension://"));
  const id = process.env.LOGUE_EXTENSION_ID ?? seen?.url.split("/")[2];
  if (!id) throw new Error("no extension id — pass LOGUE_EXTENSION_ID");
  await a.goto(`chrome-extension://${id}/manifest.json`);
  await a.sleep(300);
  const manifest = JSON.parse(await a.eval("document.body.innerText"));
  const panel = `chrome-extension://${id}/${manifest.side_panel.default_path}`;

  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(REFUSING)} }).then(() => "ok")`);
  await a.goto(panel);
  await a.sleep(2200);

  await a.eval(pressLabel("Record"));
  await until(a, (s) => s.labels.includes("Done (Enter)"), "recording never started", 20000);
  // Give the tone something to be: a sub-second recording transcribes to
  // nothing and takes the "did not hear anything" exit before the Host.
  await a.sleep(4000);
  await a.eval(pressLabel("Done (Enter)"));

  const state = await until(a, (s) => s.rows.some((r) => r.failed), "the refusal never reached a row");
  const row = state.rows.find((r) => r.failed);
  check("F1 — the failed row plays the kept audio", row.audio, JSON.stringify(row));
  check("F2 — and still says what failed", /kept/i.test(row.failed), row.failed);
  check("F3 — and still offers Try again", row.retry);

  await a.screenshot(new URL("./failed-row-audio.png", import.meta.url).pathname);
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(REAL)} }).then(() => "ok")`);
}
