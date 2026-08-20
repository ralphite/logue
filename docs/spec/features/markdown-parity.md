# Rendered blocks, the second pass — declaration

Status: **declared and built** (2026-08-19, task N21; the declaration was
revised after a three-agent review that parsed the grammar and measured the
product rather than trusting this file's first draft, and the build was
reviewed again). His words, over the finished
kitchen-sink comparison: *"yes, fix all 8 in order"*. The eight are the gaps
the comparison found — the same markdown-it sample rendered in his Notion
(page "MD kitchen sink QA (safe to delete)") and in Logue (document
`doc_de1bc0e2e55c8d43`), read block by block. Where Notion was measured it is
named; every other number is the product's own choice and marked so.

**No new words.** Nothing here adds a user-visible string. `docs/spec/copy.md`
still moves — down, 1172 to 1165 — because the review-era rule held again:
the inventory read grammar-node names (`"Link"`, `"Paragraph"`) and class
lists (`cm-ordered-mark cm-ordered-num`) as copy, and the extractor is fixed
in the same change; every dropped entry is machinery, verified by diffing
the string sets. The stored document stays plain Markdown throughout — every
change below is paint on lines the caret still edits as written text.

One name for one place: **the item's text column** is where a list item's
own wrapped lines sit — the width of its written marker and leading spaces,
in `ch`. The drawn marker is narrower than the written one, so an item's
first word sits a touch left of its own wraps; that is today's wrap
geometry, kept. Continuations align with the wraps, and the wraps with each
other. It is the only column of a list item this file speaks of.

## The surface

**1. A wrapped list item holds its shape.** A continuation line — written
under an item and part of it by Markdown's rules, whether indented (`  resize
in browser.`) or lazy (no indent) — today drops to the page margin and reads
as a stray paragraph. It now sits at the item's text column, with the item's
9px inset. Its own leading spaces are hidden away from the caret — a mark
in all but name — so both spellings land on the same column; on the caret's
line they show as written and the words step right, the same move a heading
makes when its `#` returns. A `text-indent` cannot do this job: a `ch` is
not a space's width in this face, and cancelling by it overshot. A to-do's
continuation is an item's continuation like any other.

- Only the item's plain prose lines take the column. A line that is itself
  an item, a quote, a rule, a fence or indented code, or blank, keeps its
  own paint. A code container inside an item is inset whole — the item's
  column as a margin — so its band does not run to the page edge while the
  prose around it is indented.
- A quote inside an item keeps the quote's paint, uninset: its bar stands at
  the gutter. Chosen, not perfect — two paints cannot share one line's
  padding, and the quote's is the one that means something.
- A half-typed marker — a `-` alone, no space yet — is its own item to the
  parser and takes no column until the space completes it.
- Blank lines inside a loose item keep the paragraph gap.

**2. `~~struck~~` hides its tildes.** `StrikethroughMark` joins the hidden
marks (the same set `**` and `#` are in) and returns on the caret's line.
The words keep today's line-through. Inside a table line the tildes hide the
way `**` already does there, and the mono columns shift the same way — the
table's own pass, already queued, is where that ends.

**3. A quote inside a quote is drawn one level deeper.** The first level
keeps today's 3px ink border and 14px inset — the numbers the first pass
measured and its check asserts. Each level past the first adds one
background-drawn 3px ink bar, 17px from the last (3px bar + the same 14px —
our own step, not a Notion reading), and the words sit 14px right of the
innermost bar. Depth caps at three bars, the way the bullet glyphs stop at
three. A `>` line between deeper lines is the depth it is written at — the
parser reads `>> a / > / >> b` as two inner quotes, so the inner bar breaks
around the bare line; writing `>>` carries it through. Fence lines inside a
quote keep the first pass's look (bar plus band), and take no depth bars.

**4. Indented code (four spaces) is the band, not the container.** The flat
band an unclosed fence wears: the tint, the 22px sides, the 0.85em ink mono
— square corners, no caps. Not the container, on purpose: four spaces are a
keystroke of habit, and Markdown re-reads neighbouring lines as you edit — a
paragraph's continuation becomes a code block when the line above it is
emptied — so a full container would materialise and vanish under ordinary typing,
which is the trap the first pass built the closed-fence rule against. The
band moves a blank line from 16px to 20.4px when typing makes it code — the
same family of reflow a blank line already has. Everything inside the band
is code: no list paint, no blank squeeze, no hint, no citation chips. The
written four spaces stay visible — they are the text. Notion converts them
away on paste; an editor that must not rewrite the document cannot.

