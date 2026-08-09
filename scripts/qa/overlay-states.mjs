// The four states on the last surface that has never been checked: the
// overlays Logue puts on a page. Real page (the app's own long document),
// real Host, the stand-in for the model.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const SR = `document.getElementById('logue-host').shadowRoot`;

async function until(api, expression, label, timeout = 45000) {
  const start = Date.now();
  for (;;) {
    const value = await api.eval(expression);
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`${label} — never happened`);
    await api.sleep(700);
  }
}

export async function run(api) {
  // Land on the app before asking it anything: a privileged page (chrome's
  // new-tab, where the browser sits between runs) refuses the fetch outright.
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => (x.content ?? '').length > 800); return (rich[0] ?? d.documents[0])?.id; })`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);

  // -- the selection toolbar: its states over a real paragraph ------------
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    const target = [...editor.querySelectorAll('p')].find(p => p.textContent.trim().length > 40) ?? editor;
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  })()`);
  const bar = await until(api, `Boolean(${SR}.querySelector('[aria-label="Selection actions"]'))`, "the selection toolbar");
  check("the selection toolbar comes up on a real paragraph", bar === true);

  const skills = await api.eval(`[...${SR}.querySelectorAll('[aria-label="Selection actions"] button')].map(b => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 6)`);
  check("…offering Skills, not an empty strip", (skills ?? []).length > 1, JSON.stringify(skills));

  // Running one: the wait has to be visible.
  // By name. "Voice comment" is not a Skill, and a case-sensitive /Comment/
  // let it through — the click started the microphone and I sat waiting for
  // an answer no Skill had been asked for.
  await api.eval(`(() => {
    const buttons = [...${SR}.querySelectorAll('[aria-label="Selection actions"] button')];
    const skill = buttons.find(b => /Simplify/i.test(b.textContent));
    if (!skill) return 'no Simplify Skill on the bar';
    skill.click();
    return 'ran';
  })()`);
  const working = await until(api, `(() => {
    const sr = ${SR};
    const status = sr.querySelector('[role="status"]');
    return status ? status.textContent.trim() || 'status' : (sr.querySelector('[class*="logue-spin"]') ? 'spinner' : null);
  })()`, "a visible wait");
  check("running a Skill shows the wait", Boolean(working), String(working));

  // What the answer renders as: a citation chip, an "N Sources" label and an
  // Insert button. Two earlier versions of this check read text — first the
  // whole shadow root (which includes the injected stylesheet, so it went
  // green on a Tailwind licence comment), then leaf elements only (which the
  // answer's own markup is not). Assert the controls it puts on screen.
  const answered = await until(api, `(() => {
    const sr = ${SR};
    const insert = [...sr.querySelectorAll('button')].find(b => /^Insert$/.test(b.textContent.trim()));
    const sources = [...sr.querySelectorAll('span')].find(el => /\\d+ Sources?/.test(el.textContent));
    return insert && sources ? sources.textContent.trim() : null;
  })()`, "an answer", 60000);
  check("…and then the answer, in place", Boolean(answered), String(answered));

  // -- the ask box: error and overflow ------------------------------------
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(2500);
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  })()`);
  await until(api, `Boolean(${SR}.querySelector('[aria-label="Logue voice"]'))`, "the voice bar");
  await api.eval(`[...${SR}.querySelectorAll('[aria-label="Logue voice"] button')].find(b => /Ask Logue/.test(b.getAttribute('aria-label') || '')).click()`);
  await until(api, `Boolean(${SR}.querySelector('[aria-label="Ask Logue"]'))`, "the ask box");
  check("the ask box opens from the bar", true);

  const askFor = async (text) => {
    for (let i = 0; i < 30; i++) {
      const state = await api.eval(`(() => {
        const sr = ${SR};
        const box = sr.querySelector('[aria-label="What to ask"]');
        if (!box) return 'gone';
        const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        set.call(box, ${JSON.stringify(text)});
        box.dispatchEvent(new Event('input', { bubbles: true }));
        const go = [...sr.querySelectorAll('button')].find(b => /Run/.test(b.textContent));
        if (!go || go.disabled) return 'waiting';
        go.click();
        return 'asked';
      })()`);
      if (state === "asked") return;
      await api.sleep(800);
    }
    throw new Error("Run never became clickable");
  };

  await askFor("[mock:fail] what is this about?");
  const failed = await until(api, `${SR}.querySelector('[role="alert"]')?.textContent?.trim().slice(0, 80) ?? null`, "the error", 60000);
  check("a failed ask says so on the page", /stand-in failed/.test(failed), String(failed));
  const spinning = await api.eval(`Boolean(${SR}.querySelector('[class*="logue-spin"]'))`);
  check("…with no spinner left turning", spinning === false);

  await askFor("[mock:long] say a great deal about this");
  const long = await until(api, `(() => {
    const sr = ${SR};
    const box = sr.querySelector('[aria-label="Ask Logue"]');
    if (!box || box.textContent.length < 3000) return null;
    const rect = box.getBoundingClientRect();
    return JSON.stringify({ chars: box.textContent.length, width: Math.round(rect.width), right: Math.round(rect.right), inside: rect.right <= window.innerWidth + 1, tall: Math.round(rect.height) <= window.innerHeight });
  })()`, "a very long answer", 90000);
  const box = JSON.parse(long);
  check("a very long answer stays inside the window", box.inside && box.tall, long);
  const pageWide = await api.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  check("…and does not widen the page under it", pageWide === true);

  const failedCount = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failedCount}/${results.length} passed`);
  if (failedCount > 0) throw new Error(`${failedCount} checks failed`);
}
