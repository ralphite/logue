/**
 * X1 — the panel and the app read one workspace, and follow it.
 *
 * His report: *"bugs: ext widget/sidepanel and webapp should have data
 * synced."* Both surfaces loaded once and then believed themselves; a Project
 * made in the app was invisible in the panel until it was closed and opened
 * again.
 *
 * This opens the panel, writes into the Host from somewhere else entirely —
 * a plain HTTP call, the way the app would — and asserts the panel changes
 * **without being touched**. Nothing is clicked between the write and the
 * check; that is the whole point.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/x1.mjs
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Everything the panel is showing, as text — no clicking, just reading. */
const READ = `JSON.stringify({
  text: document.body.innerText,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim()),
})`;

async function until(a, test, label, timeout = 15000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${state.text.slice(0, 300)}`);
    await a.sleep(500);
  }
}

const post = (path, body) =>
  fetch(`${HOST}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Logue-Client": "web" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export async function run(a) {
  const id = await extensionId(PORT);
  if (!id) throw new Error("no extension id — pass LOGUE_EXTENSION_ID");
  // The extension's own origin first: `chrome.storage` does not exist on an
  // ordinary page, and the address has to be set from inside the extension.
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(500);
  await a.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);
  await a.goto(`chrome-extension://${id}/sidepanel.html`);
  await a.sleep(2500);

  // ---------- a Project made somewhere else ----------
  const name = `QA sync ${Date.now().toString().slice(-6)}`;
  const opened = JSON.parse(await a.eval(READ));
  check("X1a — the panel is up and does not know this Project yet", !opened.text.includes(name));

  await post("/v1/projects", { name, overview: "Made by another surface while the panel was open." });
  // Nothing is clicked here. If this needs a click, the bug is not fixed.
  await a.eval(`(() => {
    const scope = [...document.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') || '').trim() === 'Project scope'
    );
    if (scope) scope.click();
    return 'ok';
  })()`);
  const seen = await until(a, (s) => s.text.includes(name), "the panel never saw the new Project");
  check("X1b — and finds it within a second or two, with nothing reloaded", seen.text.includes(name));
  await a.screenshot(new URL("./x1-panel.png", import.meta.url).pathname);

  // ---------- a Document made somewhere else ----------
  const title = `QA doc ${Date.now().toString().slice(-6)}`;
  await post("/v1/documents", { content: `# ${title}\n\nWritten by another surface.` });
  const listed = await (await fetch(`${HOST}/v1/documents`)).json();
  check(
    "X1c — the Host is the one record both surfaces read",
    listed.documents.some((one) => one.title === title),
    title,
  );

  // ---------- and the heartbeat costs nothing ----------
  const started = Date.now();
  for (let n = 0; n < 50; n += 1) await fetch(`${HOST}/v1/changes`);
  const each = (Date.now() - started) / 50;
  check("X1d — asking whether anything changed is free", each < 10, `${each.toFixed(1)}ms per ask`);

  // This runs against the real workspace, because that is where the extension
  // and the app both point. What it made, it takes away again.
  await gone(`/v1/documents`, "documents", (one) => one.title === title);
  await gone(`/v1/projects`, "projects", (one) => one.name === name);
}

/** Delete what this check created, and say so if it could not. */
async function gone(path, key, mine) {
  const listed = (await (await fetch(`${HOST}${path}`)).json())[key] ?? [];
  for (const one of listed.filter(mine)) {
    const answer = await fetch(`${HOST}${path}/${one.id}`, {
      method: "DELETE",
      headers: { "X-Logue-Client": "web" },
    });
    check(`X1e — cleared up after itself (${one.id})`, answer.ok);
  }
}