**5. Ordered lists are numbered as read, not as written.** The marker shown
is the list's own counting: the first item's written number starts it
(CommonMark — `57.` starts at 57), each item after counts up, and the
written separator is kept (`1)` counts on as `2)`). Notion renumbers to
`1. 2.` and drops the written start; CommonMark keeps both, and so does
this. Two facts of the same rule, stated so nobody is surprised:

- Blank lines do not end a list. In his own kitchen-sink document the
  `1. / 1.` pair sits two blank lines under `1. 2. 3.` and is items four
  and five of the same list, so it reads `4. 5.` — where Notion shows
  `1. 2.`.
- The shown number wears the written marker's own width: the widget keeps
  the written glyphs inside it, invisible, and draws the shown number over
  them — the same glyphs the caret's line shows, so the text column never
  moves, not when the number differs and not when the caret enters or
  leaves the line. (A `ch`-sized box drifted by the width a period lacks
  in this face.) A shown number wider than the written one runs into the
  gap after it — in a lazy list (`1. 1. 1.`, the commonest spelling) every
  renumbered item does this by the width its digits grew, two pixels of air
  left at ten items; at a hundred items over a `1.`, it touches the first
  character. Accepted and named.
- Enter continues the count as read: the marker the editor types for the
  next item is the shown number plus one. It is the person's own new text,
  written at the count they are looking at — the continue-markup command
  copied the written number and typed `2.` under a shown `3. 4.`.
- A selection shows written markers: selected lines are editing lines, the
  rule everything hidden already follows. What is copied is the source.

The written marker is untouched, shows on the caret's line like every
hidden mark, and the number is a control like the bullet is: clicking it
puts the caret there. The two code comments that say "a number is already
the marker it is printed as" are rewritten by this.

**6. h4–h6 get steps of their own.** Today all three are body size at 600
weight with no room above. Now: **h4 18px, h5 16px, h6 14px, all 600, h6 in
`ink-soft`, each with 12px above** — the blank line pays below, as with
every heading. The sizes ride the highlight tags in `em`, as h1–h3's do, so
the caret-line `####` scales with its words. All three numbers are the
product's own: Notion has no fourth heading to measure — its paste flattens
h4–h6 into minor-heading blocks 51px tall (a block height, not a type size)
— and the 12px continues the 24/20/16 of the headings above (Notion's
measured 40/36/32, less the blank line) by the −4 it was already falling.
h5 shares bold text's size and earns its difference as room; the ladder
below h4 is room and ink, then size again at h6.

**7. A link's title stays out of the prose.** `[text](url "title")` shows
`text` alone: `LinkTitle` hides — only inside an inline link or image,
never on a definition line — and the space between the address and the
title hides with the address, the way the space after `#` already hides
with it. One word, one space, no orphan gap. Everything returns on the
caret's line.

**8. Reference images and links resolve.** The definitions are a table read
from the whole document's text (`[id]: url` lines, wherever they are —
usually the bottom, which a viewport-bounded read would never see),
rebuilt when the document changes. Labels match trimmed, inner whitespace
collapsed, lowercased — our reading of CommonMark's fold. Then:

- `![Alt][id]`, `![Alt][]` and `![Alt]` draw the image the definition
  names, exactly as the inline form does.
- `[text][id]` and `[text]` hide their marks — the [label] with them, an
  address in costume — and follow their address: ⌘-click and the hover
  card, through the same one table. The card offers Go and Unlink; Edit
  belongs to the definition line, where the address is written.
- **A reference that does not resolve is written text, brackets and all,**
  in the product's ink — the grammar still calls it a link and would paint it
  one, so the paint is taken back. Today the brackets of any bracketed word
  quietly vanish (`the [TODO] item` reads `the TODO item`); they stop
  vanishing. Only a resolved reference hides its marks.
- Half-written definitions do not fetch. Editing a definition line used to
  resolve every keystroke's partial address — one image request per key, to
  hosts that do not exist — so the table settles 600ms after the last
  keystroke on a definition line, and reads back at once for any other edit.
