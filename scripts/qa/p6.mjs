// P6 — a saved passage can be found again on the page it came from.
//
// The one thing in the v1 comparison with no equivalent at all: a quote saved
// from a long article was a needle with no way back to it. The URL takes you
// to the top and no further.
//
// Four states to prove, and the last two matter most because they are what
// happens when the web does what the web does: the page changes.
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const HOST = "http://127.0.0.1:8787";

export async function run(api) {
  // A real, long Source in Logue's own Stream — the page the owner asked
  // verification to prefer, and long enough that finding a line again matters.
  await api.goto(`${HOST}/stream`);
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  if (!worker) throw new Error("the extension's worker is not running");
  const panelUrl = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;

  const longest = await api.eval(`(async () => {
    const reply = await fetch('${HOST}/v1/materials?limit=200').then(r => r.json());
    const best = (reply.materials ?? []).filter(m => (m.content ?? '').length > 400)
      .sort((a, b) => b.content.length - a.content.length)[0];
    return best ? best.id : '';
  })()`);
  const pageUrl = `${HOST}/stream/${longest}`;
  await api.goto(pageUrl);
  await api.sleep(2500);

  // Select a real passage well down the page and keep it, the way a person does.
  const picked = JSON.parse(
    await api.eval(`(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let best = null;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!(node instanceof Text)) continue;
      const text = (node.textContent ?? '').trim();
      if (text.length < 200) continue;
      if (node.parentElement?.closest('#logue-host')) continue;
      if (!best || text.length > best.textContent.length) best = node;
    }
    if (!best) return JSON.stringify({ found: false });
    const range = document.createRange();
    // Somewhere in the middle, so scrolling to it is a real movement.
    const from = Math.floor(best.textContent.length / 2);
    range.setStart(best, from);
    range.setEnd(best, Math.min(from + 70, best.textContent.length));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return JSON.stringify({ found: true, text: String(selection) });
  })()`),
  );
  check("a real passage is selected", picked.found === true, JSON.stringify(picked).slice(0, 90));
  await api.sleep(1200);

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

  // The anchor reached the Host — three strings, not a CSS path.
  const stored = JSON.parse(
    await api.eval(`(async () => {
    const reply = await fetch('${HOST}/v1/materials?limit=5').then(r => r.json());
    const mine = (reply.materials ?? []).find(m => m.kind === 'selection' && m.anchor?.exact);
    return JSON.stringify({ id: mine?.id ?? null, exact: (mine?.anchor?.exact ?? '').slice(0, 40),
      before: (mine?.anchor?.before ?? '').slice(-24), after: (mine?.anchor?.after ?? '').slice(0, 24) });
  })()`),
  );
  check("the anchor was stored with it", Boolean(stored.id) && stored.exact.length > 10, JSON.stringify(stored));
  check("…and it remembers both neighbours", stored.before.length > 0 && stored.after.length > 0, JSON.stringify(stored));

  // Everything below runs from the panel, with the page open in a second tab.
  //
  // One tab cannot do this: navigating it to the panel closes the page the
  // panel would be asking about, and the first attempt did exactly that and
  // reported "the page is not open" as though the feature were broken.
  await api.goto(panelUrl);
  await api.sleep(2000);
  const tabId = Number(
    await api.eval(`(async () => {
    const tab = await chrome.tabs.create({ url: ${JSON.stringify(pageUrl)}, active: true });
    await new Promise(r => setTimeout(r, 3500));
    return String(tab.id);
  })()`),
  );
  check("the page is open in its own tab", Number.isFinite(tabId) && tabId > 0, String(tabId));

  const askPage = async (message) =>
    JSON.parse(
      await api.eval(`(async () => {
      const answer = await chrome.tabs.sendMessage(${tabId}, ${JSON.stringify(message)})
        .catch((e) => ({ error: String(e) }));
      return JSON.stringify(answer ?? { error: 'no reply' });
    })()`),
    );

  const anchorNow = async () =>
    JSON.parse(
      await api.eval(`fetch('${HOST}/v1/materials/${stored.id}').then(r => r.json())
        .then(d => JSON.stringify(d.material.anchor ?? {}))`),
    );

  // -- state 1: anchored, and findable -------------------------------------
  const scrolled = async () =>
    Number(
      await api.eval(`(async () => {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: ${tabId} }, func: () => {
        // Whatever is actually scrolled — this app scrolls a panel, not the window.
        let most = Math.round(window.scrollY);
        for (const el of document.querySelectorAll('*')) most = Math.max(most, Math.round(el.scrollTop));
        return most;
      } });
      return String(r.result);
    })()`),
    );
  // To the very bottom, not the top: the passage sits near the top of this
  // page, so starting there proved nothing — it was already on screen and no
  // scroll was ever needed. From the bottom, being on screen means it moved.
  await api.eval(`chrome.scripting.executeScript({ target: { tabId: ${tabId} }, func: () => {
    window.scrollTo(0, document.body.scrollHeight);
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = el.scrollHeight;
    }
  } })`);
  await api.sleep(800);
  const wasAt = await scrolled();

  // Where the passage sits relative to the viewport, before and after. The
  // scroll offset was the wrong thing to measure: this page has several
  // scrollable panels and the largest offset belonged to one that never moved,
  // which hid the fact that the right one had.
  const whereIsIt = async (exact) =>
    JSON.parse(
      await api.eval(
        `(async () => {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: ${tabId} }, args: [${JSON.stringify(exact)}],
        func: (exact) => {
          const loose = (s) => s.replace(/\\s+/g, ' ').trim();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!loose(node.textContent || '').includes(loose(exact))) continue;
            const el = node.parentElement;
            if (!el) continue;
            const box = el.getBoundingClientRect();
            return JSON.stringify({ found: true, top: Math.round(box.top),
              inView: box.top < window.innerHeight && box.bottom > 0 });
          }
          return JSON.stringify({ found: false });
        },
      });
      return r.result;
    })()`,
      ),
    );

  const anchorForFind = await anchorNow();
  const beforeFinding = await whereIsIt(anchorForFind.exact);
  const located = await askPage({ type: "logue:locate", anchor: anchorForFind });
  check("the page can be asked where it is, and finds it", located.found === true, JSON.stringify(located));
  // `exactly` says whether the quote appears once. On this page it appears
  // twice — the Source's own text is rendered more than once — so asserting
  // "only copy" would be asserting a fact about the fixture. What matters is
  // that it says which, and that the neighbours picked the right one.
  console.log(`        (the quote appears ${located.exactly ? "once" : "more than once"} on this page)`);
  await api.sleep(2000);
  // The promise is "bring it on screen", not "move the page" — if the passage
  // was already visible no scroll is needed and none should be demanded. So
  // the assertion is where it ended up, measured against the viewport.
  const onScreen = JSON.parse(
    await api.eval(`(async () => {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: ${tabId} }, func: () => {
      const selection = getSelection();
      if (!selection || selection.rangeCount === 0) return JSON.stringify({ selected: false });
      const box = selection.getRangeAt(0).getBoundingClientRect();
      return JSON.stringify({
        selected: String(selection).length > 0,
        inView: box.top >= 0 && box.bottom <= window.innerHeight && box.height > 0,
        top: Math.round(box.top), windowHeight: window.innerHeight,
      });
    } });
    return r.result;
  })()`),
  );
  check("…and the passage ends up on screen, selected", onScreen.selected === true && onScreen.inView === true,
    JSON.stringify(onScreen));
  // Only assert the scroll when there was a scroll to make. On this page the
  // passage sits near the top of a panel that does not scroll, so it is on
  // screen however far the page is scrolled — demanding movement there would
  // be demanding it of the fixture, not the feature. Said out loud rather than
  // quietly skipped.
  if (beforeFinding.inView === false) {
    check("…having been off screen a moment earlier", true, JSON.stringify(beforeFinding));
  } else {
    console.log(
      `        (not proved here: the passage is at ${beforeFinding.top}px with the page scrolled to ${wasAt}, so it was ` +
        `never off screen. Scrolling to it is covered by scrollIntoView, not by this run.)`,
    );
  }

  // -- state 2: the page changed -------------------------------------------
  const anchor = await anchorNow();
  const removed = JSON.parse(
    await api.eval(`(async () => {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: ${tabId} },
      args: [${JSON.stringify(anchor.exact)}],
      func: (exact) => {
        const loose = (s) => s.replace(/\s+/g, ' ').trim();
        let hits = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (loose(node.textContent || '').includes(loose(exact))) {
            node.nodeValue = 'THIS PARAGRAPH WAS REWRITTEN BY SOMEONE ELSE.';
            hits += 1;
          }
        }
        // Every copy. Removing only the first left the second one findable,
        // and the check reported a passage that was still there as a bug.
        return hits;
      },
    });
    return JSON.stringify({ removed: (r.result ?? 0) > 0, copies: r.result ?? 0 });
  })()`),
  );
  check("the passage was taken off the page", removed.removed === true, JSON.stringify(removed));

  const missing = await askPage({ type: "logue:locate", anchor });
  check("a passage that is gone is reported gone, not guessed at", missing.found === false, JSON.stringify(missing));

  // -- state 3: re-anchored -------------------------------------------------
  await api.eval(`chrome.scripting.executeScript({
    target: { tabId: ${tabId} },
    func: () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let best = null;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if ((node.textContent || '').trim().length < 120) continue;
        if (node.parentElement && node.parentElement.closest('#logue-host')) continue;
        if (!best || node.textContent.length > best.textContent.length) best = node;
      }
      if (!best) return false;
      const range = document.createRange();
      range.setStart(best, 0);
      range.setEnd(best, 60);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    },
  })`);
  await api.sleep(1000);

  const fresh = await askPage({ type: "logue:anchor-here" });
  check("the page hands back an anchor for what is selected now", Boolean(fresh.anchor?.exact), JSON.stringify(fresh).slice(0, 120));

  const repaired = JSON.parse(
    await api.eval(`(async () => {
    const fresh = await chrome.tabs.sendMessage(${tabId}, { type: 'logue:anchor-here' }).catch(() => undefined);
    const saved = await fetch('${HOST}/v1/materials/${stored.id}', {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'X-Logue-Client': 'web' },
      body: JSON.stringify({ anchor: { ...fresh.anchor, reanchored_at: new Date().toISOString() } }),
    }).then(r => r.json());
    const again = await chrome.tabs.sendMessage(${tabId}, { type: 'logue:locate', anchor: saved.material.anchor })
      .catch(() => ({ found: false }));
    return JSON.stringify({ reanchored: Boolean(saved.material.anchor?.reanchored_at), findable: again.found });
  })()`),
  );
  check("a new selection repairs the pointer", repaired.reanchored === true, JSON.stringify(repaired));
  check("…and the repaired pointer finds it", repaired.findable === true, JSON.stringify(repaired));

  // -- state 4: snapshot only ------------------------------------------------
  const snapshot = JSON.parse(
    await api.eval(`(async () => {
    const reply = await fetch('${HOST}/v1/materials/${stored.id}').then(r => r.json());
    const saved = await fetch('${HOST}/v1/materials/${stored.id}', {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'X-Logue-Client': 'web' },
      body: JSON.stringify({ anchor: { ...reply.material.anchor, snapshot_only: true } }),
    }).then(r => r.json());
    return JSON.stringify({ snapshotOnly: saved.material.anchor?.snapshot_only === true,
      wordsStillThere: (saved.material.content ?? '').length > 10,
      url: saved.material.source?.url ?? null });
  })()`),
  );
  check("keeping the snapshot is a state, not a failure", snapshot.snapshotOnly === true, JSON.stringify(snapshot));
  check("…and the words are still in the Source either way", snapshot.wordsStillThere === true, JSON.stringify(snapshot));
  // The origin was never rewritten — the whole reason the anchor is its own field.
  check("the origin was never touched by any of this", snapshot.url === pageUrl, String(snapshot.url));

  await api.eval(`chrome.tabs.remove(${tabId})`);
  console.log(`\n        the passage: "${stored.exact}…"`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
