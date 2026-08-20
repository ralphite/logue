/**
 * Every piece of text on a route, measured against what is actually behind it.
 *
 *   LOGUE_ROUTES=stream,projects node scripts/qa/cdp.mjs 9899 ./scripts/qa/contrast.mjs
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const ROUTES = (process.env.LOGUE_ROUTES ?? "stream,projects,documents,skills,settings").split(",");

const SCAN = `(() => {
  // Any CSS colour, resolved to rgba. Reading the numbers out of the string
  // works for rgb() and lies about everything else: Tailwind emits oklab for a
  // colour with opacity, and "oklab(0.98 -0.0007 0.0025 / .95)" parsed as rgb
  // is near-black — which reported the sticky day header as failing contrast
  // against a background it does not have.
  const ink = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    ink.clearRect(0, 0, 1, 1);
    ink.fillStyle = '#000';
    ink.fillStyle = c;
    ink.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ink.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const behind = (el) => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg.a > 0) acc = acc ? over(acc, bg) : bg;
      if (acc && acc.a >= 1) return acc;
      node = node.parentElement;
    }
    return acc && acc.a >= 1 ? acc : { r: 255, g: 255, b: 255, a: 1 };
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    const text = (el.textContent ?? '').trim();
    if (!text) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const fg = parse(cs.color);
    const bg = behind(el);
    const r = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (r < need) out.push({ text: text.slice(0, 42), ratio: Math.round(r * 100) / 100, need, size, weight, color: cs.color, bg: \`rgb(\${Math.round(bg.r)}, \${Math.round(bg.g)}, \${Math.round(bg.b)})\`, tag: el.tagName });
  }
  const seen = new Set();
  return JSON.stringify(out.filter((x) => { const k = x.color + x.bg + x.size; if (seen.has(k)) return false; seen.add(k); return true; }));
})()`;

export async function run(api) {
  for (const route of ROUTES) {
    await api.goto(`${HOST}/${route}`);
    await api.sleep(2600);
    const found = JSON.parse(await api.eval(SCAN));
    console.log(`\n=== /${route} — ${found.length} under the bar`);
    for (const f of found) console.log(`  ${f.ratio} (needs ${f.need})  ${f.size}px/${f.weight}  ${f.color} on ${f.bg}  "${f.text}"`);
  }
}
