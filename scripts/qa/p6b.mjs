// P6b — "scroll to it" proved on a page that actually scrolls.
//
// P6 ran on Logue's own Stream page, where the saved passage sat near the top
// of a panel that does not scroll: it was on screen before the locate and on
// screen after, so the one thing the feature promises — *bringing* it on
// screen — was never exercised. That run said so out loud rather than
// pretending, which is why this file exists.
//
// So: a real article on the real web, long enough that a passage two thirds
// down is nowhere near the fold. Save it there, scroll back to the top, and
// assert three things in order — it was off screen, the page moved, and it
// ended up on screen and selected.
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const HOST = "http://127.0.0.1:8787";
// Real content, not a fixture: a long encyclopaedia article whose window is
// what scrolls. `?action=raw` is not used — the rendered page is the point.
const ARTICLE = process.env.LOGUE_TEST_PAGE ?? "https://en.wikipedia.org/wiki/Special_relativity";

export async function run(api) {
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  if (!worker) throw new Error("the extension's worker is not running");
  const panelUrl = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;

  await api.goto(ARTICLE);
  await api.sleep(4000);

  // The page has to be taller than a few screens or none of this means
  // anything. Said as a check, so a page that changed shape fails here rather
  // than quietly turning the rest into a no-op.
  const height = JSON.parse(
    await api.eval(`JSON.stringify({
      doc: Math.round(document.documentElement.scrollHeight),
      view: Math.round(window.innerHeight),
      title: document.title,
    })`),
  );
  check(
    "the page is several screens tall",
    height.doc > height.view * 4,
    `${height.doc}px over a ${height.view}px window — ${height.title}`,
  );

  // Pick a passage roughly two thirds down, scroll to it, and select it the
  // way a person reading there would.
  const picked = JSON.parse(
    await api.eval(`(() => {
      const target = document.documentElement.scrollHeight * 0.66;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let best = null, bestGap = Infinity;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = (node.textContent ?? '').trim();
        if (text.length < 220) continue;
        if (node.parentElement?.closest('#logue-host')) continue;
        const el = node.parentElement;
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const gap = Math.abs(top - target);
        if (gap < bestGap) { best = node; bestGap = gap; }
      }
      if (!best) return JSON.stringify({ found: false });
      best.parentElement.scrollIntoView({ block: 'center' });
      const from = Math.floor(best.textContent.length / 2);
      const range = document.createRange();
      range.setStart(best, from);
      range.setEnd(best, Math.min(from + 70, best.textContent.length));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return JSON.stringify({
        found: true,
        text: String(selection),
        atY: Math.round(best.parentElement.getBoundingClientRect().top + window.scrollY),
        scrolledTo: Math.round(window.scrollY),
      });
    })()`),
  );
  check("a real passage well down the page is selected", picked.found === true, JSON.stringify(picked).slice(0, 140));
  check(
    "…and it is far below the first screen",
    picked.atY > height.view * 2,
    `the passage starts at ${picked.atY}px, the window is ${height.view}px`,
  );
  await api.sleep(1500);

  const kept = await api.eval(`(() => {
    const root = document.getElementById('logue-host')?.shadowRoot;
    const save = [...(root?.querySelectorAll('button') ?? [])]
      .find(b => /^Save selection/i.test(b.getAttribute('aria-label') || b.textContent || ''));
    if (!save) return 'no save button';
    save.click();
    return 'saved';
  })()`);
  check("the toolbar kept it", kept === "saved", kept);
  await api.sleep(3000);

  // The panel drives the rest, with the article in its own tab — one tab
  // cannot do both, and P6 learned that the hard way.
  //
  // The Host is also asked from here rather than from the article: an https
  // page cannot fetch http://127.0.0.1 at all, and the first run of this file
  // reported the feature broken when what had happened was mixed content.
  await api.goto(panelUrl);
  await api.sleep(2000);

  const stored = JSON.parse(
    await api.eval(`(async () => {
      const reply = await fetch('${HOST}/v1/materials?limit=5').then(r => r.json());
      const mine = (reply.materials ?? []).find(m => m.kind === 'selection' && m.anchor?.exact);
      return JSON.stringify({ id: mine?.id ?? null, exact: mine?.anchor?.exact ?? '',
        url: mine?.source?.url ?? null });
    })()`),
  );
  check("the anchor reached the Host", Boolean(stored.id) && stored.exact.length > 10, JSON.stringify(stored).slice(0, 160));

  const tabId = Number(
    await api.eval(`(async () => {
      const tab = await chrome.tabs.create({ url: ${JSON.stringify(ARTICLE)}, active: true });
      await new Promise(r => setTimeout(r, 5000));
      return String(tab.id);
    })()`),
  );
  check("the article is open in its own tab", Number.isFinite(tabId) && tabId > 0, String(tabId));

  const inTab = async (fn, ...args) =>
    JSON.parse(
      await api.eval(`(async () => {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId: ${tabId} }, args: ${JSON.stringify(args)}, func: ${fn},
        });
        return r.result;
      })()`),
    );

  // Where the passage is, relative to the window, right now.
  const WHERE = `(exact) => {
    const loose = (s) => s.replace(/\\s+/g, ' ').trim();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!loose(node.textContent || '').includes(loose(exact))) continue;
      const box = node.parentElement?.getBoundingClientRect();
      if (!box) continue;
      return JSON.stringify({ found: true, top: Math.round(box.top),
        inView: box.top < window.innerHeight && box.bottom > 0,
        scrollY: Math.round(window.scrollY) });
    }
    return JSON.stringify({ found: false, scrollY: Math.round(window.scrollY) });
  }`;

  // Back to the very top — where the URL alone would have put you.
  await inTab(`() => { window.scrollTo(0, 0); return JSON.stringify({ scrollY: Math.round(window.scrollY) }); }`);
  await api.sleep(1200);

  const before = await inTab(WHERE, stored.exact);
  check("the passage is on the page", before.found === true, JSON.stringify(before));
  // This is the assertion P6 could not make. Without it, everything below
  // passes on a page that never had to move.
  check(
    "…and it is off screen before anyone asks for it",
    before.found === true && before.inView === false,
    `${before.top}px from the top of a window scrolled to ${before.scrollY}`,
  );

  const anchor = JSON.parse(
    await api.eval(`fetch('${HOST}/v1/materials/${stored.id}').then(r => r.json())
      .then(d => JSON.stringify(d.material.anchor ?? {}))`),
  );
  const located = JSON.parse(
    await api.eval(`(async () => {
      const answer = await chrome.tabs.sendMessage(${tabId}, { type: 'logue:locate', anchor: ${JSON.stringify(anchor)} })
        .catch((e) => ({ error: String(e) }));
      return JSON.stringify(answer ?? { error: 'no reply' });
    })()`),
  );
  check("the page finds it when asked", located.found === true, JSON.stringify(located));
  // `reveal` scrolls smoothly, so the movement is not instant.
  await api.sleep(2500);

  const after = await inTab(WHERE, stored.exact);
  check(
    "the page actually moved",
    after.scrollY > before.scrollY + 200,
    `scrolled from ${before.scrollY} to ${after.scrollY}`,
  );
  check("…and the passage is now on screen", after.inView === true, JSON.stringify(after));

  const selected = await inTab(`() => {
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0) return JSON.stringify({ selected: false });
    const box = selection.getRangeAt(0).getBoundingClientRect();
    return JSON.stringify({
      selected: String(selection).length > 0,
      text: String(selection).slice(0, 60),
      inView: box.top >= 0 && box.bottom <= window.innerHeight && box.height > 0,
      top: Math.round(box.top), windowHeight: window.innerHeight,
    });
  }`);
  check(
    "…and it is selected, fully inside the window",
    selected.selected === true && selected.inView === true,
    JSON.stringify(selected),
  );

  await api.eval(`chrome.tabs.remove(${tabId})`);
  console.log(`\n        the passage: "${stored.exact.slice(0, 70)}…"`);
  console.log(`        on ${stored.url}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
