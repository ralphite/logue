/**
 * The selection toolbar: does it land on the thing it acts on, and can its
 * Skill names be read?
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/bar-anchor.mjs
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const SR = `document.getElementById('logue-host').shadowRoot`;
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";

export async function run(api) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });
  await api.goto(`${HOST}/stream`);
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => (x.content ?? '').length > 800); return (rich[0] ?? d.documents[0])?.id; })`);
  await api.goto(`${HOST}/documents/${docId}`);
  await api.sleep(3000);

  // pick a paragraph that is NOT at the top of the viewport
  console.log(await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    const ps = [...editor.querySelectorAll('p, div, li, h1, h2, h3')].filter((p) => !p.querySelector('p, div, li') && p.textContent.trim().length > 40);
    const target = ps.find((p) => p.getBoundingClientRect().top > 300) ?? ps[0];
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const r = target.getBoundingClientRect();
    return 'selected at top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom);
  })()`));
  await api.sleep(2500);
  const read = JSON.parse(await api.eval(`(() => {
    const sr = ${SR};
    const bar = sr.querySelector('[aria-label="Selection actions"]');
    const s = getSelection().getRangeAt(0).getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return JSON.stringify({
      selection: { t: Math.round(s.top), b: Math.round(s.bottom), l: Math.round(s.left), r: Math.round(s.right) },
      bar: { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) },
      gapAbove: Math.round(s.top - b.bottom),
      // A Skill name cut mid-word on a surface that disappears when you move
      // is a name nobody can read. Cut is measurable: the text is wider than
      // the box holding it.
      cut: [...bar.querySelectorAll('span')].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.trim()),
    });
  })()`));
  console.log(JSON.stringify(read));
  const centred = Math.abs((read.bar.l + read.bar.r) / 2 - (read.selection.l + read.selection.r) / 2) < 12;
  const ok = read.gapAbove >= 0 && read.gapAbove <= 20 && centred && read.cut.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"} the toolbar sits on the selection, with names you can read`);
  await api.screenshot(`${OUT}/bar-anchor.png`);
  if (!ok) throw new Error("selection toolbar misplaced or truncated");
}
