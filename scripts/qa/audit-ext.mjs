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

  // -- the panel, with real content in it --------------------------------
  await api.goto(panel);
  await api.sleep(3000);
  const panelState = await api.eval(`(() => {
    const box = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(box, 'what do my notes say about Logue?');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('button')].find(b => /^Ask$/.test(b.textContent.trim())).click();
    return 'asked';
  })()`);
  for (let i = 0; i < 40; i++) {
    await api.sleep(1000);
    if (await api.eval(`/stand-in|Sources/.test(document.body.textContent)`)) break;
  }
  const measured = await api.eval(`(${MEASURE})(document.body)`);
  console.log("PANEL (with a conversation in it):", JSON.stringify(measured, null, 1));

  // -- the injected overlays, on the app's own long document -------------
  const docId = await api.eval(`fetch('http://127.0.0.1:8787/v1/documents', { headers: { 'X-Logue-Client': 'extension' } }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => (x.content ?? '').length > 800); return (rich[0] ?? d.documents[0])?.id; })`);
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3000);
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
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
    const editor = document.querySelector('main [contenteditable="true"]');
    const target = [...editor.querySelectorAll('p')].find(p => p.textContent.trim().length > 40) ?? editor;
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  })()`);
  await api.sleep(2000);
  const selection = await api.eval(`(() => {
    const sr = document.getElementById('logue-host')?.shadowRoot;
    if (!sr) return 'no shadow root';
    return (${MEASURE})(sr);
  })()`);
  console.log("SELECTION BAR:", JSON.stringify(selection, null, 1));
}
