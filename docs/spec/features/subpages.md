# Subpages — `/page`, and the block a page link draws

Declared 2026-08-19 from his ask (*"add slash page for subpage creation and
rendering support similar to notion's"*), tightened the same day by his two
bugs (*"should not be untitled"*, *"new page should be focused for editing"*)
and a three-reviewer pass.

## What it is for

A page grows pages inside it without leaving the editor — Notion's one-verb
version of "make a child and link it here".

## The surface

- The `/` menu row: label `Page`, hint `[]()` — the hint column is always the
  Markdown a row writes. Absent on a draft, where there is no document to be
  the child of yet.
- Choosing it: the child is created under the open document, the link lands
  where the `/` was — `[Untitled](/documents/doc_…)` on its own line — and
  the child opens with the caret in it, ready for its name. A Host that
  refuses says why in a note at the top of the page; the typed `/page` stays.
- On every line the caret is not in, a link of that shape draws as a page
  block: outline page glyph, the page's name, `aria-label` `Page <name>`.
  Press (or Enter — it is a button) to open. The caret entering the line
  shows the raw link, like every other mark.
- The name drawn is the child's current name from the workspace list, redrawn
  when the list moves; the stored text stands in until the list is known.

## The model

- Stored form: a plain Markdown link, `[name](/documents/doc_id)`. Nothing
  that only this editor can read.
- The link text is a **cache of the page's name**. Renaming a page rewrites
  links wearing its old name — or `Untitled`, the birth text — across the
  workspace, one level deep and no further (two pages naming each other in
  their first lines would otherwise chase each other forever). Text somebody
  chose (`see [my notes](…)`) is not a cache and stays.
- Leaving the parent for the new child flushes the working copy first, and a
  refused flush keeps the person on the parent with the conflict notice —
  nothing that replaces the working copy loses it.

## What it costs, said plainly

- The link and the page are two things: deleting the link line does not
  delete the page (it stays in the list, where pages live), and a create
  whose link never landed leaves an Untitled page in the list. ⌘Z cannot
  take the pair back — the insert happened in one document and the caret is
  now in another; undoing by hand is delete-the-line, delete-the-page.
- A link to a deleted page draws like any other until pressed; the press
  lands on the plain "no longer exists" pane.

## What it must never do

- Lose the words typed around the link when the child opens.
- Freeze a page's dead name into the text or the export once the page has a
  real one.
- Rewrite link text the person chose.

## Open questions

- "Page" (this menu, the list rows, "New page inside this one") and
  "Document" (the rail, "New Document") are two names for one thing across
  the product. This feature follows Notion's word; the rail keeps its old
  one. Say which noun wins and the rest follows.
