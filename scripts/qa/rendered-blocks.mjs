/**
 * Rendered blocks, at Notion's numbers.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/rendered-blocks.mjs
 *
 * Every expected value was measured on app.notion.com on 2026-08-19, in his
 * signed-in browser — see docs/spec/features/rendered-blocks.md. The check
 * writes its own fixture document, titled to say it is disposable, and
 * rewrites that one document on every run; it never touches anything else.
 * Assertions read the words, not the boxes around them, and every read names
 * the element the claim is about — the fidelity review found two here that
 * could never fail and one that read the wrong fence.
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";
const HEADERS = `{ 'X-Logue-Client': 'web', 'Content-Type': 'application/json' }`;

const TITLE = "QA rendered blocks (safe to delete)";
const FIXTURE = [
  TITLE,
  "",
  "A body paragraph with `inline code` in it.",
  "",
  "- one item",
  "- two items",
  "",
  "> 引用块 quote words stay ink",
  ">",
  "> after a bare quote line",
  "",
  "```js",
  "const answer = 42",
  "- looks like a list",
  " * jsdoc continuation",
  "",
  "[Source 9] stays characters here",
  "last code line",
  "```",
  "",
  "---",
  "",
  " ---",
  "",
  "* * *",
  "",
  "```",
  "",
  "```",
  "",
  "> ```js",
  "> const quoted = 1",
  "> ```",
  "",
  "[SELF]",
  "",
  "````x",
  "an unclosed fence, left open on purpose",
  "```",
  "",
].join("\n");

/** The measured expectations, in the tokens' resolved values. */
const INK = "rgb(36, 36, 35)"; // --color-ink #242423
const FAINT = "rgb(131, 132, 125)"; // --color-faint #83847d
const LINE = "rgb(232, 232, 228)"; // --color-line #e8e8e4

