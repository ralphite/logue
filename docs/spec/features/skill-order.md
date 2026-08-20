# Skills in the person's own order — declaration

Status: **declared and built** (2026-08-19, task X14; the declaration was
revised after the three-agent review, and the build reviewed again).
Written from his screenshot of the selection toolbar's
"More Skills" menu — five Skills printed onto each other, every sparkle glyph
over the name above it — and his words: *"update extension so that the skills
are stacked. also we should allow configuring the order"*.

Two things, one surface. First, the defect: a menu item holding a glyph grew a
second line and spilled over its neighbour, so the list was unreadable. Second,
the feature: the order of every Skill list is alphabetical today, chosen by
nobody — it becomes the person's.

## What it is for

The Skills someone actually reaches for should be where their hand already is —
first on the bar, first in the menu — in the order they put them, on every
surface, without the product ever re-sorting behind their back.

## The surface

**A menu item, anywhere** (the toolbar's "More Skills" menu, the panel's
menus, the web app's row menus)

- One line: the glyph sits beside the name, never above it. A long name ends in
  an ellipsis. Items follow one another; nothing overlaps.
- No new words. This is the shape the menu was already declared to have; the
  rendering now matches it.

**The Skills page (web), the list on the left** — the one place order is set

- A row is dragged to its place, the same way a Document's row is: the whole
  row is the handle, the row being carried fades where it came from, and a 2px
  line draws where it would land — above or below the row under the pointer.
- Dropping tells the Host once and the list redraws in the new order when the
  Host answers. On a refusal the list stays as it was and the reason appears
  under the search box, above the rows, where it is on screen at any scroll
  position — never beside the search box, squeezing it. It stays until the
  next drag starts. The words are the ones failures already use: the Host's
  own sentence when it refused, `Logue is not running on this Mac.` when
  nothing answered, `Something went wrong.` otherwise. No new words.
- While a search filters the list, dragging is off — the same rule Documents
  already has: a filtered list has no order to change. Nothing is said; the
  rows simply do not drag.
- A drop while the last one is still being written is ignored.
- The list's order is the served order: what you arrange here is what every
  Skill list shows, with one exception named below (the toolbar's first slot).

**Every list of Skills** (no new words on any of them)

- The selection toolbar: the first two Skills offered on a selection sit on the
  bar, in this order; the rest keep this order behind "More Skills". The one
  exception, written into behaviors.md with this feature (it lived only in a
  code comment before): the Skill chosen in Settings under `Selection` takes
  the toolbar's first slot when one is chosen — otherwise choosing it would
  change nothing. The order rules everything after it.
- The page's right-click menu, the panel's Skills row, the web app's pickers
  (the Settings slots, the Project generate box): the same order. The generate
  box today sorts built-in Skills first; that private sort goes — the default
  choice it opens on ("Answer questions") is found by key and does not move.
- A Skill nobody has placed yet — created after the first drag — joins after
  every placed one, alphabetically among its unplaced kind. A workspace where
  nobody has dragged anything keeps today's alphabetical order exactly.

**Order reaching surfaces that are already open**

- The web app and the side panel already follow the workspace and redraw on
  their own; nothing new.
- A page that is already open in another tab fetches its context again the
  next time its tab is shown or its window comes back to the front, so coming
  back to an article after arranging Skills shows the new order without a
  reload — whether the Skills page was another tab or another window.
- The browser's right-click menu is rebuilt when the person switches tabs or
  windows (at most once every ten seconds) and on the worker's own
  five-minute beat — so in the flow that matters,
  arrange-then-right-click-elsewhere, it is current.

## The rhythm

- One drop, one write: `POST /v1/skills/reorder` carries the whole order (a
  list of ids) and the Host stores a position on each Skill it names. There is
  no undo control; dragging the row back is the undo.
- Nothing is automatic. The product never re-sorts on its own — not by use,
  not by recency, not alphabetically once an order exists.
- Moving a Skill is not editing it: its prompt, its revision and its
  `updated_at` do not move. A Run stays explainable by prompt revisions alone.

## The model's part

None. No prompt produces any of these words.

## What it must never do

- **Never let two surfaces disagree about the order.** One order, stored on
  the workspace's own Skill records, served by the Host to every surface. No
  surface keeps a private sort — the generate box's goes with this change.
- **Never re-sort behind the person's back.** An order, once made, is only
  changed by the person making another one.
- **Never lose the order.** It lives on the Skill records, so backup and
  restore carry it.
- **Never bump a Skill's revision for being moved.**
- **Never print a menu item over another.** The defect this began with.
- **Never open a Skill because it was dragged.** A drag is not a click; the
  detail pane stays where it was, and unsaved prompt edits stay on screen.

## Open questions

- **A keyboard way to reorder.** Dragging has none, and Documents ships
  without one today. ⌥⌘↑/↓ is already taken ("Previous or next in the list").
  Left open for the owner; whatever answers it should answer for both lists.

Judgement calls made here, named so they can be overruled:

- **Dragging, not arrows.** Documents already reorders by dragging the row,
  with the same search-disables-it rule, built on native drag events — one
  product, one gesture. (The first draft chose hover arrows; the review found
  they fight the pointer — after a move, the same pixel holds a different
  row's arrow — and that a second gesture for the same act is a cost nobody
  ordered.)
- **The Settings choice keeps the toolbar's first slot.** Both are the
  person's explicit choices; when they disagree, the surface's own default
  wins the slot it exists to fill.
- **One order for all Skills, not one per surface.** The list on the Skills
  page holds every Skill, so putting a Skill first on the toolbar can mean
  dragging it past rows the toolbar never shows. The row's own line already
  says where each Skill is offered. One list a person can hold in their head
  beats four lists that have to be found.
- **The first drag retires alphabetical order for good.** From then on a new
  Skill lands at the end of the list — on the page where dragging it somewhere
  better is one gesture. Predictable beats clever.
- **Disabled Skills are arranged too.** Every Skill has a place; surfaces that
  skip disabled ones keep the order of what remains.

## The mechanism (for the reviewers)

A Skill record carries `position` (an integer) once it has been placed;
`POST /v1/skills/reorder {order: [...]}` — the same shape Documents uses —
writes positions for the ids it is given, skipping ids that no longer exist,
touching nothing else. Both list sites — `GET /v1/skills` and the context
handed to the extension — serve placed Skills by position, then unplaced ones
by name. Code changes: the Host (order + endpoint), the web Skills page
(drag), the generate box (drop its private sort), `MenuItem` (the icon beside
the name), the extension's content script (fetch context again when the tab is
next shown) and worker (rebuild the right-click menu on tab switch, throttled,
and on its five-minute beat).
