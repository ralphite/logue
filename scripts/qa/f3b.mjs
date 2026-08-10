// F3 part two — the agent in the panel: Skills reachable, every step shown,
// Sources on the answer, and a write that waits for a person.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  if (!worker) throw new Error("the extension's worker never woke");
  const panel = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;

  await api.goto(panel);
  await api.sleep(2500);
  await api.eval(`chrome.storage.local.remove(['logue:thread', 'logue:listen-at'])`);
  await api.goto(panel);
  await api.sleep(2500);

  // Type a question. It goes to the agent, not to a one-shot Skill.
  const asked = await api.eval(`(() => {
    const box = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, 'what do my notes say about Logue?');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const go = [...document.querySelectorAll('button')].find(b => /^Ask$/.test(b.textContent.trim()));
    if (!go) return 'no Ask button';
    go.click();
    return 'asked';
  })()`);
  check("a typed question reaches the conversation", asked === "asked", String(asked));

  let seen = null;
  for (let i = 0; i < 45; i++) {
    await api.sleep(1000);
    seen = await api.eval(`(() => {
      const section = [...document.querySelectorAll('section')].find(s => /From this page/.test(s.textContent));
      if (!section) return null;
      return {
        yours: /what do my notes say/.test(section.textContent),
        steps: [...section.querySelectorAll('li')].map(li => li.textContent.trim()),
        // The longest paragraph that is not the question. Matching on the
        // words "stand-in" or "Source" was the stand-in's wording and the
        // citations' — and a real model's citations render as buttons, so
        // neither word is in the paragraph at all. It reported a missing
        // answer while counting six citations inside it.
        answer: [...section.querySelectorAll('p')]
          .map(p => p.textContent.trim())
          .filter(t => t.length > 40 && !/what do my notes say/i.test(t))
          .sort((a, b) => b.length - a.length)[0] ?? null,
        citations: section.querySelectorAll('[aria-label^="Source "]').length,
        sourcesNote: /\\d+ Sources/.test(section.textContent),
      };
    })()`);
    if (seen?.answer) break;
  }
  check("what you asked is in the conversation", seen?.yours === true, JSON.stringify(seen?.yours));
  check("every step it took is shown, in words", (seen?.steps ?? []).some(s => /Looked through your Sources/.test(s)), JSON.stringify(seen?.steps));
  check("the answer arrives", Boolean(seen?.answer), String(seen?.answer).slice(0, 80));
  check("…carrying live citations", (seen?.citations ?? 0) > 0, `${seen?.citations} citations`);
  check("…and saying how many Sources are behind it", seen?.sourcesNote === true);

  // A write is proposed, never done. Count documents before and after.
  const before = await api.eval(`fetch('http://127.0.0.1:8787/v1/documents', { headers: { 'X-Logue-Client': 'extension' } }).then(r => r.json()).then(d => d.documents.length)`);
  // From a clean conversation. The panel sends its history with every turn,
  // and after a few turns in which it has already drafted something, the agent
  // reasonably answers instead of proposing again — so a thread left by an
  // earlier run was what this check was really measuring.
  await api.eval(`chrome.storage.local.remove('logue:threads')`);
  await api.eval(`location.reload()`);
  await api.sleep(2500);
  await api.eval(`(() => {
    const box = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    // Asked in words, not with the stand-in's trigger. A real model reads
    // "[mock:propose]" as literal text and proposes or does not depending on
    // its mood — this check passed and failed on consecutive runs because of
    // it. A request that genuinely wants something written is the real test of
    // "offers, never does".
    set.call(box, 'Draft a short document summarising what my notes say about Logue.');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('button')].find(b => /^Ask$/.test(b.textContent.trim())).click();
  })()`);
  let proposed = null;
  for (let i = 0; i < 45; i++) {
    await api.sleep(1000);
    proposed = await api.eval(`(() => {
      const doIt = [...document.querySelectorAll('button')].find(b => /^Do it$/.test(b.textContent.trim()));
      if (!doIt) return null;
      return doIt.closest('div')?.textContent.trim().slice(0, 90) ?? 'found';
    })()`);
    if (proposed) break;
  }
  check("a change is offered, not made", Boolean(proposed), String(proposed));
  const during = await api.eval(`fetch('http://127.0.0.1:8787/v1/documents', { headers: { 'X-Logue-Client': 'extension' } }).then(r => r.json()).then(d => d.documents.length)`);
  check("…and nothing was written while it waited", during === before, `${before} → ${during}`);

  await api.eval(`[...document.querySelectorAll('button')].find(b => /^Do it$/.test(b.textContent.trim())).click()`);
  let after = before;
  for (let i = 0; i < 20; i++) {
    await api.sleep(1000);
    after = await api.eval(`fetch('http://127.0.0.1:8787/v1/documents', { headers: { 'X-Logue-Client': 'extension' } }).then(r => r.json()).then(d => d.documents.length)`);
    if (after > before) break;
  }
  check("it happens when a person says so", after === before + 1, `${before} → ${after}`);
  const done = await api.eval(`/Done — it is in your workspace/.test(document.body.textContent)`);
  check("…and the conversation says it happened", done === true);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