export async function run(api) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });
  await api.goto(`${HOST}/stream`);
  await api.sleep(1200);

  const eva = (code) => api.eval(code);
  const found = await eva(
    `fetch('/v1/documents', { headers: ${HEADERS} }).then(r => r.json()).then(d => d.documents.find(x => (x.title ?? '') === ${JSON.stringify(TITLE)})?.id)`,
  );
  const docId =
    found ??
    (await eva(
      `fetch('/v1/documents', { method: 'POST', headers: ${HEADERS}, body: JSON.stringify({ content: ${JSON.stringify(FIXTURE)} }) }).then(r => r.json()).then(d => d.document.id)`,
    ));
  // The page block links to the fixture itself, so no other document is
  // touched — the id only exists once the document does, hence the write
  // after the create. The same write resets a reused fixture to this text.
  const content = FIXTURE.replace("[SELF]", `[${TITLE}](/documents/${docId})`);
  const body = JSON.stringify(JSON.stringify({ content }));
  await eva(`fetch('/v1/documents/${docId}', { method: 'PATCH', headers: ${HEADERS}, body: ${body} }).then(r => r.status)`);
  await api.goto(`${HOST}/documents/${docId}`);
  await api.sleep(3000);

  const want = (name, got, expected) => {
    if (JSON.stringify(got) !== JSON.stringify(expected))
      throw new Error(`${name}: ${JSON.stringify(got)}, the declaration says ${JSON.stringify(expected)}`);
  };
  const near = (name, got, expected, slack = 0.6) => {
    if (typeof got !== "number" || Math.abs(got - expected) > slack)
      throw new Error(`${name}: ${JSON.stringify(got)}, the declaration says ~${expected}`);
  };

  const read = JSON.parse(
    await eva(`(() => {
      const view = document.querySelector('main .cm-content');
      const lines = [...view.querySelectorAll('.cm-line')];
      const byText = (needle) => lines.find((l) => l.textContent.includes(needle));
      const spanOf = (line) => line && [...line.querySelectorAll('span')].find((s) => s.textContent.trim());
      const spanWith = (needle) => {
        const line = byText(needle);
        return line && [...line.querySelectorAll('span')].find((s) => s.textContent.includes(needle.trim()));
      };
      const r10 = (n) => Math.round(n * 10) / 10;

      const quotes = [...view.querySelectorAll('.cm-quote-line')].map((l) => {
        const r = l.getBoundingClientRect();
        return { top: r10(r.top), bottom: r10(r.bottom), left: r10(r.left), h: r10(r.height) };
      });
      const q0 = view.querySelector('.cm-quote-line');
      const qcs = q0 && getComputedStyle(q0);

      const firsts = [...view.querySelectorAll('.cm-code-first')];
      const lasts = [...view.querySelectorAll('.cm-code-last')];
      const fcs = firsts[0] && getComputedStyle(firsts[0]);
      const lcs = lasts[0] && getComputedStyle(lasts[0]);
      // Plain code renders as bare text nodes — no span exists unless a
      // token has a style — so the line's computed style IS the words'.
      // Span-level reads use the two spans that do exist: the unclosed
      // fence's mono span and the js fence's keyword span.
      const midLine = byText('last code line');
      const mcs = midLine && getComputedStyle(midLine);
      const monoSpan = spanOf(byText('an unclosed fence'));

      const lookalike = byText('- looks like a list');
      const lookalikeCs = lookalike && getComputedStyle(lookalike);
      const jsdocAt = lines.indexOf(byText(' * jsdoc continuation'));
      const blankInFence = jsdocAt >= 0 ? lines[jsdocAt + 1] : null;

      const rules = lines.filter((l) => l.querySelector('.cm-rule')).map((l) => {
        const el = l.querySelector('.cm-rule');
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { left: r10(r.left), width: r10(r.width), lineH: r10(l.getBoundingClientRect().height),
                 role: el.getAttribute('role'),
                 paints: cs.backgroundImage.includes('linear-gradient') && cs.backgroundImage.includes(${JSON.stringify(LINE)}) };
      });
      const quotedFence = byText('const quoted');
      const citeInFence = byText('[Source 9]');

      const inline = spanWith('inline code');
      const ics = inline && getComputedStyle(inline);
      const item = byText('one item');
      const itemCs = item && getComputedStyle(item);
      const glyph = view.querySelector('button[aria-label^="Page "] svg');
      const tail = byText('an unclosed fence');
      const emptyBlock = firsts[1] && lasts[1] && r10(lasts[1].getBoundingClientRect().bottom - firsts[1].getBoundingClientRect().top);

      return JSON.stringify({
        quote: q0 && { bar: qcs.borderLeftWidth + ' ' + qcs.borderLeftColor, inset: qcs.paddingLeft,
                       words: (spanOf(q0)) ? getComputedStyle(spanOf(q0)).color : null, rects: quotes },
        code: midLine && {
          words: mcs.fontSize + ' ' + mcs.color,
          mono: mcs.fontFamily.toLowerCase().includes('mono'),
          monoSpan: monoSpan
            ? getComputedStyle(monoSpan).fontSize + ' ' + getComputedStyle(monoSpan).color + ' mono:' + getComputedStyle(monoSpan).fontFamily.toLowerCase().includes('mono')
            : null,
          sides: mcs.paddingLeft + '/' + mcs.paddingRight,
          tint: mcs.backgroundColor,
          caps: firsts.length + '/' + lasts.length,
          capTop: fcs.paddingTop + ' r' + fcs.borderTopLeftRadius,
          capBottom: lcs.paddingBottom + ' r' + lcs.borderBottomLeftRadius,
          capHeight: r10(firsts[0].getBoundingClientRect().height),
          // The language name is the cap line's own bare text — searching
          // for "js" would land on "jsdoc continuation" first.
          lang: fcs.fontSize + ' ' + fcs.color,
          keyword: spanWith('const') ? getComputedStyle(spanWith('const')).fontSize + ' ' + getComputedStyle(spanWith('const')).color : null,
          controls: view.querySelectorAll('.cm-code-line button, .cm-code-line select').length,
        },
        lookalike: lookalike && { classes: lookalike.className, pad: lookalikeCs.paddingLeft, indent: lookalikeCs.textIndent },
        blankInFenceH: blankInFence ? r10(blankInFence.getBoundingClientRect().height) : null,
        emptyBlock,
        rules,
        inline: inline && { font: ics.fontSize + ' ' + ics.color, mono: ics.fontFamily.toLowerCase().includes('mono'), chip: ics.backgroundColor },
        item: item && { classes: item.className.includes('cm-item-line'), pad: itemCs.paddingTop + '/' + itemCs.paddingBottom, margin: itemCs.marginLeft },
        glyph: glyph && { size: Math.round(glyph.getBoundingClientRect().width), color: getComputedStyle(glyph).color },
        unclosed: tail && { code: tail.className.includes('cm-code-line'),
                            capped: tail.className.includes('cm-code-first') || tail.className.includes('cm-code-last') },
        quotedFence: quotedFence && { quote: quotedFence.className.includes('cm-quote-line'),
                                      code: quotedFence.className.includes('cm-code-line') },
        citeStaysWritten: citeInFence ? citeInFence.textContent.includes('[Source 9]') : null,
      });
    })()`),
  );
  console.log(JSON.stringify(read));

  // -- the quote ------------------------------------------------------------
  if (!read.quote) throw new Error("no quote line on the fixture");
  want("the quote's bar", read.quote.bar, `3px ${INK}`);
  want("the quote's inset", read.quote.inset, "14px");
  want("the quote's words", read.quote.words, INK);
  // The first three quote lines are the prose quote; the quoted fence's
  // lines carry the class too and are checked on their own below.
  if (read.quote.rects.length < 3) throw new Error(`the quote is ${read.quote.rects.length} lines, the fixture wrote 3`);
  read.quote.rects.slice(0, 3).forEach((r, at) => {
    near(`quote line ${at}'s height`, r.h, 24);
    if (at > 0 && Math.abs(r.top - read.quote.rects[at - 1].bottom) > 0.5)
      throw new Error("the quote's bar breaks between lines");
    if (r.left !== read.quote.rects[0].left) throw new Error("the quote's bar is not one straight line");
  });

  // -- the closed fence -----------------------------------------------------
  if (!read.code) throw new Error("no code line on the fixture");
  want("the container's own words", read.code.words, `13.6px ${INK}`);
  want("the code face", read.code.mono, true);
  want("a mono span adds no second scaling", read.code.monoSpan, `13.6px ${INK} mono:true`);
  want("the code's sides", read.code.sides, "22px/22px");
  want("the container's tint", read.code.tint, "rgba(66, 35, 3, 0.03)");
  // Three closed fences: js, the empty one, and the one inside a quote —
  // closed is the parser's word, so the quoted fence closes too. The
  // mismatched ````x tail does not.
  want("containers drawn", read.code.caps, "3/3");
  want("the top cap", read.code.capTop, "15.6px r10px");
  want("the bottom cap", read.code.capBottom, "15.6px r10px");
  near("the cap, cap to edge", read.code.capHeight, 36);
  want("the language name", read.code.lang, `13.6px ${INK}`);
  want("a keyword keeps its highlight, unscaled", read.code.keyword, "13.6px rgb(103, 89, 220)");
  want("controls inside the container", read.code.controls, 0);
  if (!read.lookalike) throw new Error("the fixture's fenced list-lookalike is missing");
  if (read.lookalike.classes.includes("cm-item-line")) throw new Error("a line inside the fence is painted as a list item");
  want("a fenced lookalike's padding", read.lookalike.pad, "22px");
  want("a fenced lookalike's indent", read.lookalike.indent, "0px");
  near("a blank line inside the fence", read.blankInFenceH, 20.4);
  near("the slash menu's empty code block", read.emptyBlock, 92.4);
  if (!read.unclosed?.code) throw new Error("the unclosed fence is not painted as code");
  if (read.unclosed.capped) throw new Error("the ````x fence closed itself on a shorter ``` — it grew a cap");
  if (!read.quotedFence?.quote || !read.quotedFence?.code)
    throw new Error("the fence inside a quote lost the quote's bar or the code paint");
  want("a [Source n] inside the fence", read.citeStaysWritten, true);

  // -- the divider ----------------------------------------------------------
  if (read.rules.length !== 3) throw new Error(`${read.rules.length} rules drawn, the fixture wrote 3 (---, a space-led ---, * * *)`);
  for (const rule of read.rules) {
    if (!rule.paints) throw new Error("a rule's hairline is not the line token");
    want("what a screen reader is told", rule.role, "separator");
    // A leading space once pushed the full-width hairline onto a second
    // visual line: 24px became 48.
    near("a rule line's height", rule.lineH, 24);
  }
  if (read.rules.some((rule) => rule.left !== read.rules[0].left || rule.width !== read.rules[0].width))
    throw new Error(`the rules disagree: ${JSON.stringify(read.rules)} — one took an indent`);

  // -- prose ----------------------------------------------------------------
  if (!read.inline) throw new Error("no inline code in the fixture's prose");
  want("inline code, colour only", read.inline.font, `14.4px ${INK}`);
  want("inline code stays mono", read.inline.mono, true);
  want("inline code has no chip", read.inline.chip, "rgba(0, 0, 0, 0)");
  want("a list outside the fence", read.item.classes, true);
  want("a list item's rhythm stays", read.item.pad, "1px/1px");
  want("a list item's inset stays", read.item.margin, "9px");
  if (!read.glyph) throw new Error("no page block on the fixture");
  want("the page glyph", read.glyph.size, 20);
  want("the page glyph's grey", read.glyph.color, FAINT);

  // -- the caret: markers return, the container holds still ------------------
  const spots = JSON.parse(
    await eva(`(() => {
      const view = document.querySelector('main .cm-content');
      const lines = [...view.querySelectorAll('.cm-line')];
      const at = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + 120), y: Math.round(r.top + r.height / 2) }; };
      const rule = lines.find((l) => l.querySelector('.cm-rule'));
      const cap = view.querySelector('.cm-code-first');
      const jsdocAt = lines.indexOf(lines.find((l) => l.textContent.includes('jsdoc continuation')));
      const blankInFence = lines[jsdocAt + 1];
      const prose = lines.find((l) => l.textContent.includes('A body paragraph'));
      return JSON.stringify({ rule: at(rule), cap: at(cap), blank: at(blankInFence), prose: at(prose),
        capH: Math.round(cap.getBoundingClientRect().height * 10) / 10, ruleH: Math.round(rule.getBoundingClientRect().height * 10) / 10 });
    })()`),
  );

  await api.click(spots.rule.x, spots.rule.y);
  await api.sleep(500);
  const onRule = JSON.parse(
    await eva(`(() => {
      const lines = [...document.querySelectorAll('main .cm-line')];
      const line = lines.find((l) => l.textContent.includes('---')) ?? null;
      return JSON.stringify(line ? { dashes: true, widgetGone: !line.querySelector('.cm-rule'), h: Math.round(line.getBoundingClientRect().height * 10) / 10 } : null);
    })()`),
  );
  if (!onRule?.dashes || !onRule.widgetGone) throw new Error("the dashes did not come back under the caret");
  near("the rule line under the caret", onRule.h, spots.ruleH);

  await api.click(spots.cap.x, spots.cap.y);
  await api.sleep(500);
  const onCap = JSON.parse(
    await eva(`(() => {
      const cap = document.querySelector('main .cm-code-first');
      return JSON.stringify({ marks: cap.textContent.includes('\\u0060\\u0060\\u0060js'), h: Math.round(cap.getBoundingClientRect().height * 10) / 10 });
    })()`),
  );
  if (!onCap.marks) throw new Error("the fence marks did not come back under the caret");
  near("the cap under the caret", onCap.h, spots.capH);

  await api.click(spots.blank.x, spots.blank.y);
  await api.sleep(500);
  const hintInFence = await eva(`Boolean(document.querySelector('main .cm-hint'))`);
  if (hintInFence) throw new Error('"Type / for commands" is offered inside the container');
  // A blank prose line is where the hint belongs — prove the absence above
  // was the fence's doing, not the hint being broken.
  const blankProse = JSON.parse(
    await eva(`(() => {
      const lines = [...document.querySelectorAll('main .cm-line')];
      const at = lines.indexOf(lines.find((l) => l.textContent.includes('A body paragraph')));
      const r = lines[at + 1].getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.left + 40), y: Math.round(r.top + r.height / 2) });
    })()`),
  );
  await api.click(blankProse.x, blankProse.y);
  await api.sleep(500);
  const hintInProse = await eva(`Boolean(document.querySelector('main .cm-hint'))`);
  if (!hintInProse) throw new Error("the hint is gone from prose too — the fence check broke it");

  // The worst typing path: the blank last line of an unclosed fence at the
  // document's end. One resolve side missed the fence there and offered the
  // hint inside the band.
  const lastSpot = JSON.parse(
    await eva(`(() => {
      const lines = [...document.querySelectorAll('main .cm-line')];
      const last = lines[lines.length - 1];
      last.scrollIntoView({ block: 'center' });
      const r = last.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2), code: last.className.includes('cm-code-line') });
    })()`),
  );
  if (!lastSpot.code) throw new Error("the document's last line is not inside the unclosed fence — the fixture moved");
  await api.click(lastSpot.x, lastSpot.y);
  await api.sleep(500);
  const hintAtEnd = await eva(`Boolean(document.querySelector('main .cm-hint'))`);
  if (hintAtEnd) throw new Error(`"Type / for commands" is offered on the unclosed fence's last line`);

  await api.screenshot(`${OUT}/rendered-blocks.png`);
  console.log("PASS the quote, the fence, the divider, the page link and the caret all hold the declared numbers");
}
