/**
 * The second rendered-blocks pass: eight parities.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/markdown-parity.mjs
 *
 * Asserts docs/spec/features/markdown-parity.md on the running product, on
 * the words and on the bytes: the fixture is fetched back at the end and
 * must be byte-identical — renumbering, resolving and the column are paint.
 * The check writes its own fixture document and touches nothing else.
 * Assertions read the element the claim is about — the fidelity review of
 * the first draft found five that could be satisfied by the wrong one.
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";
const HEADERS = `{ 'X-Logue-Client': 'web', 'Content-Type': 'application/json' }`;

const TITLE = "QA markdown parity (safe to delete)";
const FIXTURE = [
  TITLE,
  "",
  "Prose with ~~struck words~~ and a [TODO] marker in it.",
  "",
  "- first item extends",
  "  indented continuation",
  "- second item extends",
  "lazy continuation",
  "- [ ] to-do item that extends",
  "  to-do continuation aligned",
  "",
  "> depth one",
  ">> depth two",
  ">>> depth three",
  ">>>> depth four",
  "",
  "> break above",
  ">",
  ">> broken inner",
  "",
  "    indented code - looks like a list",
  "",
  "    [Source 9] stays written here",
  "",
  "1. alpha",
  "2. beta",
  "",
  "1. gamma same list",
  "1. delta same list",
  "",
  "A paragraph splits the lists here.",
  "",
  "57. offset first",
  "1. offset second",
  "",
  "7) paren seven",
  "1) paren eight",
  "",
  "#### h4 Heading",
  "##### h5 Heading",
  "###### h6 Heading",
  "",
  'A link [with a title](https://example.com/x "The Title") in prose.',
  "",
  "![Ref image][pic]",
  "",
  "See [the plan][doc] and the shortcut [pic] too.",
  "",
  "Collapsed forms: [doc][] and one more ![pic][] image.",
  "",
  "- item holding code:",
  "  ```js",
  "  const inside = 1",
  "  ```",
  "",
  '[pic]: https://octodex.github.com/images/minion.png "Minion"',
  "[doc]: https://example.com/plan",
].join("\n");

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
  const body = JSON.stringify(JSON.stringify({ content: FIXTURE }));
  await eva(`fetch('/v1/documents/${docId}', { method: 'PATCH', headers: ${HEADERS}, body: ${body} }).then(r => r.status)`);
  await api.goto(`${HOST}/documents/${docId}`);
  await api.sleep(3200);

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
      const r10 = (n) => Math.round(n * 10) / 10;
      // Where a line's words start: the first glyph past leading whitespace.
      const textX = (line) => {
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.textContent.search(/\\S/);
          if (at < 0) continue;
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + 1);
          return r10(range.getBoundingClientRect().left);
        }
        return null;
      };
      const style = (line, prop) => line ? getComputedStyle(line)[prop] : null;

      const itemA = byText('first item extends');
      // The item's text column is where the item's own wrapped lines sit:
      // its padding — the target every continuation must land on.
      const itemWords = r10(itemA.getBoundingClientRect().left + parseFloat(getComputedStyle(itemA).paddingLeft));
      const todoItem = byText('to-do item that extends');
      const todoWords = r10(todoItem.getBoundingClientRect().left + parseFloat(getComputedStyle(todoItem).paddingLeft));

      const struck = byText('struck words');
      const todoSpan = [...struck.querySelectorAll('span')].find((s) => s.textContent.includes('TODO'));

      const q = ['depth one','depth two','depth three','depth four'].map((n) => byText(n));
      const quote = q.map((l) => {
        const cs = getComputedStyle(l);
        return { pad: cs.paddingLeft, border: cs.borderLeftWidth,
                 bars: (cs.backgroundImage.match(/linear-gradient/g) ?? []).length,
                 inked: !cs.backgroundImage.includes('linear-gradient') || cs.backgroundImage.includes('rgb(36, 36, 35)'),
                 origin: cs.backgroundOrigin, position: cs.backgroundPosition, size: cs.backgroundSize };
      });
      const breakAbove = byText('break above');
      const bare = lines[lines.indexOf(breakAbove) + 1];
      const brokenInner = byText('broken inner');
      const quoteBreak = {
        bareBars: (getComputedStyle(bare).backgroundImage.match(/linear-gradient/g) ?? []).length,
        barePad: getComputedStyle(bare).paddingLeft,
        innerBars: (getComputedStyle(brokenInner).backgroundImage.match(/linear-gradient/g) ?? []).length,
      };

      const band = byText('- looks like a list');
      const bandBlank = lines[lines.indexOf(band) + 1];
      const bandInfo = band && {
        code: band.className.includes('cm-code-line'),
        capped: [...view.querySelectorAll('.cm-code-first, .cm-code-last')].some((l) => l.textContent.includes('looks like')),
        item: band.className.includes('cm-item-line'),
        spaces: band.textContent.startsWith('    '),
        sides: style(band, 'paddingLeft'),
        tint: style(band, 'backgroundColor'),
        blankH: bandBlank ? r10(bandBlank.getBoundingClientRect().height) : null,
        blankIsCode: bandBlank ? bandBlank.className.includes('cm-code-line') : null,
        cite: byText('[Source 9]') ? byText('[Source 9]').textContent.includes('[Source 9]') : false,
      };

      // The marker as drawn: the widget's shown text, or the kept mark. No
      // textContent fallback — it read the right answer off a missing mark.
      const num = (needle) => {
        const line = byText(needle);
        const widget = line && line.querySelector('.cm-ordered-shown');
        const ghost = line && line.querySelector('.cm-ordered-ghost');
        const marked = line && line.querySelector('.cm-ordered-mark:not(.cm-ordered-num)');
        return { shown: widget ? widget.textContent : (marked ? marked.textContent : null),
                 ghost: ghost ? ghost.textContent : null };
      };
      const numbers = {
        alpha: num('alpha'), beta: num('beta'), gamma: num('gamma'), delta: num('delta'),
        offset1: num('offset first'), offset2: num('offset second'),
        paren1: num('paren seven'), paren2: num('paren eight'),
      };

      const heads = ['h4','h5','h6'].map((n) => {
        const line = byText(n + ' Heading');
        const span = [...line.querySelectorAll('span')].find((s) => s.textContent.includes('Heading'));
        const cs = getComputedStyle(span);
        return { size: cs.fontSize, weight: cs.fontWeight, color: cs.color, room: style(line, 'paddingTop') };
      });

      const titled = byText('in prose.');
      const img = view.querySelectorAll('img[alt="Ref image"], img[alt="pic"]');
      const refs = byText('See ');
      const collapsed = byText('Collapsed forms:');
      const defPic = byText('[pic]:');
      const fencedItem = byText('const inside');

      return JSON.stringify({
        column: { item: itemWords, indented: textX(byText('indented continuation')), lazy: textX(byText('lazy continuation')),
                  todoItem: todoWords, todo: textX(byText('to-do continuation aligned')) },
        struck: { tildes: struck.textContent.includes('~~'), todoBrackets: struck.textContent.includes('[TODO]'),
                  todoPaint: todoSpan ? getComputedStyle(todoSpan).color + ' ' + getComputedStyle(todoSpan).textDecorationLine : null },
        quote, quoteBreak,
        band: bandInfo,
        numbers,
        heads,
        title: { text: titled.textContent, gap: titled.textContent.includes('  ') },
        reference: { images: img.length,
                     planClean: refs.textContent.includes('the plan') && !refs.textContent.includes('[the plan]')
                       && !refs.textContent.includes('doc'),
                     shortcutClean: / pic /.test(refs.textContent.replace(/[.]/g, ' ')) && !refs.textContent.includes('[pic]'),
                     collapsedClean: collapsed.textContent.includes('doc') && !collapsed.textContent.includes('[doc]')
                       && !collapsed.textContent.includes('![pic]'),
                     defShown: defPic ? defPic.textContent : null,
                     defInk: defPic ? getComputedStyle(defPic).color : null,
                     defTitleInk: (() => {
                       const span = defPic && [...defPic.querySelectorAll('span')].find((s) => s.textContent.includes('Minion'));
                       return span ? getComputedStyle(span).color : null;
                     })() },
        fencedItem: fencedItem && { margin: r10(parseFloat(style(fencedItem, 'marginLeft'))), code: fencedItem.className.includes('cm-code-line') },
      });
    })()`),
  );
  console.log(JSON.stringify(read));

  // -- 1. the item's text column ---------------------------------------------
  near("the indented continuation's column", read.column.indented, read.column.item, 1);
  near("the lazy continuation's column", read.column.lazy, read.column.item, 1);
  near("the to-do continuation's column", read.column.todo, read.column.todoItem, 1);

  // -- 2. strikethrough --------------------------------------------------------
  want("the tildes hide", read.struck.tildes, false);
  want("an unresolved [TODO] keeps its brackets", read.struck.todoBrackets, true);
  want("and wears the product's ink, not a link's", read.struck.todoPaint, "rgb(36, 36, 35) none");

  // -- 3. quote depth ----------------------------------------------------------
  want("depth one's border", read.quote[0].border, "3px");
  want("depth one's pad", read.quote[0].pad, "14px");
  want("depth two's bars", read.quote[1].bars, 1);
  want("depth two's pad", read.quote[1].pad, "31px");
  want("depth three's bars", read.quote[2].bars, 2);
  want("depth three's pad", read.quote[2].pad, "48px");
  want("depth four holds at three bars", read.quote[3].bars, 2);
  want("depth four's pad", read.quote[3].pad, "48px");
  // The geometry, not just the count: measured from the border box — from
  // the padding box every bar sat 3px right and the gaps read 17/14/11.
  want("the bars start where the numbers say", read.quote[2].position, "17px 0px, 34px 0px");
  want("a bar is 3px of ink", read.quote[2].size + " " + read.quote[2].inked, "3px 100%, 3px 100% true");
  want("measured from the border box", read.quote[2].origin, "border-box, border-box");
  want("a bare > line is depth one", read.quoteBreak.bareBars + "/" + read.quoteBreak.barePad, "0/14px");
  want("and the inner bar breaks around it", read.quoteBreak.innerBars, 1);

  // -- 4. the band -------------------------------------------------------------
  if (!read.band) throw new Error("no indented code on the fixture");
  want("indented code is the band", read.band.code, true);
  want("the band grows no caps", read.band.capped, false);
  want("no list paint inside the band", read.band.item, false);
  want("the four spaces stay", read.band.spaces, true);
  want("the band's sides", read.band.sides, "22px");
  want("the band's tint", read.band.tint, "rgba(66, 35, 3, 0.03)");
  want("a blank line inside the band is code", read.band.blankIsCode, true);
  near("and keeps the full height", read.band.blankH, 20.4);
  want("a [Source n] in the band stays written", read.band.cite, true);

  // -- 5. numbering ------------------------------------------------------------
  want("alpha", read.numbers.alpha.shown, "1.");
  want("beta", read.numbers.beta.shown, "2.");
  want("gamma — blank lines do not end a list", read.numbers.gamma.shown, "3.");
  want("delta", read.numbers.delta.shown, "4.");
  want("the written start holds", read.numbers.offset1.shown, "57.");
  want("and counts on", read.numbers.offset2.shown, "58.");
  want("the written separator holds", read.numbers.paren1.shown, "7)");
  want("and counts on in kind", read.numbers.paren2.shown, "8)");
  want("the box is sized by the written marker", read.numbers.offset2.ghost, "1.");

  // -- 6. h4–h6 ----------------------------------------------------------------
  want("h4", [read.heads[0].size, read.heads[0].weight, read.heads[0].room, read.heads[0].color],
    ["18px", "600", "12px", "rgb(36, 36, 35)"]);
  want("h5", [read.heads[1].size, read.heads[1].weight, read.heads[1].room, read.heads[1].color],
    ["16px", "600", "12px", "rgb(36, 36, 35)"]);
  want("h6", [read.heads[2].size, read.heads[2].weight, read.heads[2].room, read.heads[2].color],
    ["14px", "600", "12px", "rgb(98, 98, 95)"]);

  // -- 7. the title stays out --------------------------------------------------
  want("the title is gone", read.title.text.includes("The Title"), false);
  want("no orphan gap", read.title.gap, false);
  want("the words remain", read.title.text.includes("A link with a title in prose."), true);

  // -- 8. references -----------------------------------------------------------
  want("the reference and collapsed images draw", read.reference.images, 2);
  want("a resolved reference link reads clean, label hidden", read.reference.planClean, true);
  want("the shortcut form resolves", read.reference.shortcutClean, true);
  want("the collapsed forms resolve", read.reference.collapsedClean, true);
  if (!read.reference.defShown?.startsWith("[pic]: https://"))
    throw new Error(`the definition line is not verbatim: ${JSON.stringify(read.reference.defShown)}`);
  want("the definition line dims to muted", read.reference.defInk, "rgb(107, 108, 102)");
  want("its title too — one grey, one line", read.reference.defTitleInk, "rgb(107, 108, 102)");
  if (!read.fencedItem) throw new Error("no fenced code inside an item on the fixture");
  want("a fence inside an item is code", read.fencedItem.code, true);
  near("and inset by the item's column exactly", read.fencedItem.margin, 16.4, 0.3);

  // -- the caret returns -------------------------------------------------------
  const spots = JSON.parse(
    await eva(`(() => {
      const lines = [...document.querySelectorAll('main .cm-line')];
      const at = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + 80), y: Math.round(r.top + r.height / 2) }; };
      const gamma = lines.find((l) => l.textContent.includes('gamma'));
      const numBox = gamma.querySelector('.cm-ordered-num').getBoundingClientRect();
      return JSON.stringify({
        struck: at(lines.find((l) => l.textContent.includes('struck words'))),
        gamma: at(gamma),
        gammaNum: { x: Math.round(numBox.left + 4), y: Math.round(numBox.top + numBox.height / 2) },
        title: at(lines.find((l) => l.textContent.includes('in prose.'))),
        prose: at(lines.find((l) => l.textContent.includes('A paragraph splits'))),
      });
    })()`),
  );
  await api.click(spots.struck.x, spots.struck.y);
  await api.sleep(400);
  const struckBack = await eva(`[...document.querySelectorAll('main .cm-line')].find((l) => l.textContent.includes('struck words')).textContent.includes('~~')`);
  want("the tildes return under the caret", struckBack, true);

  // Clicking the drawn number puts the caret in the marker's line.
  await api.click(spots.gammaNum.x, spots.gammaNum.y);
  await api.sleep(400);
  const onNumber = JSON.parse(
    await eva(`(() => {
      const line = [...document.querySelectorAll('main .cm-line')].find((l) => l.textContent.includes('gamma'));
      // The widget gone is what says the caret arrived — the ghost keeps the
      // written text in the DOM, so textContent alone cannot tell the two
      // states apart.
      return JSON.stringify({ widgetGone: !line.querySelector('.cm-ordered-num'), written: line.textContent.includes('1. gamma') });
    })()`),
  );
  want("clicking the number lands the caret", onNumber.widgetGone, true);
  want("and the written marker returns", onNumber.written, true);
  const gammaX = JSON.parse(
    await eva(`(() => {
      const line = [...document.querySelectorAll('main .cm-line')].find((l) => l.textContent.includes('gamma'));
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent.indexOf('gamma');
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at); range.setEnd(node, at + 1);
        return JSON.stringify(Math.round(range.getBoundingClientRect().left * 10) / 10);
      }
      return JSON.stringify(null);
    })()`),
  );

  await api.click(spots.title.x, spots.title.y);
  await api.sleep(400);
  const titleBack = await eva(
    `JSON.stringify([...document.querySelectorAll('main .cm-line')].find((l) => l.textContent.includes('in prose.')).textContent)`,
  );
  // Verbatim, not a substring: the address, its space and the title must all
  // be back, exactly as the fixture wrote them.
  want("the whole line returns under the caret", JSON.parse(titleBack), 'A link [with a title](https://example.com/x "The Title") in prose.');
  await api.click(spots.prose.x, spots.prose.y);
  await api.sleep(300);

  // The column does not move as the caret leaves a renumbered item.
  const gammaAfter = JSON.parse(
    await eva(`(() => {
      const line = [...document.querySelectorAll('main .cm-line')].find((l) => l.textContent.includes('gamma'));
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent.indexOf('gamma');
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at); range.setEnd(node, at + 1);
        return JSON.stringify(Math.round(range.getBoundingClientRect().left * 10) / 10);
      }
      return JSON.stringify(null);
    })()`),
  );
  near("gamma's words hold their column", gammaAfter, gammaX, 1);

  // -- the bytes ---------------------------------------------------------------
  const stored = await eva(
    `fetch('/v1/documents/${docId}', { headers: ${HEADERS} }).then(r => r.json()).then(d => d.document.content)`,
  );
  if (stored !== FIXTURE) throw new Error("THE BYTES MOVED — paint wrote into the document");
  console.log("PASS the bytes did not move");

  await api.screenshot(`${OUT}/markdown-parity.png`);
  console.log("PASS all eight parities hold on the running product");
}
