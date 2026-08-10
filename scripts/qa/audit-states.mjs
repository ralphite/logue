// The three audit states, at real latency with a real model.
//
// Two things had gone stale here. The states were reached with the stand-in's
// trigger words — [mock:fail] and [mock:long] — which a real model reads as
// ordinary text and answers normally, so with a key in place the states became
// unreachable in the other direction and the check reported its own failures.
// And the answer stopped rendering under the ask box: it lands as a row in
// this Project's answers and opens in a dialog. The check was reading a page
// shape that no longer exists.
//
// Both fixed. The failure is provoked for real — the Host is pointed at a
// model name that does not exist, and put back — and the answer is read where
// it actually is.
const APP = "http://127.0.0.1:8787";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const ASK = (question) => `(() => {
  const main = document.querySelector('main');
  const box = main.querySelector('textarea');
  if (!box) return 'no box';
  box.focus();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, ${JSON.stringify(question)});
  box.dispatchEvent(new Event('input', { bubbles: true }));
  const go = [...main.querySelectorAll('button')].find(b => /^(Ask|Run|Send)/i.test((b.textContent || '').trim()) && !b.disabled);
  if (!go) return 'no button';
  go.click();
  return 'asked';
})()`;

/** Wait for the Host to finish the newest run, and report what it did. */
async function settled(api, api_before) {
  for (let i = 0; i < 60; i += 1) {
    await api.sleep(2000);
    const seen = JSON.parse(
      await api.eval(`fetch('/v1/runs?limit=1', { headers: { 'X-Logue-Client': 'web' } })
        .then(r => r.json())
        .then(d => JSON.stringify({ id: d.runs[0]?.id, status: d.runs[0]?.status,
          length: (d.runs[0]?.original_output ?? '').length, error: (d.runs[0]?.error ?? '').slice(0, 60) }))`),
    );
    if (seen.id && seen.id !== api_before && seen.status !== "running") return seen;
  }
  throw new Error("the run never settled");
}

