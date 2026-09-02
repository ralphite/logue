// D2 + D3 — the two the owner approved and that went missing.
//
// D2: a kept item's words can be corrected in the panel, on the page they came
// from, without a trip to the Web App.
// D3: a Skill run from the selection toolbar puts its answer in the panel, and
// nowhere else — there is no second answer unfolding over the page.
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const HOST = "http://127.0.0.1:8787";

async function panelTarget() {
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  if (!worker) throw new Error("the extension's worker is not running");
  return `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;
}

export async function run(api) {
  // -- D3 -----------------------------------------------------------------
  // A real page with real prose: Logue's own Stream, which is what the owner
  // asked verification to prefer.
  await api.goto(`${HOST}/stream`);
  await api.sleep(2000);
  // Resolved only after a page has loaded: an idle worker is not in /json, and
  // the content script's first message is what wakes it.
  const panelUrl = await panelTarget();

  // The longest real Source in the workspace, opened by its own address. A
  // guessed rail selector opened nothing, and a page with only rail labels on
  // it has no passage to select — which read as "selection is broken".
  const longest = await api.eval(`(async () => {
    const reply = await fetch('${HOST}/v1/materials?limit=200').then(r => r.json());
    const best = (reply.materials ?? [])
      .filter(m => (m.content ?? '').length > 400)
      .sort((a, b) => b.content.length - a.content.length)[0];
    return best ? best.id : '';
  })()`);
  check("the workspace has a long real Source to work on", Boolean(longest), String(longest));
  await api.goto(`${HOST}/stream/${longest}`);
  await api.sleep(2500);
  const opened = await api.eval(`document.location.pathname`);

  const picked = JSON.parse(
    await api.eval(`(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let best = null;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = (node.textContent ?? '').trim();
      if (text.length < 120) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest('#logue-host')) continue;
      const box = parent.getBoundingClientRect();
      if (box.width < 40 || box.height < 8) continue;
      if (!best || text.length > best.length) best = { node, length: text.length };
    }
    if (!best) return JSON.stringify({ found: false });
    const range = document.createRange();
    range.setStart(best.node, 0);
    range.setEnd(best.node, Math.min(90, best.node.textContent.length));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    return JSON.stringify({ found: true, text: String(selection).slice(0, 60), length: best.length });
  })()`),
  );
  check("a real passage on a real page is selected", picked.found === true, JSON.stringify(picked));
  await api.sleep(1200);

  const bar = JSON.parse(
    await api.eval(`(() => {
    const host = document.getElementById('logue-host');
    const root = host?.shadowRoot;
    if (!root) return JSON.stringify({ mounted: false });
    const buttons = [...root.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim());
    return JSON.stringify({ mounted: true, surface: host.dataset.logueSurface ?? null, buttons });
  })()`),
  );
  check("the selection toolbar is what is showing", bar.surface === "selection", JSON.stringify(bar));

  // Which of the toolbar's buttons is a Skill is a fact the Host holds — so
  // ask it, rather than excluding the labels I happen to remember. Naming them
  // by exclusion picked "Write comment", which is a fixed action, and the
  // check then waited for an answer nobody had asked for.
  const skills = JSON.parse(
    await api.eval(`(async () => {
    const context = await fetch('${HOST}/v1/context?project=').then(r => r.json());
    return JSON.stringify((context.skills ?? [])
      .filter(s => s.enabled && (s.contexts ?? []).includes('selection'))
      .map(s => s.name));
  })()`),
  );
  const skillName = (bar.buttons ?? []).find((label) => skills.includes(label));
  check("the toolbar offers a Skill the Host knows", Boolean(skillName), `${skillName} of ${JSON.stringify(skills)}`);

  // Clear whatever a previous run left, so the thread we read afterwards is
  // this run's and not a leftover that would pass on its own.
  await api.goto(panelUrl);
  await api.sleep(1500);
  await api.eval(`chrome.storage.local.remove('logue:thread')`);
  await api.goto(`${HOST}/stream/${longest}`);
  await api.sleep(2500);
  await api.eval(`(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let best = null;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = (node.textContent ?? '').trim();
      if (text.length < 120) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest('#logue-host')) continue;
      if (!best || text.length > best.length) best = node;
    }
    if (!best) return 'none';
    const range = document.createRange();
    range.setStart(best, 0);
    range.setEnd(best, Math.min(90, best.textContent.length));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return String(selection).slice(0, 40);
  })()`);
  await api.sleep(1200);

  const clicked = await api.eval(`(() => {
    const root = document.getElementById('logue-host')?.shadowRoot;
    const button = [...(root?.querySelectorAll('button') ?? [])]
      .find(b => ((b.getAttribute('aria-label') || b.textContent || '').trim()) === ${JSON.stringify(skillName ?? "")});
    if (!button) return 'not found';
    button.click();
    return 'clicked';
  })()`);
  check("the Skill was pressed", clicked === "clicked", clicked);

  // Give the Host and the model their time, then read the two things that
  // matter: nothing new on the page, and something in the panel's thread.
  await api.sleep(9000);

  const page = JSON.parse(
    await api.eval(`(() => {
    const host = document.getElementById('logue-host');
    const root = host?.shadowRoot;
    const labels = [...(root?.querySelectorAll('button') ?? [])].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim());
    return JSON.stringify({
      surface: host?.dataset.logueSurface ?? null,
      // The on-page answer's own controls. If either is here, the answer
      // unfolded over the page after all.
      insert: labels.some(l => /^Insert/i.test(l)),
      sources: (root?.textContent ?? '').includes('Sources'),
    });
  })()`),
  );
  check("no answer unfolded over the page", page.insert === false && page.sources === false, JSON.stringify(page));
  // Choosing a Skill stands the toolbar down in the same commit — the run
  // lives in the panel (D3, restated by 2026-09-02's stacked column). This
  // used to be read into the log line and never enforced.
  check("choosing the Skill stood the toolbar down", page.surface !== "selection", JSON.stringify(page.surface));

  await api.goto(panelUrl);
  await api.sleep(2500);
  const thread = JSON.parse(
    await api.eval(`(async () => {
    const bag = await chrome.storage.local.get('logue:thread');
    const messages = bag['logue:thread'] ?? [];
    return JSON.stringify({
      count: messages.length,
      heading: messages[0]?.text ?? null,
      answer: (messages[1]?.text ?? '').slice(0, 120),
      answerLength: (messages[1]?.text ?? '').length,
    });
  })()`),
  );
  check("the answer went to the panel's thread", thread.count >= 2, JSON.stringify(thread));
  check(
    "…named as being about the passage that was selected",
    /passage you selected/i.test(String(thread.heading)),
    String(thread.heading),
  );
  check("…and it is a real answer, not an error", thread.answerLength > 40, thread.answer);

  const needle = String(thread.answer ?? "").slice(0, 40);
  const onScreen =
    needle.length < 20
      ? "no answer to look for"
      : await api.eval(`(() => document.body.innerText.includes(${JSON.stringify(needle)}))()`);
  // An empty needle is inside every string. This check used to pass on one.
  check(
    "…and the panel is showing it",
    needle.length >= 20 && (onScreen === "true" || onScreen === true),
    `${onScreen} (looking for ${JSON.stringify(needle)})`,
  );

  // -- D2 -----------------------------------------------------------------
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /This page/.test(b.textContent))?.click()`);
  await api.sleep(1500);

  const before = JSON.parse(
    await api.eval(`(() => {
    const rows = [...document.querySelectorAll('p')].filter(p => p.className.includes('line-clamp-2'));
    if (rows.length === 0) return JSON.stringify({ rows: 0 });
    rows[0].closest('button').click();
    return JSON.stringify({ rows: rows.length, text: rows[0].textContent });
  })()`),
  );
  check("a kept row opens", before.rows > 0, JSON.stringify(before));
  await api.sleep(900);

  const box = JSON.parse(
    await api.eval(`(() => {
    const area = document.querySelector('textarea');
    if (!area) return JSON.stringify({ present: false });
    const box = area.getBoundingClientRect();
    return JSON.stringify({ present: true, value: area.value.slice(0, 80), height: Math.round(box.height) });
  })()`),
  );
  check("the words are in an editable box", box.present === true, JSON.stringify(box));
  check(
    "…holding what the item actually says",
    box.present && before.text && box.value.startsWith(before.text.slice(0, 30)),
    `box "${box.value?.slice(0, 40)}" vs row "${String(before.text).slice(0, 40)}"`,
  );

  // Change it the way a person would, then leave the box — no button to find.
  const suffix = " [edited in the panel]";
  await api.eval(`(() => {
    const area = document.querySelector('textarea');
    // Focus first. blur() on an element that was never focused fires nothing,
    // so the save-on-leaving never ran and this read as a broken save.
    area.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, area.value + ${JSON.stringify(suffix)});
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.blur();
    return 'edited';
  })()`);
  await api.sleep(2500);

  // Read it back from the Host, which is the only place that proves it saved.
  const saved = JSON.parse(
    await api.eval(`(async () => {
    const reply = await fetch('${HOST}/v1/materials?limit=50').then(r => r.json());
    const hit = (reply.materials ?? []).find(m => (m.content ?? '').includes(${JSON.stringify(suffix)}));
    return JSON.stringify({ found: Boolean(hit), id: hit?.id ?? null, tail: (hit?.content ?? '').slice(-40) });
  })()`),
  );
  check("the edit reached the Host", saved.found === true, JSON.stringify(saved));

  // Put it back, because verification does not get to leave marks.
  if (saved.found) {
    await api.eval(`(async () => {
      const reply = await fetch('${HOST}/v1/materials/' + ${JSON.stringify(saved.id)}).then(r => r.json());
      const content = (reply.material.content ?? '').replace(${JSON.stringify(suffix)}, '');
      await fetch('${HOST}/v1/materials/' + ${JSON.stringify(saved.id)}, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }),
      });
      return 'restored';
    })()`);
    const restored = JSON.parse(
      await api.eval(`(async () => {
      const reply = await fetch('${HOST}/v1/materials/' + ${JSON.stringify(saved.id)}).then(r => r.json());
      return JSON.stringify({ clean: !(reply.material.content ?? '').includes(${JSON.stringify(suffix)}) });
    })()`),
    );
    check("…and the test put it back", restored.clean === true, JSON.stringify(restored));
  }

  console.log(`\nopened ${opened}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
