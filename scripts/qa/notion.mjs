/**
 * The Notion habits, in Logue's own editor.
 *
 * His words on the documents task: *"ux should be similar to notion"*. The
 * block menu landed in F3; this is the rest of what a person who writes in
 * Notion reaches for without thinking — the keys, the passage toolbar, the
 * hint on an empty line, and knowing where a nested page sits.
 *
 * Driven in the real app against the real Host, with the text read back off
 * the Host afterwards: what the keys write is Markdown, and Markdown is what
 * is stored.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   LOGUE_QA_PORT=9899 node scripts/qa/cdp.mjs 9899 ./scripts/qa/notion.mjs
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const post = async (path, body) =>
  (
    await fetch(`${HOST}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Logue-Client": "web" },
      body: JSON.stringify(body),
    })
  ).json();

const at = async (id) => (await (await fetch(`${HOST}/v1/documents/${id}`)).json()).document;

/**
 * Select a passage the way a person does — a DOM selection over the words.
 *
 * Not by reaching for the EditorView: nothing hands one out from the page, and
 * a check that needs the editor's internals is not checking what a person can
 * do. CodeMirror reads the document's selection, which is the same channel a
 * drag across the text uses.
 */
const SELECT = (needle) => `(() => {
  const content = document.querySelector('.cm-content');
  if (!content) return 'no editor';
  content.focus();
  const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const at = node.textContent.indexOf(${JSON.stringify("%NEEDLE%")});
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + ${JSON.stringify("%NEEDLE%")}.length);
    const chosen = window.getSelection();
    chosen.removeAllRanges();
    chosen.addRange(range);
    return 'ok';
  }
  return 'not found';
})()`.replaceAll("%NEEDLE%", needle);

/** Put the caret at the very end of the text. */
const AT_END = `(() => {
  const content = document.querySelector('.cm-content');
  if (!content) return 'no editor';
  content.focus();
  const chosen = window.getSelection();
  chosen.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  chosen.addRange(range);
  return 'ok';
})()`;

/** A key, as the editor's own keymap sees it. */
const KEY = (key, mods = {}) => `(() => {
  const content = document.querySelector('.cm-content');
  if (!content) return 'no editor';
  content.dispatchEvent(new KeyboardEvent('keydown', {
    key: ${JSON.stringify(key)},
    code: 'Key' + ${JSON.stringify(key.toUpperCase())},
    bubbles: true,
    ...${JSON.stringify(mods)},
  }));
  return 'ok';
})()`;

const TEXT = `(() => document.querySelector('.cm-content')?.textContent ?? '')()`;

export async function run(a) {
  const stamp = String(Math.floor(Number(process.env.LOGUE_QA_STAMP ?? "0")) || 1);
  const parent = (await post("/v1/documents", { content: `Notion outer ${stamp}` })).document;
  const page = (
    await post("/v1/documents", { content: `Notion match ${stamp}\n\nSome words to format here.`, parent_id: parent.id })
  ).document;

  await a.goto(`${HOST}/documents/${page.id}`);
  await a.sleep(3500);

  // -- where this page sits ------------------------------------------------
  // The last header on the page is the open document's; the first is the list's.
  const header = await a.eval(`(() => [...document.querySelectorAll('header')].pop()?.innerText ?? '')()`);
  check("Notion a — a nested page says which page it is inside", header.includes(`Notion outer ${stamp}`), header.replace(/\n/g, " · "));

  // -- the formatting keys -------------------------------------------------
  const words = await a.eval(TEXT);
  check("Notion — the passage is there to format", words.includes("words"), words.slice(0, 80));

  check("Notion — the passage can be selected", (await a.eval(SELECT("words"))) === "ok");
  await a.sleep(300);
  const bar = JSON.parse(await a.eval(`(() => {
    const one = document.querySelector('[role="toolbar"]');
    if (!one) return JSON.stringify({ open: false });
    const box = one.getBoundingClientRect();
    return JSON.stringify({
      open: true,
      buttons: [...one.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim()),
      onScreen: box.top >= 0 && box.left >= 0,
    });
  })()`));
  check("Notion b — selecting a passage brings up its toolbar", bar.open, JSON.stringify(bar));
  check("Notion c — with the four marks and the one act",
    ["Bold", "Italic", "Code", "Link", "Rewrite"].every((one) => (bar.buttons ?? []).includes(one)),
    (bar.buttons ?? []).join(" · "));
  check("Notion d — and it is on the screen, not above it", bar.onScreen === true);

  await a.eval(KEY("b", { metaKey: true }));
  await a.sleep(2000);
  const bolded = await at(page.id);
  check("Notion e — ⌘B writes Markdown, because Markdown is what is stored",
    bolded.content.includes("**words**"), bolded.content.split("\n").pop());

  // Pressing it again takes it off — a key that only ever adds is a key you
  // can press once.
  await a.eval(SELECT("words"));
  await a.sleep(300);
  await a.eval(KEY("b", { metaKey: true }));
  await a.sleep(2000);
  const plain = await at(page.id);
  check("Notion f — and pressing it again takes it off", !plain.content.includes("**words**"), plain.content.split("\n").pop());

  // -- the hint on an empty line -------------------------------------------
  await a.eval(AT_END);
  await a.sleep(300);
  const hinted = await a.eval(KEY("Enter"));
  await a.sleep(500);
  const shown = await a.eval(`(() => String(document.querySelector('.cm-hint')?.textContent ?? ''))()`);
  check("Notion g — an empty line offers the block menu", shown === "Type / for commands", `${hinted} · ${shown}`);

  await a.screenshot(new URL("./notion-editor.png", import.meta.url).pathname);

  // What this check made, it takes away again.
  for (const one of [page.id, parent.id]) {
    await fetch(`${HOST}/v1/documents/${one}`, { method: "DELETE", headers: { "X-Logue-Client": "web" } });
  }
}
