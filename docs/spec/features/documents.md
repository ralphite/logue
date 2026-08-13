# Documents — declaration

Status: **declared, under review** (first pass 2026-08-12). Covers the
Documents route, its editor, autosave, and the history dialog.

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

- Header: the title, editable in place. Actions: `Rewrite`, `Export`,
  `History`.
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

**The title** (`documents.NAMING`) — names a document nobody has named, once.
Never renames one a person has named.

**The rewrite** (`documents.REWRITE`) — returns only the rewritten passage,
proposed as hunks. Nothing is written until the person accepts.

## What it must never do

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
