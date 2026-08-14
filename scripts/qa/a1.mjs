// A1 — the panel audited the way the web routes were: computed styles, real
// content. Not "looks fine".
//
// It used to walk three tabs. The panel is one list and one composer now
// (N13), so there is one surface to measure — and it is measured with
// something in it, because an empty panel measures its empty state.
export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  const panel = `chrome-extension://${new URL(w.url).host}/sidepanel.html`;

  const MEASURE = `(() => {
    const sizes = {}, weights = {}, colours = {};
    const small = [], unlabelled = [];
    // The body only: <title> lives in the head, is never drawn, and counting
    // it reported the browser's 16px black as a defect in the panel.
    for (const el of document.body.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      if (el.children.length === 0 && (el.textContent ?? '').trim() && el.tagName !== 'STYLE') {
        sizes[style.fontSize] = (sizes[style.fontSize] ?? 0) + 1;
        weights[style.fontWeight] = (weights[style.fontWeight] ?? 0) + 1;
        colours[style.color] = (colours[style.color] ?? 0) + 1;
      }
      const clickable = ['BUTTON','A','SELECT','INPUT','TEXTAREA'].includes(el.tagName) || el.getAttribute('role') === 'button';
      if (clickable) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.height < 24) small.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0,28) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        const named = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (!named) unlabelled.push(el.tagName + '.' + (el.className || '').split(' ')[0]);
      }
    }
    return { sizes, weights, colours, small, unlabelled,
      wide: document.documentElement.scrollWidth > window.innerWidth + 1,
      headings: [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName + ':' + getComputedStyle(h).fontSize + '/' + getComputedStyle(h).fontWeight),
      landmarks: { header: document.querySelectorAll('header').length, tablist: document.querySelectorAll('[role="tablist"]').length, h1: document.querySelectorAll('h1').length },
    };
  })()`;

  await api.goto(panel);
  await api.sleep(2500);
  // Something in the box and something in the list: a panel measured empty is
  // a measurement of its empty state.
  await api.eval(`(() => {
    const box = document.querySelector('textarea[aria-label="What to send"]');
    if (!box) return 'no composer';
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, 'A1 audit — something in the box, so the control states are the ones in use.');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`);
  await api.sleep(600);
  console.log("\n── the panel ──");
  console.log(JSON.stringify(await api.eval(MEASURE), null, 1));
}
