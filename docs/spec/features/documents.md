# Documents — declaration

Status: **declared, under review** (first pass 2026-08-12; rewritten
2026-08-13 for the change below). Covers the Documents route, its editor,
autosave, and the history dialog.

## What changed on 2026-08-14 (F3)

His words: *"doc editing must support wysiwyg for markdown. see vibedoc, must
support features there. also use vibedoc's way for doc version mgmt … we
should also allow nested docs. like vibedoc … ux should be similar to notion"*

1. **The editor reads as the document it is.** GitHub Markdown, so tables,
   task lists, strikethrough and bare links are understood; a task box is a box
   you press; an image is the image; a table and a fenced block are blocks. `/`
   on an empty line opens the block menu — the one Notion habit that transfers
   to Markdown without pretending to be something else, because what it writes
   is Markdown. ⌘-click follows a link.
2. **Versions the way vibedoc does them.** The document is a working copy that
   autosave writes freely; a *version* is a state you can go back to. One per
   sitting, one whenever a person presses **Keep this version**, and never two
   saying the same thing — each carries a hash of what it holds, so going back
   to what a version already says does not mint another. A version a person
   marked says so in the history.
3. **Documents nest.** Each one carries `parent_id` and its `position` among
   its siblings, and the tree is assembled when it is read — vibedoc's shape,
   because a list of children on the parent is the same fact in two places and
   they disagree the first time a move half fails. Deleting a page moves its
   children up into its place; nothing can be moved inside itself.

## What changed on 2026-08-13

His words: *"一个 document 不应该有一个 title 和内容的 section。你参考一下
Google Doc，我们并没有专门的一个 title，它就是这个文档的第一行… 我们需要真的
支持 Markdown。现在是真的支持 Markdown 吗？为什么我们并没有所见即所得的
Markdown 编辑？你应该参考我们另外一个项目，叫 Vibedoc 的项目"*

1. **There is no title field.** A document is one piece of text and its name is
   the first line of it, the way a Google Doc's first heading is.
2. **The text is Markdown, and it is edited as it will read.** Headings are
   large as you type them, bold is bold, a list is a list. What is stored is
   Markdown, not HTML — the export, the diff and the model all read the same
   thing the person sees.

Both follow the editor in `~/dev2/prototypes/vibedoc` — CodeMirror with the
Markdown grammar, styled in place — with one thing added: the markup on a line
the caret is not on is hidden, so `## Tuesday` reads as **Tuesday** until you
put the caret in it.

## What it is for

A place to write, where everything generated from your own material can be
kept and edited, and where nothing you wrote is ever lost.

## The surface

**The list** (left pane, `Documents`)

- Each row: the title, or `Untitled`; below it, `N sources` when the document
  was generated from material, `written by hand` when it was not; the time it
  was last changed, on the right.
- Empty: `No documents yet.`

**The editor** (right pane)

- Header: the document's name — **read only**, taken from the first line.
  Actions: `Rewrite`, `Export`, `History`.
- The text: one Markdown editor, nothing above it. Empty, it shows
  `Start writing. The first line is the title.`
- **What is styled while you type**: headings (six levels), **bold**,
  *italic*, `inline code`, fenced code, quotes, links, bulleted and numbered
  lists, and `- [ ]` task boxes.
- **The markup hides itself.** On the line the caret is in, the characters are
  there to edit. Everywhere else `#`, `**`, `` ` `` and the rest are hidden and
  only their effect is left. A selection spanning a line counts as being in it.
- `Rewrite` acts on a selected passage. **With nothing selected it is
  disabled**, and its tooltip says `Select a passage first`.
- Status line under the header, one of:
  - `Not saved yet` — a new document nobody has typed into.
  - `Saved <time ago>` — after a save in this sitting.
  - `version N` — otherwise.
  - `This document changed somewhere else. Your edits are still here, unsaved.`
    — a second writer was caught; autosave has stopped.

**The history dialog**

- One row per version, newest first: `vN`, the line saying what changed, the
  time, and `+a −r`. The current text is the top row, marked `current`.
- The line is a model's, in the same register as a commit subject. While it is
  being written: `Summarizing…`. A version that changed no visible line has no
  line — the row reads `Edited`.
- Footer: `Restoring writes a new version.`
- Opening a row shows its diff. When nothing visible changed: `No visible change.`

## The rhythm

- **The name follows the first line, always.** It is computed where the text
  is stored, so every list, link and export agrees with what is on screen.
  Markdown markers are taken off it — `# Tuesday` is called `Tuesday` — and it
  stops at 50 characters. A document with nothing in it is `Untitled`.
- **Renaming is editing the first line.** There is nothing else that renames a
  document: not a person typing in a field, not a model. The three-way
  `title_state` and the "let a model name it once" step are both gone with the
  field they existed for — a name the model invented would be a name that is
  not in the text, which is the thing being removed.
- **A document written for you starts with its name.** A generation or the
  agent writes `# <the name it was given>` as the first line, so the name it
  was given is in the text where it can be edited like any other line.
- **Autosave** fires 900 ms after typing stops. It writes the text; it does
  **not** mint a version per save.
- **A version is one sitting, not one save.** Saves less than 15 minutes apart
  share one version row, and its summary is re-asked so it describes the whole
  sitting. Returning after a break starts a new one.
  - *Why:* the person types one sentence and expects one entry. Per-save
    versions produced `v2..v7` from a single line, which is not a history.
  - The `revision` counter still increments per save — it is the concurrency
    check between two editors, not the thing the history shows.
- **A new document is born at the first keystroke**, not when `+` is pressed,
  so opening and walking away leaves nothing behind.
- **Restore is written forward** as a new version; the versions it skipped
  stay.

## The model's part

**The version line** (`summaries.INSTRUCTIONS`)

- Shown as the version's only description. Spec: **one clause, ≤ 60
  characters**, in the register of a commit subject — what changed, in the
  document's own terms.
- Forbidden: describing the edit mechanically (`added a character`), narrating
  the diff, quoting counts (the `+a −r` beside it already says that).
- Good: `sharpened the opening paragraph` · `added the pricing table`
- Bad: `added a character to the text` · `no visible change` · `+1 −1`
- **Not asked at all when no visible line changed** — the row says `Edited`.
  A model must never be paid to say nothing happened.

**The title** — no longer a prompt. The first line is the title, so there is
nothing for a model to name.

**The rewrite** (`documents.REWRITE`) — returns only the rewritten passage,
proposed as hunks. Nothing is written until the person accepts.

## What it must never do

- Lose a name that was already there. Documents written before this change
  keep theirs: where the stored name is not already the first line, it is
  written into the text as `# <name>` when the workspace is converted, once,
  with a count printed.
- Show Markdown as a wall of `#` and `- `, or store HTML the person never
  wrote. One format, and it is the one that is exported.
- Lose text. Every version is kept; restore never truncates the tail.
- Overwrite a second writer silently — the 409 stops autosave and says so.
- Mint a version the person did not perform.
- Show a line that describes the mechanism instead of the change.

## Open questions

1. Three documents named `Logue QA — V7 rewrite` exist because each generation
   makes a new one. Should a repeat generation into the same Project offer to
   replace, or keep making new documents?
2. Should a sitting close early when the tab is closed, so reopening tomorrow
   is certainly a new version?
