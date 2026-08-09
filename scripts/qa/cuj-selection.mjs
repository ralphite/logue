/**
 * CUJ 3 — save a selection.
 * CUJ 4 — comment on a selection (voice and text), keeping the parent chain.
 */
const PAGE = "http://127.0.0.1:8899/editor.html";
const HOST = "http://127.0.0.1:8787";

const READ = `(() => {
  const h = document.getElementById('logue-host');
  const sr = h && h.shadowRoot;
  const bar = sr && sr.querySelector('[aria-label="Selection actions"]');
  const note = sr && sr.querySelector('[aria-label="Comment on selection"]');
  const alert = sr && sr.querySelector('[role="alert"]');
  return JSON.stringify({
    error: (h && h.dataset.logueError) || (alert && alert.textContent) || null,
    barButtons: bar ? [...bar.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent) : null,
    barText: bar ? bar.textContent : null,
    noteOpen: !!note,
  });
})()`;

const selectArticle = `(() => {
  const p = document.getElementById('article');
  const range = document.createRange();
  range.setStart(p.firstChild, 0);
  range.setEnd(p.firstChild, 58);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  return sel.toString();
})()`;

async function until(api, check, label, timeout = 45000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await api.eval(READ));
    if (check(state)) return state;
    if (state.error) throw new Error(`${label}: ${state.error}`);
    if (Date.now() - started > timeout) throw new Error(`${label}: timed out — ${JSON.stringify(state)}`);
    await api.sleep(400);
  }
}

async function materials(api, query = "") {
  const body = await api.eval(
    `fetch("${HOST}/v1/materials?${query}").then(r => r.text())`,
  );
  return JSON.parse(body).materials;
}

function press(label) {
  return `(() => {
    const sr = document.getElementById('logue-host').shadowRoot;
    const bar = sr.querySelector('[aria-label="Selection actions"]') || sr.querySelector('[aria-label="Comment on selection"]');
    const button = [...bar.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || b.textContent || '').includes(${JSON.stringify(label)}));
    if (!button) return 'missing: ${label}';
    button.click();
    return 'clicked';
  })()`;
}

export async function run(api) {
  await api.goto(PAGE);
  await api.sleep(1200);

  const quote = await api.eval(selectArticle);
  console.log("selected:", JSON.stringify(quote.slice(0, 50)));

  let state = await until(api, (s) => (s.barButtons || []).length > 0, "selection toolbar never appeared");
  console.log("toolbar:", JSON.stringify(state.barButtons));

  // -- CUJ 3: save the selection ----------------------------------------
  const before = (await materials(api, "kind=selection")).length;
  console.log(await api.eval(press("Save selection")));
  await until(api, (s) => (s.barButtons || []).includes("Saved"), "save never confirmed");

  const saved = await materials(api, "kind=selection");
  const newest = saved[0];
  const savedOk = saved.length === before + 1 && newest.content.startsWith("Asynchronous research");
  console.log(savedOk ? "PASS CUJ 3 — selection saved with its exact quote" : `FAIL CUJ 3 — ${JSON.stringify(newest)}`);
  if (!savedOk) process.exitCode = 1;

  // -- CUJ 4: comment on the selection ----------------------------------
  // The toolbar stays usable through the confirmation, so commenting on what
  // was just saved needs no wait at all — which is the point of the change.
  await until(api, (s) => (s.barButtons || []).includes("Write comment"), "toolbar did not stay usable");
  console.log(await api.eval(press("Write comment")));
  await until(api, (s) => s.noteOpen, "comment box never opened");

  await api.eval(`(() => {
    const box = document.getElementById('logue-host').shadowRoot.querySelector('textarea[aria-label="Comment"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(box, 'This matches what we saw in the last study.');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`);
  console.log(await api.eval(press("Add")));

  await api.sleep(2500);
  const derived = (await materials(api, "kind=derived"))[0];
  const linked = derived && (derived.parent_ids || []).length > 0;
  console.log("comment:", JSON.stringify(derived?.content), "parents:", derived?.parent_ids);

  let parentIsQuote = false;
  if (linked) {
    const parent = JSON.parse(
      await api.eval(`fetch("${HOST}/v1/materials/${derived.parent_ids[0]}").then(r => r.text())`),
    ).material;
    parentIsQuote = String(parent.content).startsWith("Asynchronous research");
  }
  console.log(
    linked && parentIsQuote
      ? "PASS CUJ 4 — comment saved as derived, pointing at the quote"
      : "FAIL CUJ 4 — parent chain missing",
  );
  if (!linked || !parentIsQuote) process.exitCode = 1;

  await api.screenshot(new URL("./cuj3-4-selection.png", import.meta.url).pathname);
}
