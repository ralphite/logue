/** Where the injected bar lands on a real chat composer. */
const SR = `document.getElementById('logue-host')?.shadowRoot`;
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";

const measure = `(() => {
  const sr = ${SR};
  if (!sr) return JSON.stringify({ error: 'no logue host' });
  const bar = [...sr.querySelectorAll('*')].find((e) => e.getAttribute && /^Logue /.test(e.getAttribute('aria-label') || ''));
  const field = document.activeElement;
  const r = bar && bar.getBoundingClientRect();
  const f = field && field.getBoundingClientRect ? field.getBoundingClientRect() : null;
  const box = (x) => x && { l: Math.round(x.left), t: Math.round(x.top), r: Math.round(x.right), b: Math.round(x.bottom) };
  const overlap = r && f && !(r.right < f.left || r.left > f.right || r.bottom < f.top || r.top > f.bottom);
  return JSON.stringify({
    bar: bar ? bar.getAttribute('aria-label') : null,
    barBox: box(r), field: field?.tagName + (field?.className ? '.' + String(field.className).split(' ')[0] : ''),
    fieldBox: box(f), overlapsField: overlap,
  });
})()`;

export async function run(api) {
  const url = process.env.PROBE_URL ?? "https://chatgpt.com/";
  await api.goto(url);
  await api.sleep(6000);
  // Put the caret in the page's own composer, the way a person would.
  console.log(await api.eval(`(() => {
    const box = document.querySelector('#prompt-textarea, .ql-editor, textarea, [contenteditable="true"]');
    if (!box) return 'no composer';
    box.focus();
    if (box.tagName === 'TEXTAREA') box.setSelectionRange(0, 0);
    return 'focused ' + box.tagName;
  })()`));
  await api.sleep(2500);
  console.log(await api.eval(measure));
  await api.screenshot(`${OUT}/probe-${new URL(url).hostname}.png`);
}
