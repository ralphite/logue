/**
 * F1 — a busy model is waited out, not handed over.
 *
 * His report: a 1:05 recording came back as `Model rejected the request
 * (503) … high demand … Please try again later.` with a `Try again` link to
 * press. This walks the same failure in a real browser and asserts the three
 * things that changed:
 *
 *  1. the row says it is being tried again, and shows the audio while it waits;
 *  2. a spike that passes finishes the recording **with nobody pressing
 *     anything** — the whole claim;
 *  3. a model that stays busy still ends at the message and the button, so
 *     "we tried" never becomes "we are still trying" forever.
 *
 * The 503 is caused, not waited for, and caused on a throwaway Host so the
 * person's own workspace and key are never touched.
 *
 *   ./scripts/qa/busy-host.sh start
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8796
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/f1.mjs
 *
 * Chrome's own fake microphone is enough here: the stand-in model never
 * listens to the audio, it only refuses it.
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
/** The Host whose model is busy. */
const BUSY = process.env.LOGUE_BUSY_HOST ?? "http://127.0.0.1:8796";
/** The stand-in model itself, which can be told the spike has passed. */
const MODEL = process.env.LOGUE_BUSY_MODEL ?? "http://127.0.0.1:8795";



function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const READ = `(() => {
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
  const text = document.body.textContent;
  return JSON.stringify({
    buttons: [...document.querySelectorAll('button')].map(label),
    trying: text.includes('The model was busy. Trying again'),
    transcribing: text.includes('Transcribing…'),
    refused: /The model is busy \\(503\\)\\./.test(text),
    tryAgain: [...document.querySelectorAll('button')].some((b) => label(b) === 'Try again'),
    players: document.querySelectorAll('audio').length,
    texts: [...document.querySelectorAll('p.whitespace-pre-wrap')].map((p) => p.textContent.trim()),
  });
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
    await a.sleep(600);
  }
}

async function open(a, panel, at) {
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(at)} }).then(() => "ok")`);
  await a.goto(panel);
  await a.sleep(2500);
}

/**
 * Talk for a few seconds, then send.
 *
 * The panel is one box now (N13): the mic is `Talk`, and the arrow both puts
 * the words in the box and sends them — which is the path a recording takes
 * when someone speaks and submits in one go.
 */
async function record(a, seconds = 4) {
  await a.eval(pressLabel("Talk"));
  await until(a, (s) => s.buttons.includes("Discard"), "recording never started", 20000);
  await a.sleep(seconds * 1000);
  await a.eval(pressLabel("Insert and send"));
}

export async function run(a) {
  const id = await extensionId(PORT);
  if (!id) throw new Error("no extension id — pass LOGUE_EXTENSION_ID");
  await a.goto(`chrome-extension://${id}/manifest.json`);
  await a.sleep(300);
  const manifest = JSON.parse(await a.eval("document.body.innerText"));
  const panel = `chrome-extension://${id}/${manifest.side_panel.default_path}`;

  // ---------- 1. the row says it is waiting, and shows the audio ----------
  await open(a, panel, BUSY);
  await record(a);
  // The Host asks four times over about seven seconds before this appears.
  const waiting = await until(a, (s) => s.trying, "the row never said it was being tried again", 45000);
  check("F1a — a busy model is said to be busy, in the row that is waiting", waiting.trying);
  check("F1b — and the recording is playable while it waits", waiting.players > 0, `${waiting.players} player(s)`);
  check("F1c — with no button to press yet", !waiting.tryAgain);
  await a.screenshot(new URL("./f1-trying.png", import.meta.url).pathname);

  // ---------- 2. the spike passes, and nobody presses anything ----------
  await fetch(`${MODEL}/ease`);
  const heard = await until(a, (s) => s.texts.length > 0, "the recording never finished by itself", 45000);
  check("F1d — a spike that passes finishes the recording with nobody pressing anything",
    heard.texts.length > 0, heard.texts[0]?.slice(0, 60));
  check("F1e — and nothing is left saying it failed", !heard.trying && !heard.refused);
  await a.screenshot(new URL("./f1-heard.png", import.meta.url).pathname);

  // ---------- 3. a model that stays busy ends at the button ----------
  // Restarted refusing everything: the attempts must run out and hand the
  // person the failure, or "it tries again" becomes a spinner with no end.
  const { execFileSync } = await import("node:child_process");
  execFileSync(new URL("./busy-host.sh", import.meta.url).pathname, ["start"], { stdio: "ignore" });
  await open(a, panel, BUSY);
  await record(a);
  const gaveUp = await until(a, (s) => s.refused && s.tryAgain, "the attempts never ran out", 90000);
  check("F1f — a model that stays busy ends at the message and the button", gaveUp.refused && gaveUp.tryAgain);
  check("F1g — and the recording is still playable there", gaveUp.players > 0, `${gaveUp.players} player(s)`);
  await a.screenshot(new URL("./f1-gave-up.png", import.meta.url).pathname);
}
