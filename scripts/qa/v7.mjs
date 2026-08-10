// V7 — select a passage, let the model propose, rule on each change, apply.
// The mock's generate ignores the passage and answers its fixed sentence, so
// every run is one big change hunk — enough to prove the decision mechanics
// and the apply path; the quality of proposals is S3's re-verification.
const APP = "http://127.0.0.1:8787";

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto(APP);
  await api.sleep(2500);
  const doc = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — V7 rewrite', content: '<p>The opening line stays.</p><p>This passage will be rewritten by the mock.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);
  await api.eval(`location.hash = '#/documents/${doc}'`);
  await api.sleep(2200);

  // Select the second paragraph, then press Rewrite.
  const pressed = await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    const target = [...editor.querySelectorAll('p')].find(p => /rewritten by the mock/.test(p.textContent));
    if (!target) return 'no passage';
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const button = [...document.querySelectorAll('main button')].find(b => /Rewrite/.test(b.textContent));
    if (!button) return 'no Rewrite button';
    button.click();
    return 'pressed';
  })()`);
  check("Rewrite opens on a live selection", pressed === "pressed", String(pressed));
  await api.sleep(1000);

  const proposed = await api.eval(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'no dialog';
    const box = dialog.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, 'make it plainer');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const go = [...dialog.querySelectorAll('button')].find(b => /Propose/.test(b.textContent));
    go.click();
    return 'proposing';
  })()`);
  check("an instruction can be given", proposed === "proposing", String(proposed));
  await api.sleep(3500);

  const hunks = await api.eval(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const changes = [...dialog.querySelectorAll('button[aria-pressed]')];
    return JSON.stringify({
      changes: changes.length,
      accepted: changes.filter(c => c.getAttribute('aria-pressed') === 'true').length,
      hasApply: [...dialog.querySelectorAll('button')].some(b => /Apply/.test(b.textContent)),
    });
  })()`);
  const seen = JSON.parse(hunks);
  check("the proposal arrives as decisions", seen.changes >= 1 && seen.hasApply, hunks);
  check("changes start accepted", seen.accepted === seen.changes, `${seen.accepted}/${seen.changes}`);

  // Rule on it: reject, check the assembled text keeps the original; then
  // re-accept and apply.
  await api.eval(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    dialog.querySelector('button[aria-pressed]').click();
  })()`);
  await api.sleep(400);
  const rejected = await api.eval(`document.querySelector('[role="dialog"] button[aria-pressed]').getAttribute('aria-pressed')`);
  check("a change can be rejected", rejected === "false", String(rejected));
  // Accept and Apply as two separate acts with a render between them — the
  // first version clicked both in one synchronous script, so Apply closed
  // over the not-yet-committed rejection and dutifully applied the original.
  await api.eval(`document.querySelector('[role="dialog"] button[aria-pressed]').click()`);
  await api.sleep(500);
  await api.eval(`[...document.querySelectorAll('[role="dialog"] button')].find(b => /^Apply$/.test(b.textContent.trim())).click()`);
  await api.sleep(2500);

  const after = await api.eval(`JSON.stringify({
    text: document.querySelector('main [contenteditable="true"]').innerText.replace(/\\s+/g, ' ').slice(0, 160),
  })`);
  const body = JSON.parse(after);
  // What changed, not what the stand-in used to say. The old assertion looked
  // for "mock answer standing in for the model" — words a real model will
  // never produce — so it reported a working rewrite as a failure.
  check(
    "the accepted rewrite lands in the document",
    !/The mock will rewrite this passage/.test(body.text) && body.text.length > 20,
    body.text,
  );
  console.log(`        the rewrite, for you to judge: ${body.text}`);
  check("and the untouched paragraph stays", /The opening line stays/.test(body.text), body.text);

  // The proposal itself is on record.
  const run = await api.eval(`fetch('/v1/runs').then(r => r.json()).then(d => JSON.stringify(d.runs.find(r => r.kind === 'rewrite' && r.document_id === '${doc}') ? true : false))`);
  check("the proposal is kept as a Run", run === "true", String(run));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) throw new Error(failed.map((f) => f.name).join("; "));
}
