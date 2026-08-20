# Rendered blocks, at Notion's numbers — declaration

Status: **declared and built** (2026-08-19, task N20; the declaration was
revised after the three-agent review, and the build reviewed again). His words, over a screenshot of the Notion copy of the
QA document: *"notion has better style for rendered blocks. improve ours
based on their design"*.

Every Notion number below was measured on 2026-08-19, on app.notion.com in
his signed-in browser, off that same page — the same constructs, side by
side. The type scale, the 720px column, the 40px paragraph rhythm and the
heading spacings were measured and matched in an earlier pass
(`MarkdownEditor.tsx`'s own comments, asserted by `scripts/qa/notion-shape.mjs`)
and are not touched here.

**No new words.** Nothing here adds, removes or changes a user-visible
string. `docs/spec/copy.md` still moves — down, 1180 to 1172 — because the
review found the inventory reading CSS values (`3px solid …`, `0 7px`) as
copy, and per review-process.md the extractor is fixed in the same change;
every dropped entry is paint, verified by diffing the string sets.

Two words, used exactly: a **fenced code block** is the Markdown construct
(` ``` ` to ` ``` `); the **container** is the rounded shape this pass paints
it as.

## The surface

**A quote** (every `>` line)

- The bar: 3px solid, in the product's ink (`ink`, #242423). Notion's own bar
  reads `rgb(44,44,43)`; the token wins, because one page carries one ink.
  Today the bar is 2px `line-strong`.
- The words: ink, body size. Today they are softened to `ink-soft`.
- The text sits 14px right of the bar; today it sits 12.8px.
- No new vertical rhythm, and consecutive `>` lines keep joining into one
  unbroken bar, a blank `>` line included (verified on the running product).

**A fenced code block, closed**

- One container: 10px radius and background `rgba(66, 35, 3, 0.03)`, both
  read off Notion's container — the token `code-bg` in theme.css, the only
  new value.
- The fence's marker lines are the container's caps: the first line carries
  the top radius and 15.6px of extra padding above, the last line the bottom
  radius and 15.6px below. A cap line is itself a code line — 20.4px — so the
  code sits 36px from the container's edge, Notion's own 36.
- Code text: mono at `0.85em` of the page's 16px, at the page's 1.5 —
  13.6px/20.4px, exactly Notion's `13.6/20.4 SFMono`. Ink, which is also a
  reading: Notion's code text came back `rgb(44,44,43)`, its own ink. The
  size lives on the line and only there: a span inside a code line adds no
  second scaling (today the mono span's own 0.9em compounds to 12.96px).
  Language highlighting keeps its colours.
- 22px of padding left and right, Notion's own.
- A language name written after the fence (` ```mermaid `, which the slash
  menu's Diagram writes) stays visible on the top cap, in ink at the code
  size — it is written text, not an overlay, and the tag that could grey it
  (`labelName`) also owns a reference link's `[ref]` in running prose, which
  the faint token's own charter forbids fading. Notion overlays a picker and
  prints nothing in the block; ours prints what is written.
- The container carries no controls and no labels of its own: no copy
  button, no language picker. Nothing Notion overlays is adopted.
- **Inside a fence, every line is code.** A line that merely looks like a
  list (`- `, ` * `, `1. ` — a diff, YAML, JSDoc) gets no list paint, no
  indent, no margin; a blank line keeps the full 20.4px, so typing into it
  moves nothing; the caret-line hint ("Type / for commands") does not appear
  there; a `[Source n]` written there stays written characters, never a chip.
  Today all of these leak in (read off the running product: JSDoc ` * ` lines
  indent 9px inside a fence; a blank fence line is 16px and grows when typed
  into).
- The slash menu's empty code block (` ``` `, blank, ` ``` `) is 36 + 20.4 +
  36 ≈ 92px — the height Notion's empty code block has.
- The caps do not come and go with the caret. Only the markers do: the ` ``` `
  unhides on the line the caret is in, as today, and the line's height does
  not change when it does (verified on the running product).

**A fenced code block, not yet closed**

- No container. An unclosed fence runs to the end of the document by
  Markdown's own rules, and a rounded container that swallows everything
  below the caret would read as finished and wrong. Until the closing ` ``` `
  is written, the lines stay a flat band — square corners, no caps — at the
  new numbers (the tint, the 22px sides, the 13.6px ink), which reads as
  "still being written". Its inside is already code, so list paint, blank-line
  squeeze and the hint drop the moment the fence opens; closing it puts the
  container on and nothing else back. The container appears when the fence
  closes.
- Closed is the parser's word, not a text match: the fence's own closing
  mark, wherever it sits. A fence inside a quote closes like any other (and
  keeps the quote's bar); ` ```` ` answered by a shorter ` ``` ` is still
  open, and that ` ``` ` is three written characters in the band.

**A divider** (any line Markdown reads as a horizontal rule: `---`, `* * *`,
`___`)

- Draws as a hairline — 1px of `line`, the product's own rule colour, at the
  exact centre of the line's height — instead of the literal marks it renders
  as today, even though the slash menu sells "Divider". The written marks
  unhide on the caret's line, like every other marker; a rule line never
  takes a list's indent (`* * *` matches the list regex and used to). A
  screen reader is told it is a separator (`role="separator"`), not handed
  three dashes. This is the product's token, not a Notion reading: the
  divider is the one shape here Notion was not measured for, and the product
  already has one hairline everywhere else.

**A page link (the page block)**

- The glyph grows to Notion's 20px and paints `faint` — Notion fills its page
  icon `rgb(142,139,134)`, which is the faint token's neighbourhood; ours is
  16px `muted` today. Everything else already matches: 500-weight ink name,
  the hairline underline, 6px between glyph and name, a hover wash.

**Inline code, in prose** — one word only: its colour follows the mono rule
to ink (today `ink-soft`). Its size, face and lack of a chip stay exactly as
they are; Notion's inline-code chip was not measured and is not copied.

**No other block moves.** Headings, title, paragraphs, citation chips, task
lists, images (unpainted today), the caret-line hint's grey and the
placeholder grey all keep their current shapes. Tables keep `surface-muted`
and square corners this pass — beside the new warm rounded container they
will read as a different family, and that divergence is chosen here rather
than smuggled: the table's own pass belongs to the redesign queue.

## The rhythm

None. Nothing here is automatic.

## The model's part

None.

## What it must never do

- **Never change what is stored.** The document stays plain Markdown; every
  number here is paint on lines the caret can still enter and edit as text.
- **Never introduce an unmeasured Notion value.** Each Notion number traces
  to the 2026-08-19 reading; the two deliberate non-Notion values — the ink
  bar, the divider's hairline — are the product's own tokens, named above.
- **Never fade a quote again**, and never let the fence's paint move a line's
  height under the caret.
- **Never draw the container around an unclosed fence.**

## Open questions

None outstanding. Judgement calls, named so they can be overruled:

- **The bar and the divider use the product's tokens, not Notion's readings.**
  One page, one ink; one product, one hairline.
- **List rhythm does not move.** The 2026-08-19 ledger says a Notion list
  item is 26px and the product matches it; this pass's block-level readings
  (30px wrappers with zero-height siblings between them) disagree, and a
  disputed number is not a reading. Lists keep 1px/1px until someone measures
  the item itself, not its wrappers.
- **Inline code keeps its shape.** Only its ink moves, and only because the
  fence and it share one mono rule.
- **Tables stay as they are this pass**, divergence and all.

## The mechanism (for the reviewers)

All in `web/src/app/MarkdownEditor.tsx` plus one token in
`packages/ui/src/theme.css`. The `FencedCode` walk keeps marking every line
`cm-code-line`; when the fence is closed (its last line is a closing fence)
it also marks the first line `cm-code-first` and the last `cm-code-last`,
which carry the radius and the 15.6px caps — and it remembers the fence's
line range, which the per-line loop then skips for item, blank and title
paint, and the hint plugin consults before offering "Type / for commands".
`HorizontalRule` is replaced by a hairline widget through the same
mask-and-unhide path the other markers use, and its line is kept off the
list-paint path. The quote is `.cm-quote-line` plus `tags.quote`; the mono
ink is `tags.monospace`; the language name is untouched (`labelName` also
owns prose `[ref]`s); the glyph is the `Subpage` widget's class string.
`scripts/qa/rendered-blocks.mjs` asserts the numbers **on the words, not the
boxes**: the quote's span colour, the code span's 13.6px and ink, the caps'
15.6px and radius, the tint, the 22px sides, the glyph's 20px, the divider's
hairline, a fence-interior `- ` line carrying no item paint, and an unclosed
fence carrying no caps.
