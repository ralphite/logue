/**
 * F4 / F5 — the documents list can be rearranged by hand, and the editor has
 * the ordinary editing a page needs.
 *
 * The tree landed in F3 with no way to touch it: `parent_id` and `position`
 * were real, and moving a page meant calling the API by hand. Vibedoc's list
 * is dragged — reordered, and dropped into another page to nest it — renamed
 * in place, and deleted from the row. This drives all four in the real app
 * against the real Host, and reads the Host afterwards to see what was
 * written.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   LOGUE_QA_PORT=9899 node scripts/qa/cdp.mjs 9899 ./scripts/qa/f4.mjs
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

/** A drag, as the browser reports one: one DataTransfer through four events. */
const DRAG = (from, to, part) => `(() => {
  const rows = [...document.querySelectorAll('[data-doc]')];
  const a = rows.find((r) => r.dataset.doc === ${JSON.stringify(from)});
  const b = rows.find((r) => r.dataset.doc === ${JSON.stringify(to)});
  if (!a || !b) return 'missing row';
  const box = b.getBoundingClientRect();
  const y = box.top + box.height * ${part};
  const data = new DataTransfer();
  const fire = (node, type) => node.dispatchEvent(
    new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data, clientX: box.left + 40, clientY: y })
  );
  fire(a, 'dragstart');
  fire(b, 'dragover');
  fire(b, 'drop');
  fire(a, 'dragend');
  return 'ok';
})()`;

const at = async (id) => (await (await fetch(`${HOST}/v1/documents/${id}`)).json()).document;

export async function run(a) {
  // Two pages of our own, so nothing of his is dragged around.
  const stamp = String(Math.floor(Number(process.env.LOGUE_QA_STAMP ?? "0")) || 1);
  const one = (await post("/v1/documents", { content: `F4 first page ${stamp}` })).document;
  const two = (await post("/v1/documents", { content: `F4 second page ${stamp}` })).document;
  check("F4 — two pages to move around", Boolean(one?.id && two?.id), `${one?.id} · ${two?.id}`);

  await a.goto(`${HOST}/documents`);
  await a.sleep(3000);

  const rows = Number(await a.eval(`String(document.querySelectorAll('[data-doc]').length)`));
  check("F4 — the list marks its rows so a drop knows what it hit", rows > 0, `${rows} rows`);

  // -- dropped into another page, which is what nesting means ---------------
  check("F4 — dragging the second page onto the first", (await a.eval(DRAG(two.id, one.id, 0.5))) === "ok");
  await a.sleep(2500);
  const nested = await at(two.id);
  check("F4 — it is now inside the first", nested.parent_id === one.id, `parent ${nested.parent_id}`);

  // -- and back out, above it ----------------------------------------------
  check("F4 — dragging it back to the top edge of the first", (await a.eval(DRAG(two.id, one.id, 0.05))) === "ok");
  await a.sleep(2500);
  const out = await at(two.id);
  const first = await at(one.id);
  check("F4 — it is a page of its own again", !out.parent_id, `parent ${out.parent_id}`);
  check("F4 — and it sits above the one it was dropped over", out.position < first.position,
    `${out.position} < ${first.position}`);

  // -- renamed in place ----------------------------------------------------
  const RENAMED = `F4 renamed ${stamp}`;
  await a.eval(`(() => {
    const row = [...document.querySelectorAll('[data-doc]')].find((r) => r.dataset.doc === ${JSON.stringify(one.id)});
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return 'ok';
  })()`);
  await a.sleep(600);
  const typed = await a.eval(`(() => {
    const box = document.querySelector('input[aria-label="Name"]');
    if (!box) return 'no field';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(box, ${JSON.stringify(RENAMED)});
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'ok';
  })()`);
  check("F4 — double-clicking a row opens its name for editing", typed === "ok", typed);
  await a.sleep(2500);
  const named = await at(one.id);
  check("F4 — the name is the first line, written", named.title === RENAMED, named.title);

  // -- deleted from the row ------------------------------------------------
  const gone = await a.eval(`(async () => {
    const row = [...document.querySelectorAll('[data-doc]')].find((r) => r.dataset.doc === ${JSON.stringify(two.id)});
    if (!row) return 'no row';
    row.querySelector('[aria-label="More"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const item = [...document.querySelectorAll('[role="menuitem"], [role="menu"] button')]
      .find((b) => /Delete/.test(b.textContent || ''));
    if (!item) return 'no delete';
    item.click();
    await new Promise((r) => setTimeout(r, 600));
    const confirm = [...document.querySelectorAll('[role="dialog"] button')]
      .find((b) => (b.textContent || '').trim() === 'Delete');
    if (!confirm) return 'no confirm';
    confirm.click();
    return 'ok';
  })()`);
  check("F4 — deleting a page from its row asks first", gone === "ok", gone);
  await a.sleep(2500);
  const after = await fetch(`${HOST}/v1/documents/${two.id}`);
  check("F4 — and then it is gone", after.status === 404, `HTTP ${after.status}`);

  // -- F5: the editing a page needs ----------------------------------------
  await a.goto(`${HOST}/documents/${one.id}`);
  await a.sleep(3000);
  const editor = JSON.parse(await a.eval(`(() => JSON.stringify({
    words: /\\d+ words?/.test(document.body.innerText),
    text: document.body.innerText.slice(0, 400),
  }))()`));
  check("F5 — the footer says how much has been written", editor.words, editor.text.replace(/\\n/g, " | ").slice(0, 140));

  const found = await a.eval(`(() => {
    const content = document.querySelector('.cm-content');
    if (!content) return 'no editor';
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', metaKey: true, bubbles: true }));
    return String(Boolean(document.querySelector('.cm-search')));
  })()`);
  check("F5 — ⌘F opens find and replace", found === "true", found);

  const dressed = JSON.parse(await a.eval(`(() => {
    const box = document.querySelector('.cm-search .cm-textfield');
    if (!box) return JSON.stringify({});
    const style = getComputedStyle(box);
    return JSON.stringify({ radius: style.borderRadius, height: style.height, font: style.fontFamily.slice(0, 20) });
  })()`));
  check("F5 — and it is wearing the product's own clothes", dressed.radius === "7px", JSON.stringify(dressed));

  // What this check made, it takes away again.
  await fetch(`${HOST}/v1/documents/${one.id}`, { method: "DELETE", headers: { "X-Logue-Client": "web" } });
}
