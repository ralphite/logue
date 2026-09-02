/**
 * The page list and the page, measured against Notion's own numbers.
 *
 * Every figure in NOTION was read off app.notion.com on 2026-08-19, in his
 * signed-in browser, at a 1733px window: the sidebar row, the page column and
 * the type scale. This check is what keeps them true.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/notion-shape.mjs
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";
/** A page with a title, three heading levels, bullets and a numbered list. */
const DOC = process.env.LOGUE_DOC;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

export async function run(api) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });
  await api.send("Emulation.setDeviceMetricsOverride", { width: 1733, height: 950, deviceScaleFactor: 1, mobile: false });

  // -- the list ----------------------------------------------------------
  await api.goto(`${HOST}/documents`);
  await api.sleep(3000);
  const rows = JSON.parse(await api.eval(`(() => {
    const found = [...document.querySelectorAll('main button[aria-current], main button')].filter((b) => b.querySelector('svg') && b.offsetWidth > 200);
    const shape = found.slice(0, 12).map((row) => {
      const r = row.getBoundingClientRect();
      const cs = getComputedStyle(row);
      const svg = row.querySelector('svg');
      // The deepest span with words in it: the outer one is a flex wrapper
      // whose font is whatever it inherited, and reading that reported the
      // row as 13px/400 while the name on screen was 14px/500.
      const name = [...row.querySelectorAll('span')].filter((s) => s.textContent.trim() && !s.querySelector('span')).at(0);
      const nc = name && getComputedStyle(name);
      return {
        h: Math.round(r.height), top: Math.round(r.top), radius: cs.borderTopLeftRadius,
        icon: svg ? Math.round(svg.getBoundingClientRect().left - r.left) : null,
        iconSize: svg ? Math.round(svg.getBoundingClientRect().width) : null,
        name: name ? Math.round(name.getBoundingClientRect().left - r.left) : null,
        font: nc ? nc.fontSize + '/' + nc.lineHeight + '/' + nc.fontWeight : null,
        border: cs.borderBottomWidth,
      };
    });
    return JSON.stringify(shape);
  })()`));
  const first = rows[0];
  check("a page row is 30px tall with a 6px corner", first.h === 30 && first.radius === "6px", `${first.h}px / ${first.radius}`);
  check("…and no rule under it", first.border === "0px", first.border);
  check("its glyph is 12px, 13px in", first.iconSize === 12 && first.icon === 13, `${first.iconSize}px at ${first.icon}`);
  check("its name sits 38px in, at 14px/500", first.name === 38 && first.font === "14px/21px/500", `${first.name}px ${first.font}`);
  const pitch = rows[1] ? rows[1].top - rows[0].top : 0;
  check("rows are 31px apart", pitch === 31, `${pitch}px`);
  const steps = rows.map((r) => r.icon).filter((x, i, all) => i === 0 || x !== all[i - 1]);
  const indents = [...new Set(rows.map((r) => r.icon))].toSorted((a, b) => a - b);
  const step = indents.length > 1 ? indents[1] - indents[0] : 8;
  check("a page inside a page is 8px further in", step === 8, `${step}px (${indents.join(", ")}) ${steps.length}`);

  // -- the page ----------------------------------------------------------
  // A document that holds everything asserted below: a heading, a real
  // paragraph — one that follows a blank line, because a plain line right
  // under a list item is that item's continuation now and wears the item's
  // paint, which is how a lists-only fixture stopped having any "paragraph"
  // line at all and this check went red on it — and a first line that is
  // NOT itself a `#` heading, because the title row this check measures is
  // the plain first line; a document opening on `# Name` renders an
  // h1 there instead, which is how a fixture went red on 2026-09-02.
  const docId = DOC ?? (await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => (d.documents.find(x => !/^#/.test(x.content ?? '') && /^#{1,3}\\s/m.test(x.content ?? '') && /\\n\\n[^\\s#>*+\\d\`|![-]/.test(x.content ?? '')) ?? d.documents[0])?.id)`));
  await api.goto(`${HOST}/documents/${docId}`);
  await api.sleep(3200);
  const page = JSON.parse(await api.eval(`(() => {
    const content = document.querySelector('main .cm-content');
    const box = content.getBoundingClientRect();
    const of = {};
    for (const line of content.querySelectorAll('.cm-line')) {
      const kind = line.className.replace('cm-line', '').trim() || (line.textContent.trim() ? 'paragraph' : 'blank');
      if (of[kind]) continue;
      const cs = getComputedStyle(line);
      // A heading's size lives on the span the highlighter made; everything
      // else is the line's own. Reading the longest span for a paragraph
      // reported whichever run happened to be bold.
      // The biggest span on the line: the first one is the hidden hash mark,
      // which is still 16px and reported every heading as body text.
      const head = /^cm-h[123]-line$/.test(kind)
        ? [...line.querySelectorAll('span')]
            .map((s) => getComputedStyle(s))
            .toSorted((a, b) => Number.parseFloat(b.fontSize) - Number.parseFloat(a.fontSize))[0]
        : null;
      const fc = head ?? cs;
      of[kind] = {
        h: Math.round(line.getBoundingClientRect().height),
        pad: Math.round(Number.parseFloat(cs.paddingTop)),
        font: fc.fontSize + '/' + fc.lineHeight + '/' + fc.fontWeight,
      };
    }
    const middle = Math.round(box.left + box.width / 2);
    // The pane the page is centred in is the one that scrolls it, not the
    // application's whole main — which includes the list and put the centre
    // 244px out.
    const pane = (content.closest('.logue-scroll') ?? content.parentElement).getBoundingClientRect();
    return JSON.stringify({ width: Math.round(box.width), offCentre: Math.abs(middle - Math.round(pane.left + pane.width / 2)), lines: of });
  })()`));
  check("the page is a 720px column", page.width === 720, `${page.width}px`);
  check("…centred in the pane", page.offCentre <= 2, `${page.offCentre}px off`);
  const has = (kind, font, pad) =>
    check(`${kind} is Notion's`, page.lines[kind]?.font === font && (pad === undefined || page.lines[kind]?.pad === pad),
      JSON.stringify(page.lines[kind]));
  has("cm-title-line", "40px/48px/700");
  has("paragraph", "16px/24px/400");
  has("cm-blank-line", "16px/16px/400");
  if (page.lines["cm-h1-line"]) has("cm-h1-line", "30px/39px/600", 24);
  if (page.lines["cm-h2-line"]) has("cm-h2-line", "24px/31.2px/600", 20);
  if (page.lines["cm-h3-line"]) has("cm-h3-line", "20px/26px/600", 16);

  await api.screenshot(`${OUT}/notion-shape.png`);
  await api.send("Emulation.clearDeviceMetricsOverride");
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed) throw new Error(`${failed} off Notion's numbers`);
}
