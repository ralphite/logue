// The agent's four states in the panel: busy, error, empty, too much.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

// Ask, once the button will actually take the click. Typing the question is
// not enough: Ask stays disabled while the previous turn is still in flight,
// and a click on a disabled button is silently nothing — which had me waiting
// on the error of a question that was never asked.
async function ask(api, text) {
  for (let i = 0; i < 40; i++) {
    const state = await api.eval(`(() => {
      const box = document.querySelector('textarea');
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(box, ${JSON.stringify(text)});
      box.dispatchEvent(new Event('input', { bubbles: true }));
      const go = [...document.querySelectorAll('button')].find(b => /^Ask$/.test(b.textContent.trim()));
      if (!go || go.disabled) return 'waiting';
      go.click();
      return 'asked';
    })()`);
    if (state === "asked") return;
    await api.sleep(1000);
  }
  throw new Error("Ask never became clickable");
}

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  const panel = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;
  await api.goto(panel);
  await api.sleep(2500);
  await api.eval(`chrome.storage.local.remove(['logue:thread', 'logue:listen-at'])`);
  await api.goto(panel);
  await api.sleep(2500);

  // -- busy: the wait is visible, and the button cannot be pressed twice ---
  await ask(api, "what do my notes say about Logue?");
  await api.sleep(900);
  const busy = await api.eval(`(() => {
    const go = [...document.querySelectorAll('button')].find(b => /Ask/.test(b.textContent));
    return { disabled: go?.disabled ?? null, spinner: Boolean(document.querySelector('[class*="logue-spin"]')) };
  })()`);
  check("while it works, Ask is held and a spinner shows", busy.disabled === true && busy.spinner === true, JSON.stringify(busy));
  for (let i = 0; i < 45; i++) { await api.sleep(1000); if (await api.eval(`/stand-in/.test(document.body.textContent)`)) break; }

  // -- error: the model fails mid-loop ------------------------------------
  await ask(api, "[mock:fail] what do my notes say?");
  let failed = null;
  for (let i = 0; i < 40; i++) {
    await api.sleep(1000);
    failed = await api.eval(`(() => {
      const alert = document.querySelector('[role="alert"]');
      return { text: alert ? alert.textContent.trim().slice(0, 100) : null,
               spinning: Boolean(document.querySelector('[class*="logue-spin"]')) };
    })()`);
    if (failed.text) break;
  }
  check("a failed turn says so, in words", Boolean(failed?.text), String(failed?.text));
  check("…and does not leave a spinner turning", failed?.spinning === false, JSON.stringify(failed));
  const usable = await api.eval(`(() => {
    const box = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, 'x');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const go = [...document.querySelectorAll('button')].find(b => /^Ask$/.test(b.textContent.trim()));
    const enabled = !go.disabled;
    set.call(box, ''); box.dispatchEvent(new Event('input', { bubbles: true }));
    return enabled;
  })()`);
  check("…and asking again is possible", usable === true);

  // -- a refused proposal reports, rather than failing silently -----------
  const refused = await api.eval(`fetch('http://127.0.0.1:8787/v1/agent/accept', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'extension' }, body: JSON.stringify({ proposal: { tool: 'add_to_project', project: 'No Such Project', source_ids: [] } }) }).then(r => r.json().then(b => ({ status: r.status, body: JSON.stringify(b).slice(0, 90) })))`);
  check("a proposal naming a Project that is not there is refused", refused.status === 400, JSON.stringify(refused));

  // -- empty: a fresh conversation shows nothing rather than an empty box --
  await api.eval(`chrome.storage.local.remove('logue:thread')`);
  await api.goto(panel);
  await api.sleep(2500);
  const empty = await api.eval(`({ thread: /From this page/.test(document.body.textContent), height: document.body.scrollHeight })`);
  check("an empty conversation takes no room at all", empty.thread === false, JSON.stringify(empty));

  // -- too much: a long answer does not widen the 360px panel -------------
  await ask(api, "[mock:long] say a great deal");
  let wide = null;
  for (let i = 0; i < 45; i++) {
    await api.sleep(1000);
    wide = await api.eval(`(() => {
      const body = document.body;
      return { long: body.textContent.length > 3000, overflow: body.scrollWidth > window.innerWidth + 1, chars: body.textContent.length };
    })()`);
    if (wide.long) break;
  }
  check("a very long answer does not widen the panel", wide?.long === true && wide?.overflow === false, JSON.stringify(wide));

  const failedCount = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failedCount}/${results.length} passed`);
  if (failedCount > 0) throw new Error(`${failedCount} checks failed`);
}
