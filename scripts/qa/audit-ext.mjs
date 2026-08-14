// T1's other half: the Side Panel and the injected overlays, measured the way
// the web routes were — computed styles on real content, not eyeballed.
const MEASURE = `(root => {
  const sizes = {}, weights = {}, colours = {};
  const small = [];
  const walk = root.querySelectorAll('*');
  for (const el of walk) {
    const style = getComputedStyle(el);
    if (el.children.length === 0 && el.textContent.trim()) {
      sizes[style.fontSize] = (sizes[style.fontSize] ?? 0) + 1;
      weights[style.fontWeight] = (weights[style.fontWeight] ?? 0) + 1;
      colours[style.color] = (colours[style.color] ?? 0) + 1;
    }
    const clickable = el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT' ||
      el.getAttribute('role') === 'button' || el.tagName === 'INPUT';
    if (clickable) {
      const box = el.getBoundingClientRect();
      if (box.height > 0 && box.height < 24) {
        small.push((el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24) || el.tagName) +
          ' ' + Math.round(box.width) + 'x' + Math.round(box.height));
      }
    }
  }
  const headings = [...root.querySelectorAll('h1,h2,h3')].map(h =>
    h.tagName + ':' + getComputedStyle(h).fontSize + '/' + getComputedStyle(h).fontWeight + ' ' + h.textContent.trim().slice(0, 24));
  return { sizes, weights, colours, small, headings, wide: root.scrollWidth > root.clientWidth + 1 };
})`;

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  const panel = `chrome-extension://${new URL(worker.url).host}/sidepanel.html`;

  // -- the panel, every tab, with real content in it ----------------------
  //
  // Every tab, not the one that happens to be showing. This script measured
  // whichever tab opened by default; when the panel gained Dictation and
  // opened on it, the first line — `document.querySelector('textarea')` —
  // came back null and the whole audit died on "Illegal invocation". A panel
  // that grows a surface has to grow the audit with it, or the new surface is
  // the one nobody ever measured.
  await api.goto(panel);
  await api.sleep(3000);

  // Something in the box and something in the list, so what is measured is
  // the panel in use rather than its empty state. One surface now (N13): the
  // tabs this audit used to walk are gone, and with them the tab-by-tab
  // comparison — a font size that exists on one tab and nowhere else was the
  // inconsistency it was looking for, and there is only one tab left.
  await api.eval(`(() => {
    const box = document.querySelector('textarea[aria-label="What to send"]');
    if (!box) return 'no composer';
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, 'audit-ext — the panel with something in it.');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`);
  await api.sleep(800);

  const panelSeen = JSON.parse(await api.eval(`JSON.stringify((${MEASURE})(document.body))`));
  console.log("PANEL:", JSON.stringify(panelSeen, null, 1));
  console.log("\nACROSS THE PANEL");
  console.log("  font sizes in use:", Object.keys(panelSeen.sizes ?? {}).sort().join(", "));
  console.log(
    "  click targets under 24px:",
    (panelSeen.small ?? []).length ? (panelSeen.small ?? []).join(" | ") : "none",
  );

  // -- the injected overlays, on the app's own long document -------------
  const docId = await api.eval(`fetch('http://127.0.0.1:8787/v1/documents', { headers: { 'X-Logue-Client': 'extension' } }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => (x.content ?? '').length > 800); return (rich[0] ?? d.documents[0])?.id; })`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);
  await api.eval(`(() => {
    // The editor is CodeMirror now (F2): its editable element is .cm-content.
    const editor = document.querySelector('main .cm-content');
    if (!editor) return 'no editor';
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    return 'placed';
  })()`);
  await api.sleep(2500);
  const bar = await api.eval(`(() => {
    const sr = document.getElementById('logue-host')?.shadowRoot;
    if (!sr) return 'no shadow root';
    return (${MEASURE})(sr);
  })()`);
  console.log("VOICE BAR:", JSON.stringify(bar, null, 1));

  // Selection: the toolbar over a real paragraph.
  await api.eval(`(() => {
    const editor = document.querySelector('main .cm-content');
    if (!editor) return 'no editor';
    const target = [...editor.querySelectorAll('.cm-line')].find((l) => l.textContent.trim().length > 40) ?? editor;
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return 'selected';
  })()`);
  await api.sleep(2000);
  const selection = await api.eval(`(() => {
    const sr = document.getElementById('logue-host')?.shadowRoot;
    if (!sr) return 'no shadow root';
    return (${MEASURE})(sr);
  })()`);
  console.log("SELECTION BAR:", JSON.stringify(selection, null, 1));
}