- **A definition line shows verbatim, dimmed.** Nothing on it hides — today
  its own colon is eaten by the link-mark rule, which this fixes — and it
  paints `muted` (5.3:1, the running-text grey the contrast pass measured),
  not `faint`: it is a line someone edits. Notion resolves the image and
  deletes the definition line; we resolve and keep it, because the document
  is not rewritten.

**No other block moves.** Everything the first pass pinned keeps its shape,
and `scripts/qa/rendered-blocks.mjs` keeps passing as written — the quote
assertions read the first level's border and 14px, which stay.

## The rhythm

None. Nothing here is automatic.

## The model's part

None.

## What it must never do

- **Never change what is stored.** Renumbering, resolving, the column — all
  paint; the bytes do not move, and the check reads them back to prove it.
- **Never hide what the caret needs.** Every hidden mark — tildes, titles,
  written numbers — returns on the caret's line.
- **Never draw a reference that does not resolve, and never eat its
  brackets.**
- **Never put the new paints on a code line.** Open fence, closed fence, or
  indented band: inside, every line is code.
- **Never grow a card under ordinary typing.** The container stays the closed
  fence's; four spaces earn the band.

## Open questions

None outstanding. Judgement calls, named so they can be overruled:

- **Indented code gets the band, not the container.** The comparison asked
  for Notion's card; a container under a space bar is the trap the first pass
  named, so the band is the shape that survives typing.
- **The 17px quote step, the 18/16/14 heading steps and the 12px room are
  ours.** Derived (3+14; the −4 the scale was already falling), not read.
- **Renumbering keeps the written start and separator.** CommonMark over
  Notion, which keeps neither.
- **Definition lines dim rather than disappear; the four spaces stay.**
  Rendering, not conversion.
- **A quote in a list stands at the gutter.** Two paints, one padding; the
  quote's wins.
- **Depth caps at three bars.**
- **Label matching is trim-collapse-lowercase**, not the full Unicode fold.

## The mechanism (for the reviewers)

All in `web/src/app/MarkdownEditor.tsx`. `MARKS` gains `StrikethroughMark`;
`LinkTitle` hides behind a parent guard (inline `Link`/`Image` only), and
`URL`'s hide extends through the whitespace run after it. `blocks()` gains:
`CodeBlock` painted as band lines and added to the code-line set the
interior immunities and the hint's and citation's fence test already read;
quote depth counted per line from nested `Blockquote` nodes — depth one is
the existing border class, deeper levels an inline style of layered
background bars and stepped padding; continuation lines found per line by
resolving to a `ListItem`, skipped for the item's own first line and for
lines wearing any other block paint, styled `padding-left` at the item's
text column, their leading spaces hidden by `marks()` away from the caret;
fence and band lines inside an item inset by `margin-left` instead;
`ATXHeading4–6` line classes carrying the 12px. `marks()` gains: a
definition table (whole-document regex, cached on `docChanged`, label
normalised) passed in by the plugin; `Image`/`Link` resolution through it —
`LinkLabel` child when present and not `[]`, the node's own text otherwise
— drawing `Picture` or hiding marks only on resolution; ordered `ListMark`s
replaced by a numbering widget (written-width box, `eq` by shown text,
`ignoreEvent` false, `estimatedHeight` −1) computed from the item's
position in its `OrderedList` and the first item's written start;
`LinkReference` lines exempt from every hide and painted `muted` as a line
class. `linkAt()` learns the reference pattern and the same table, which is
what ⌘-click and the hover card read. `scripts/qa/markdown-parity.mjs`
writes its own fixture and asserts, on the words and the bytes: both
continuation spellings on one column and a fenced block inset inside an
item; tildes hidden, returning, bytes intact; three bars at depth three and
still three at depth four, the bare-`>` break; the band's tint and sides,
no caps, the four spaces on screen, and the four immunities inside it
(no item paint, full-height blanks, no hint, no chip); `3. 4.` on the
same-list pair (his document's own pair reads `4. 5.`) and `57. 58.` on
the offset pair with `1.` in the fetched
document, the written-width column holding as the caret enters, the click
landing the caret; the h4/h5/h6 sizes, weights, inks and room; the title
gone, one space, returning; the resolved reference image, the collapsed and
shortcut forms, the unresolved `[TODO]`'s brackets on screen, the
definition line verbatim in `muted`, and `linkAt` answering the reference
form with the table's address.
