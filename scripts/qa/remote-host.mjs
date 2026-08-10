/**
 * Pointing this browser at a Logue that is not on 127.0.0.1.
 *
 * Two claims, and neither can be shown by the other:
 *
 *  * The address is *used*. A capture that lands while the Host is also on
 *    this machine proves nothing — both addresses reach the same workspace. So
 *    the first half points the extension at a second, empty Host and checks
 *    that what it writes is in that workspace and not in the usual one.
 *  * A published address works at all. The second half connects to a real
 *    https tunnel and reads back which workspace answered — the extension's
 *    own fetch, through the worker, with the Host's origin rules in force.
 *
 * Run it with two addresses of your own:
 *   LOGUE_QA_OTHER=http://127.0.0.1:18900 LOGUE_QA_TUNNEL=https://… \
 *     node scripts/qa/cdp.mjs 9899 ./scripts/qa/remote-host.mjs
 */
const CDP = Number(process.env.LOGUE_QA_CDP ?? 9899);
const HERE = process.env.LOGUE_QA_HERE ?? "http://127.0.0.1:8787";
const OTHER = process.env.LOGUE_QA_OTHER;
const TUNNEL = process.env.LOGUE_QA_TUNNEL;
/** A port nothing is listening on: the typo case. */
const DEAD = process.env.LOGUE_QA_DEAD ?? "http://127.0.0.1:18901";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** What the address form is showing right now. */
const READ = `(() => {
  const field = document.getElementById('logue-server');
  const note = field && field.closest('div').parentElement.querySelector('p, [role="alert"]');
  return JSON.stringify({
    field: field ? field.value : null,
    note: note ? note.textContent : null,
    role: note ? note.getAttribute('role') : null,
  });
})()`;

const openForm = `(() => {
  if (document.getElementById('logue-server')) return 'already open';
  const button = [...document.querySelectorAll('button')]
    .find(b => (b.getAttribute('aria-label') || '').startsWith('Logue server'));
  if (!button) return 'no server button';
  button.click();
  return 'opened';
})()`;

const type = (address) => `(() => {
  const field = document.getElementById('logue-server');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(field, ${JSON.stringify(address)});
  field.dispatchEvent(new Event('input', { bubbles: true }));
  return field.value;
})()`;

const connect = `(() => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Connect');
  if (!button) return 'no Connect button';
  button.click();
  return 'clicked';
})()`;

/** One call through the worker — the same route every surface uses. */
const relay = (path, init = {}) => `chrome.runtime.sendMessage(${JSON.stringify({
  type: "logue:host",
  path,
  ...init,
})}).then(r => JSON.stringify(r))`;

async function until(a, test, label, timeout = 20000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${JSON.stringify(state)}`);
    await a.sleep(400);
  }
}

/** What this browser has been told to talk to, read from where it is kept. */
const stored = `chrome.storage.local.get('logue:server').then(v => v['logue:server'] ?? '')`;

async function point(a, address, label) {
  await a.eval(openForm);
  await a.sleep(300);
  await a.eval(type(address));
  await a.eval(connect);
  // Connecting closes the form, so its disappearance is the success — and an
  // error keeps it open with the reason in it.
  await until(a, (s) => s.field === null || s.role === "alert", label);
  const state = JSON.parse(await a.eval(READ));
  return { ...state, kept: await a.eval(stored) };
}

export async function run(a) {
  if (!OTHER || !TUNNEL) throw new Error("set LOGUE_QA_OTHER and LOGUE_QA_TUNNEL");
  // Unique per run: the second Host keeps its workspace between runs, and
  // counting a fixed sentence would count the last run's copy as this one's.
  const written = `written through the address in Settings ${new Date().toISOString()}`;

  // An idle worker is not a target, so a browser sitting on chrome://extensions
  // has nothing to read the extension's id from. A page with the content script
  // on it wakes one — which is also the state a person is ever in.
  await a.goto(process.env.LOGUE_QA_PAGE ?? "http://127.0.0.1:8899/editor.html");
  await a.sleep(1500);
  const targets = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json();
  // Ours by its file names, not by id: a profile carries Chrome's own
  // extensions too, and theirs are `service_worker*.js`.
  const mine = targets.find((t) => /^chrome-extension:\/\/[a-z]+\/(background\.js|offscreen\.html|sidepanel\.html)$/.test(t.url));
  if (!mine) throw new Error("no extension page to derive the panel path from");
  const panel = mine.url.replace(/[^/]+$/, "sidepanel.html");
  console.log("panel:", panel);
  await a.goto(panel);
  await a.sleep(2000);

  // 1 — out of the box, this browser talks to the Host on this computer. The
  // profile is throwaway but this panel is not: an earlier run of this check
  // left an address behind, and "the default" has to be read from the default.
  await a.eval(`chrome.storage.local.remove('logue:server').then(() => 'cleared')`);
  await a.goto(panel);
  await a.sleep(1500);
  await a.eval(openForm);
  await a.sleep(400);
  const first = JSON.parse(await a.eval(READ));
  check("the address starts on this computer", first.field === HERE, String(first.field));

  // 2 — an address with nothing behind it is refused, not kept. Keeping it
  // first would point every surface at nothing, and the way back would be this
  // same box — now unable to say whether the next address is any better.
  const dead = await point(a, DEAD, "refusing an address with no Logue behind it");
  check("an address that answers nothing is refused", dead.role === "alert", dead.note ?? "");
  // Nothing kept at all is this browser on the default, which is what step 1
  // left it on — the point is that the refused address did not replace it.
  check("and the refused address was not kept", dead.kept === "" || dead.kept === HERE, `“${dead.kept}”`);

  // 3 — a second, empty Host. Anything written after this must land there.
  const moved = await point(a, OTHER, "connecting to the second Host");
  check("connecting to another address is kept", moved.kept === OTHER, `${moved.kept} ${moved.note ?? ""}`);

  const wrote = JSON.parse(
    await a.eval(
      relay("/v1/materials", { method: "POST", body: JSON.stringify({ kind: "text", content: written }) }),
    ),
  );
  check("the worker's write reached a Host", wrote.ok === true && wrote.status < 400, `status ${wrote.status ?? "-"}`);

  const there = await (await fetch(`${OTHER}/v1/materials`)).json();
  const here = await (await fetch(`${HERE}/v1/materials`)).json();
  const mineThere = there.materials.filter((m) => m.content === written);
  const mineHere = here.materials.filter((m) => m.content === written);
  check("what was written is in the workspace that was named", mineThere.length === 1, `${mineThere.length} there`);
  check("and nowhere near the one that was not", mineHere.length === 0, `${mineHere.length} on ${HERE}`);

  // 4 — a published https address, which is the whole point of the setting.
  const tunnelled = await point(a, TUNNEL, "connecting to the tunnel");
  check("the tunnel address connects", tunnelled.kept === TUNNEL, `${tunnelled.kept} ${tunnelled.note ?? ""}`);

  const status = JSON.parse(await a.eval(relay("/v1/status")));
  const body = status.ok ? JSON.parse(status.text) : {};
  check("the extension reads the Host behind the tunnel", Boolean(body.ok) && typeof body.data_dir === "string", status.text?.slice(0, 120) ?? "");
  console.log("through the tunnel, the workspace answering is:", body.data_dir);

  // 5 — and back, so a throwaway profile is not the only thing keeping this tidy.
  const home = await point(a, HERE, "connecting back");
  check("it can be pointed back at this computer", home.kept === HERE, `${home.kept} ${home.note ?? ""}`);
}
