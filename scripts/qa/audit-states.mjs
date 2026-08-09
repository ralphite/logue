// The three audit states the revoked key had made unreachable:
// loading (the mock answers after a real ~1s), error ([mock:fail]),
// and overflow ([mock:long] — ~10k characters into every container).
const APP = "http://127.0.0.1:8787";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

export async function run(api) {
  await api.goto(APP);
  await api.sleep(2500);

  // A Project page with the ask box on it.
  const project = await api.eval(`fetch('/v1/projects').then(r => r.json()).then(d => JSON.stringify({ id: d.projects.find(p => p.name === 'Logue QA')?.id }))`);
  const { id } = JSON.parse(project);
  if (!id) throw new Error("no Logue QA project");
  await api.eval(`location.hash = '#/projects/${id}'`);
  await api.sleep(2200);

  const ask = async (text) => api.eval(`(() => {
    const box = [...document.querySelectorAll('main textarea')][0];
    if (!box) return 'no ask box';
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, ${JSON.stringify("PLACEHOLDER")}.replace('PLACEHOLDER', '') + ${JSON.stringify(text)});
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const go = [...document.querySelectorAll('main button')].find(b => /Ask|Run|Generate/i.test(b.textContent));
    if (!go) return 'no run button';
    go.click();
    return 'asked';
  })()`);

  // -- 1. loading: the second between asking and hearing back --------------
  console.log("state 1: loading");
  const started = await ask("Logue QA — loading state");
  check("the ask leaves", started === "asked", String(started));
  await api.sleep(400);
  const during = await api.eval(`(() => {
    const main = document.querySelector('main');
    return JSON.stringify({
      spinner: Boolean(main.querySelector('svg.animate-spin, [class*="animate-spin"]')),
      busyButton: [...main.querySelectorAll('button')].some(b => b.disabled && /Ask|Run|Generate/i.test(b.textContent)),
    });
  })()`);
  const waiting = JSON.parse(during);
  check("while the model thinks, the page says so", waiting.spinner || waiting.busyButton, during);
  await api.sleep(2500);

  // -- 2. error: the model refuses ----------------------------------------
  console.log("state 2: error");
  await ask("please [mock:fail] for the audit");
  await api.sleep(3000);
  const failed = await api.eval(`(() => {
    const main = document.querySelector('main');
    const note = [...main.querySelectorAll('*')].find(el => !el.children.length && /\\[mock\\] The stand-in failed/.test(el.textContent));
    return JSON.stringify({
      shown: Boolean(note),
      text: note ? note.textContent.trim().slice(0, 80) : null,
      stuckSpinner: Boolean(main.querySelector('[class*="animate-spin"]')),
    });
  })()`);
  const err = JSON.parse(failed);
  check("a refusal is shown in words", err.shown === true, String(err.text));
  check("and nothing keeps spinning", err.stuckSpinner === false, String(err.stuckSpinner));

  // -- 3. overflow: ten thousand characters --------------------------------
  console.log("state 3: overflow");
  await ask("[mock:long] for the audit");
  await api.sleep(3500);
  const flooded = await api.eval(`(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main');
    const answer = [...main.querySelectorAll('p, div')].filter(el => el.textContent.length > 5000)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    return JSON.stringify({
      chars: answer ? answer.textContent.length : 0,
      pageScrollsSideways: doc.scrollWidth > doc.clientWidth + 1,
      containerWiderThanPage: answer ? answer.getBoundingClientRect().width > doc.clientWidth : null,
    });
  })()`);
  const long = JSON.parse(flooded);
  check("the oversized answer really rendered", long.chars > 5000, `${long.chars} chars`);
  check("the page does not scroll sideways", long.pageScrollsSideways === false, String(long.pageScrollsSideways));
  check("no container escapes the page", long.containerWiderThanPage === false, String(long.containerWiderThanPage));

  await api.screenshot("/private/tmp/claude-501/-Users-yadong-dev2-logue/8645db08-78a3-40b7-880b-e1409ffe21f5/scratchpad/audit-states.png");
  const failedChecks = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failedChecks.length}/${results.length} passed`);
  if (failedChecks.length) throw new Error(failedChecks.map((f) => f.name).join("; "));
}
