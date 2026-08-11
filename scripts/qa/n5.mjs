/**
 * N5 — nothing said is ever lost, whichever way it fails.
 *
 * Two failures, deliberately caused rather than waited for:
 *
 *  1. **No Host at all.** Point the extension at an address nothing answers
 *     on, record, and the audio must be kept in the browser and said so.
 *     Point it back and it must go in without being asked twice.
 *  2. **A Host that is there and a model that refuses.** The audio reaches the
 *     Host and is written before the model is asked, so the recording
 *     survives — and must be findable afterwards by something other than the
 *     tab that made it, which is the part that did not exist.
 *
 * The refusal is caused on a **throwaway Host** with a key no provider will
 * accept, never on the machine's own: a check that edits the real workspace's
 * model settings is one failed restore away from taking someone's key with it.
 *
 * Needs `LOGUE_TEST_REAL_MIC=1` — Chrome's fake devices give silence or a
 * tone, and a recording with nothing in it never reaches the failure under
 * test.
 *
 *   scripts/qa/n5-hosts.sh start          # throwaway Host on 8798, bad key
 *   LOGUE_TEST_REAL_MIC=1 ./scripts/qa/browser.sh 9666
 *   node scripts/qa/cdp.mjs 9666 ./scripts/qa/n5.mjs
 */
const PORT = process.env.LOGUE_QA_PORT ?? "9666";
const REAL = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
/** Nothing listens here. */
const NOWHERE = process.env.LOGUE_NOWHERE ?? "http://127.0.0.1:8799";
/** A real Host whose model will refuse everything. */
const REFUSING = process.env.LOGUE_REFUSING ?? "http://127.0.0.1:8798";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function speak(words) {
  const { spawn } = await import("node:child_process");
  await new Promise((done) => {
    const said = spawn("say", ["-r", "165", words]);
    said.on("close", done);
    said.on("error", done);
  });
}

const READ = `(() => {
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
  const foot = document.querySelector('.shrink-0.border-t');
  const waiting = document.body.textContent.match(/(\\d+) recordings? without words/);
  return JSON.stringify({
    footButtons: foot ? [...foot.querySelectorAll('button')].map(label) : [],
    waiting: waiting ? Number(waiting[1]) : 0,
    kept: /kept|did not come back|Logue is not running/i.test(document.body.textContent),
    texts: [...document.querySelectorAll('p.whitespace-pre-wrap')].map((p) => p.textContent.trim()),
  });
})()`;

/** Click a button by its exact label. */
const pressLabel = (text) => `(() => {
  const wanted = ${JSON.stringify(text)};
  const hit = [...document.querySelectorAll('button')].find(
    (b) => ((b.getAttribute('aria-label') || b.textContent || '').trim()) === wanted
  );
  if (!hit) return 'no button ' + wanted;
  hit.click();
  return 'ok';
})()`;

/** How many recordings the browser itself is holding, read from storage. */
const PENDING = `chrome.storage.local.get("logue:pending-voice").then(
  (stored) => String((stored["logue:pending-voice"] || []).length)
)`;

async function until(a, test, label, timeout = 90000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${JSON.stringify(state).slice(0, 500)}`);
    await a.sleep(700);
  }
}

/** Open the panel fresh, on Dictation, pointed at one Host. */
async function open(a, panel, at) {
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(at)} }).then(() => "ok")`);
  await a.goto(panel);
  await a.sleep(2200);
  await a.eval(pressLabel("Dictation"));
  await a.sleep(500);
}

/** Record for as long as it takes to say something, then accept it. */
async function say(a, words) {
  await a.eval(pressLabel("Record"));
  await until(a, (s) => s.footButtons.includes("Done (Enter)"), "recording never started", 20000);
  await speak(words);
  await a.sleep(600);
  await a.eval(pressLabel("Done (Enter)"));
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

  // ---------- 1. nothing is listening ----------
  await open(a, panel, NOWHERE);
  const before = Number(await a.eval(PENDING));
  await say(a, "This one is recorded while Logue is not running at all.");
  const kept = await until(a, (s) => s.waiting > 0 || s.kept, "the recording was not kept anywhere");
  const queued = Number(await a.eval(PENDING));
  check("N5a — with no Host, the audio is kept in the browser", queued === before + 1, `${before} → ${queued} queued`);
  check("N5a2 — and the panel says so rather than losing it quietly", kept.waiting > 0 || kept.kept,
    `${kept.waiting} without words`);

  // ---------- and goes in when the Host is back ----------
  // Counted in the browser's own queue, not in the panel's heading: this
  // workspace has other recordings waiting for reasons of its own, and a
  // heading that happens to read the same number proves nothing about this one.
  await open(a, panel, REAL);
  await a.eval(`chrome.runtime.sendMessage({ type: "logue:pending-send" }).then(() => "ok")`);
  const started = Date.now();
  let left = queued;
  while (left > before && Date.now() - started < 90000) {
    await a.sleep(1500);
    left = Number(await a.eval(PENDING));
  }
  check("N5b — and it goes in once Logue answers", left === before, `${queued} → ${left} queued`);

  // ---------- 2. the Host is there; the model refuses ----------
  const heldBefore = (await (await fetch(`${REFUSING}/v1/captures`)).json()).captures.length;
  await open(a, panel, REFUSING);
  await say(a, "This one reaches Logue, and the model refuses to transcribe it.");
  const stuck = await until(a, (s) => s.kept, "a refused recording left no trace");
  check("N5c — a refused recording says so in its own row", stuck.kept);
  // Reopen: the row belonged to this session. What the Host holds has to
  // survive the panel being closed, which is the whole point.
  await open(a, panel, REFUSING);
  const reopened = await until(a, (s) => s.waiting > 0, "closing the panel lost the refused recording", 30000);
  check("N5c2 — and is still there after the panel is closed and reopened", reopened.waiting > 0,
    `${reopened.waiting} without words`);

  const listed = (await (await fetch(`${REFUSING}/v1/captures`)).json()).captures;
  check("N5d — and the Host can name it, so no tab is needed to reach it", listed.length > heldBefore,
    `${heldBefore} → ${listed.length} held`);
  check("N5e — the audio is really there, not just an entry", await playable(listed.at(0)?.capture_id), listed.at(0)?.capture_id);

  await open(a, panel, REAL);
  await a.screenshot(new URL("./n5-kept.png", import.meta.url).pathname);
}

/** The bytes come back, which is what "kept" has to mean. */
async function playable(captureId) {
  if (!captureId) return false;
  const answer = await fetch(`${REFUSING}/v1/captures/${captureId}/audio`);
  const bytes = await answer.arrayBuffer();
  return answer.ok && bytes.byteLength > 0;
}