export async function run(api) {
  await api.goto(APP);
  await api.sleep(2000);
  const project = await api.eval(
    `fetch('/v1/projects').then(r => r.json()).then(d => JSON.stringify({ id: d.projects.find(p => p.name === 'Logue QA')?.id }))`,
  );
  const { id } = JSON.parse(project);
  if (!id) throw new Error("no Logue QA project");
  await api.goto(`${APP}/projects/${id}`);
  await api.sleep(2500);

  const newestBefore = async () =>
    await api.eval(`fetch('/v1/runs?limit=1', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.runs[0]?.id ?? '')`);

  // -- 1. loading ----------------------------------------------------------
  console.log("state 1: loading");
  let before = await newestBefore();
  check("the ask leaves", (await api.eval(ASK("Write one short sentence about this Project."))) === "asked");
  await api.sleep(1200);
  const thinking = JSON.parse(
    await api.eval(`(() => {
    const main = document.querySelector('main');
    const go = [...main.querySelectorAll('button')].find(b => /^(Ask|Run|Send)/i.test((b.textContent || '').trim()));
    return JSON.stringify({ busyButton: Boolean(go?.disabled), moving: Boolean(main.querySelector('[class*="animate-"]')) });
  })()`),
  );
  check("while the model thinks, the page says so", thinking.busyButton || thinking.moving, JSON.stringify(thinking));
  await settled(api, before);

  // -- 2. error: a real refusal --------------------------------------------
  console.log("state 2: error");
  // /v1/model, not /v1/settings. The settings endpoint takes any key at all
  // and nothing reads a "model" written there — the first attempt at this set
  // it, saw the run succeed, and reported a product that ignores a bad model.
  // It was writing to a field that does not exist. (Filed as X37.)
  const realModel = await api.eval(
    `fetch('/v1/model', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.model ?? '')`,
  );
  const setModel = (value) =>
    api.eval(`fetch('/v1/model', { method: 'PATCH', headers: { 'content-type': 'application/json', 'X-Logue-Client': 'web' },
      body: JSON.stringify({ model: ${JSON.stringify(value)} }) }).then(r => r.status)`);
  await setModel("gemini-does-not-exist");
  before = await newestBefore();
  await api.eval(ASK("Summarise this Project in one line."));
  let failure;
  try {
    failure = await settled(api, before);
  } finally {
    // Put it back before asserting anything, so a failed assertion cannot
    // leave the owner's Host pointing at a model that is not there.
    await setModel(realModel);
  }
  const back = await api.eval(
    `fetch('/v1/model', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => d.model ?? '')`,
  );
  check("the model setting was put back", back === realModel, `${JSON.stringify(back)} vs ${JSON.stringify(realModel)}`);
  check("a bad model really fails, rather than answering", failure.status === "failed", JSON.stringify(failure));
  await api.sleep(2500);
  const shown = JSON.parse(
    await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...main.querySelectorAll('button')].find(b => /Summarise this Project in one line/.test(b.textContent || ''));
    return JSON.stringify({
      row: Boolean(row),
      saysFailed: /failed/i.test(row?.textContent ?? ''),
      stuckSpinner: Boolean(main.querySelector('[class*="animate-spin"]')),
    });
  })()`),
  );
  // Asked twice on purpose: once as the page stood when the run failed, and
  // once after a reload. "Never says" and "does not say until you reload" are
  // different bugs and only one of them is about the words.
  await api.goto(`${APP}/projects/${id}`);
  await api.sleep(3000);
  const reloaded = JSON.parse(
    await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...main.querySelectorAll('button')].find(b => /Summarise this Project in one line/.test(b.textContent || ''));
    return JSON.stringify({ row: Boolean(row), saysFailed: /failed/i.test(row?.textContent ?? '') });
  })()`),
  );
  check("the page says that one failed", shown.saysFailed === true,
    `live ${shown.saysFailed}, after a reload ${reloaded.saysFailed}`);
  check("…at least once it is reloaded", reloaded.saysFailed === true, JSON.stringify(reloaded));
  check("and nothing keeps spinning", shown.stuckSpinner === false, String(shown.stuckSpinner));

  // -- 3. overflow ----------------------------------------------------------
  //
  // A real model will not reliably write ten thousand characters on request —
  // 1,200 words asked for came back as 1,515 characters. So the longest answer
  // this workspace actually holds is what the layout is measured against, and
  // its length is printed rather than assumed.
  console.log("state 3: overflow");
  // The longest answer *on this page*. The first version took the longest in
  // the whole workspace, which belonged to a document — so it looked for a row
  // that was never going to be here and reported the dialog as broken.
  const longest = JSON.parse(
    await api.eval(`(() => {
      const main = document.querySelector('main');
      const rows = [...main.querySelectorAll('button')].filter(b => /Answer questions|Sources/.test(b.textContent || ''));
      const best = rows.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0];
      return JSON.stringify({ present: Boolean(best), length: (best?.textContent ?? '').length,
        instruction: (best?.textContent ?? '').slice(0, 40) });
    })()`),
  );
  console.log(`        the longest answer row on this page: "${longest.instruction}"`);
  check("there is an answer on this page to open", longest.present === true, JSON.stringify(longest));

  await api.eval(`(() => {
    const main = document.querySelector('main');
    const rows = [...main.querySelectorAll('button')].filter(b => /Answer questions|Sources/.test(b.textContent || ''));
    const best = rows.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0];
    if (!best) return 'no row';
    best.click();
    return 'opened';
  })()`);
  await api.sleep(2000);
  const layout = JSON.parse(
    await api.eval(`(() => {
    const doc = document.documentElement;
    const dialog = document.querySelector('[role="dialog"]');
    const scope = dialog ?? document.querySelector('main');
    const box = scope.getBoundingClientRect();
    return JSON.stringify({
      dialog: Boolean(dialog),
      pageScrollsSideways: doc.scrollWidth > doc.clientWidth + 1,
      widerThanPage: box.width > doc.clientWidth + 1,
      tallerThanWindow: box.height > window.innerHeight + 1,
      scrolls: scope.scrollHeight > scope.clientHeight + 1,
      characters: scope.textContent.trim().length,
    });
  })()`),
  );
  check("the answer opens where answers live", layout.dialog === true, JSON.stringify(layout));
  check("the page does not scroll sideways", layout.pageScrollsSideways === false, String(layout.pageScrollsSideways));
  check("nothing escapes the page width", layout.widerThanPage === false, String(layout.widerThanPage));
  check("it stays inside the window", layout.tallerThanWindow === false, String(layout.tallerThanWindow));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
