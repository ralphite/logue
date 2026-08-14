/**
 * N13 — one list, one composer, in the real side panel beside a real article.
 *
 * The panel can be opened as an ordinary tab, and every earlier check does
 * that — but then the panel's "active tab" is itself, and the two things this
 * change is made of cannot be seen at all: the passage the page pushes, and
 * the entry that comes of keeping it. So this opens the side panel where it
 * lives, drives the article in one target and the panel in another, and reads
 * the Host afterwards to see what was actually written.
 *
 *   LOGUE_TEST_EXTENSION=$(pwd)/extension/dist \
 *     ./scripts/qa/browser.sh 9899 https://en.wikipedia.org/wiki/Speech_recognition
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/n13.mjs
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const ARTICLE = process.env.LOGUE_TEST_PAGE ?? "https://en.wikipedia.org/wiki/Speech_recognition";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** A second CDP connection, for the panel — `a` is already driving the page. */
async function connect(url) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const found = targets.find((t) => t.url.includes(url));
  if (!found) throw new Error(`no target for ${url}`);
  const ws = new WebSocket(found.webSocketDebuggerUrl);
  await new Promise((ready, failed) => {
    ws.onopen = ready;
    ws.onerror = failed;
  });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (message) => {
    const said = JSON.parse(message.data);
    const pending = waiting.get(said.id);
    if (!pending) return;
    waiting.delete(said.id);
    said.error ? pending.reject(new Error(JSON.stringify(said.error))) : pending.resolve(said.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const at = ++id;
      waiting.set(at, { resolve, reject });
      ws.send(JSON.stringify({ id: at, method, params }));
    });
  return {
    close: () => ws.close(),
    async shot(path) {
      const { writeFile } = await import("node:fs/promises");
      const taken = await call("Page.captureScreenshot", { format: "png" });
      await writeFile(path, Buffer.from(taken.data, "base64"));
    },
    async eval(expression) {
      const answer = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? "eval failed");
      return answer.result.value;
    },
  };
}

const READ = `JSON.stringify({
  text: document.body.innerText,
  quote: document.querySelector('[aria-label="Drop the quote"]') ? true : false,
  entries: document.querySelectorAll('article').length,
  buttons: [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label')||b.textContent||'').trim()).filter(Boolean),
})`;

async function until(panel, test, label, timeout = 20000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await panel.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${state.text.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function run(a) {
  // The article in this target, the panel in a second tab. Chrome's own side
  // panel cannot be opened by a debugger — `chrome.sidePanel.open` wants a
  // real gesture — so the panel runs as a tab, and the panel itself knows it
  // is never the page it is about (see `whichPage`).
  await a.goto(ARTICLE);
  await a.sleep(2500);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  // Ours, by its own worker — Chrome runs component extensions of its own,
  // and the first `chrome-extension://` target belongs to one of them.
  const id = await extensionId(PORT);
  if (!id) throw new Error("no Logue extension in this browser");
  await fetch(`http://127.0.0.1:${PORT}/json/new?chrome-extension://${id}/sidepanel.html`, { method: "PUT" });
  await a.sleep(2000);
  const panel = await connect("sidepanel.html");
  await panel.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);
  await panel.eval(`location.reload()`);
  await a.sleep(3000);

  const opened = JSON.parse(await panel.eval(READ));
  check("N13a — one composer, no Record / Keep / Ask", !opened.buttons.some((b) => /^(Record|Keep|Ask)$/.test(b)),
    opened.buttons.join(" · "));
  check("N13b — the box, the mic, the bookmark and send are the row",
    ["Talk", "Send", "Keep this whole page"].every((one) => opened.buttons.includes(one)),
    opened.buttons.join(" · "));

  // ---------- the passage the page pushes ----------
  const passage = await a.eval(`(() => {
    const paragraph = [...document.querySelectorAll('p')].find((p) => p.innerText.trim().length > 160);
    if (!paragraph) return '';
    // The whole paragraph: its first child may be a link or a <b>, and a
    // range built on the wrong node kind selects nothing at all.
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString().trim();
  })()`);
  check("N13c — there is a real passage to quote", passage.length > 40, passage.slice(0, 60));

  const quoted = await until(panel, (s) => s.quote, "the panel never received the selection");
  check("N13d — selecting on the page quotes it in the panel", quoted.quote);
  check("N13e — and the passage itself is what is quoted", quoted.text.includes(passage.slice(0, 40)));

  // ---------- keeping it, with something said about it ----------
  const before = (await (await fetch(`${HOST}/v1/materials?q=${encodeURIComponent(ARTICLE)}`)).json()).materials.length;
  const note = `QA n13 ${Date.now().toString().slice(-6)}`;
  await panel.eval(`(() => {
    const box = document.querySelector('textarea[aria-label="What to keep"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(box, ${JSON.stringify(note)});
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`);
  await panel.eval(`(() => {
    document.querySelector('[aria-label="Send"]').click();
    return 'sent';
  })()`);

  const landed = await until(panel, (s) => s.text.includes(note), "the note never appeared in the list", 25000);
  check("N13f — sending keeps it, as an entry in the one list", landed.text.includes(note));
  check("N13g — and the entry says what act it was", /Voice comment|Typed a note|Kept a passage/.test(landed.text),
    landed.text.split("\n").slice(0, 6).join(" | "));

  // ---------- what the Host actually holds ----------
  const after = (await (await fetch(`${HOST}/v1/materials?q=${encodeURIComponent(ARTICLE)}`)).json()).materials;
  const mine = after.find((one) => one.content === note);
  const quotedSource = after.find((one) => one.kind === "selection" && passage.startsWith(one.content.slice(0, 40)));
  check("N13h — the note is a Source on this page", Boolean(mine), mine?.id);
  check("N13i — the passage is its own Source, with an anchor", Boolean(quotedSource?.anchor?.exact),
    quotedSource?.anchor?.exact?.slice(0, 50));
  check("N13j — and the note hangs off the passage", Boolean(mine?.parent_ids?.includes(quotedSource?.id)),
    JSON.stringify(mine?.parent_ids ?? []));
  check("N13k — two Sources, not four", after.length === before + 2, `${before} → ${after.length}`);

  await panel.eval(`window.scrollTo(0,0)`);
  // The panel, not the page: the article has its own target and its own
  // screenshot, and this check is about what the panel shows.
  await panel.shot(new URL("./n13-panel.png", import.meta.url).pathname);

  // What this check made, it takes away again.
  for (const one of [mine, quotedSource].filter(Boolean)) {
    await fetch(`${HOST}/v1/materials/${one.id}`, { method: "DELETE", headers: { "X-Logue-Client": "web" } });
  }
  panel.close();
}
