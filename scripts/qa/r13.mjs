// R13 — a Source that has been overruled says so, everywhere it is read.
//
// The model notices the contradiction (a person cannot: nobody remembers what
// a Source from three months ago said) and proposes. Nothing is marked out of
// date until someone agrees. This checks the reading end: the page, and the
// citation.
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const HOST = "http://127.0.0.1:8787";

export async function run(api) {
  await api.goto(`${HOST}/stream`);
  await api.sleep(2000);

  // A real pair: one Source that raises a limit, and the earlier one it
  // overrules. Made here rather than assumed, so the check stands alone.
  const pair = JSON.parse(
    await api.eval(`(async () => {
    const post = (body) => fetch('${HOST}/v1/materials', { method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify(body) })
      .then(r => r.json()).then(d => d.material);
    const old = await post({ kind: 'text', content: 'The review queue shows at most twenty Sources at a time.' });
    await new Promise(r => setTimeout(r, 1200));
    const now = await post({ kind: 'text', content: 'The review queue limit changed: it shows fifty Sources at a time now, not twenty.' });
    const filed = await fetch('${HOST}/v1/materials/' + now.id + '/organize', { method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Logue-Client': 'web' }, body: '{}' })
      .then(r => r.json()).then(d => d.material);
    return JSON.stringify({ old: old.id, now: now.id, proposed: filed.organization?.supersedes ?? null });
  })()`),
  );
  check("the model proposed a replacement", Boolean(pair.proposed), JSON.stringify(pair.proposed));
  check("…pointing at the earlier Source", pair.proposed?.id === pair.old, `${pair.proposed?.id} vs ${pair.old}`);

  // The proposal is visible, and it is its own decision.
  await api.goto(`${HOST}/stream/${pair.now}`);
  await api.sleep(2500);
  const card = JSON.parse(
    await api.eval(`(() => {
    const main = document.querySelector('main');
    const text = main.innerText;
    const buttons = [...main.querySelectorAll('button')].map(b => b.textContent.trim());
    return JSON.stringify({
      saysSo: /replaces an earlier Source/i.test(text),
      hasItsOwnButton: buttons.some(b => /Mark the older one out of date/i.test(b)),
      canReadTheOlder: buttons.some(b => /Read the older one/i.test(b)),
    });
  })()`),
  );
  check("the proposal is on the page in words", card.saysSo === true, JSON.stringify(card));
  check("…with its own button, separate from filing", card.hasItsOwnButton === true, JSON.stringify(card));
  check("…and a way to read the older one first", card.canReadTheOlder === true, JSON.stringify(card));

  const before = JSON.parse(
    await api.eval(`fetch('${HOST}/v1/materials/${pair.old}').then(r => r.json())
      .then(d => JSON.stringify({ marked: Boolean(d.material.superseded_by) }))`),
  );
  check("nothing is marked out of date before anyone agrees", before.marked === false, JSON.stringify(before));

  // Agree, the way the page does.
  await api.eval(`[...document.querySelectorAll('main button')].find(b => /Mark the older one out of date/i.test(b.textContent)).click()`);
  await api.sleep(3000);

  // The reading end: the older Source's own page.
  await api.goto(`${HOST}/stream/${pair.old}`);
  await api.sleep(2500);
  const older = JSON.parse(
    await api.eval(`(() => {
    const main = document.querySelector('main');
    const body = [...main.querySelectorAll('p')].find(p => /twenty Sources/.test(p.textContent));
    return JSON.stringify({
      saysOutOfDate: /Out of date/i.test(main.innerText),
      givesTheReason: /twenty/i.test(main.innerText) && /fifty|changed/i.test(main.innerText),
      wayToTheNewOne: [...main.querySelectorAll('button')].some(b => /Open the one that replaced it/i.test(b.textContent)),
      stillReadable: Boolean(body),
      dimmed: body ? getComputedStyle(body).color : null,
    });
  })()`),
  );
  check("the older Source says it is out of date", older.saysOutOfDate === true, JSON.stringify(older));
  check("…and offers the one that replaced it", older.wayToTheNewOne === true, String(older.wayToTheNewOne));
  check("…while its words are still there to read", older.stillReadable === true, `colour ${older.dimmed}`);

  // Following it lands on the newer Source.
  await api.eval(`[...document.querySelectorAll('main button')].find(b => /Open the one that replaced it/i.test(b.textContent)).click()`);
  await api.sleep(2500);
  const landed = await api.eval(`document.location.pathname`);
  check("following it lands on the newer Source", landed.endsWith(pair.now), `${landed} vs ${pair.now}`);

  // And the Host holds both ends.
  const ends = JSON.parse(
    await api.eval(`(async () => {
    const older = await fetch('${HOST}/v1/materials/${pair.old}').then(r => r.json());
    const newer = await fetch('${HOST}/v1/materials/${pair.now}').then(r => r.json());
    return JSON.stringify({
      forward: older.material.superseded_by?.id ?? null,
      back: newer.material.supersedes ?? [],
      wordsKept: (older.material.content ?? '').includes('twenty'),
    });
  })()`),
  );
  check("both ends point at each other", ends.forward === pair.now && ends.back.includes(pair.old), JSON.stringify(ends));
  check("the old Source was not edited, only marked", ends.wordsKept === true, String(ends.wordsKept));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
