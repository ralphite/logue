# Document versions — a working copy over saved states

Declared 2026-08-19 from his design (verbatim in cc `F8`), built the same day.
The review ran against this declaration and the shipped code together.

## What it is for

A person edits without thinking about history; history exists only where
somebody — them, or an agent — chose to keep a state, and nothing an agent
does can cost them their words.

## The model

- The **working copy** is the document: always there, always editable.
- A **version** is immutable, numbered `v1, v2 …`, and carries who saved it
  (`user` or `agent`), an optional label, and a model-written line.
- The **base** is the newest version — what the working copy grew out of, and
  what a save is compared against.
- Saving with no difference against the base does nothing, and says so.
- Restore fills the working copy from a version; it deletes nothing, and
  saving afterwards writes a new version. Anything that replaces the working
  copy wholesale saves unsaved edits first (the API takes `discard: true`
  when the person explicitly chooses to drop them; no surface offers it yet).
- An agent works from a fixed base (`begin`, which saves the person's unsaved
  edits as a user version first) and lands whole (`commit`): applied as an
  agent version when the working copy still reads as the base, held as **one**
  pending change beside the document when it does not, no version when its
  output matches the base. *Any* movement of the working copy counts as a
  conflict — there is no merging, per the design's own closing note. The
  newest result owns the one pending slot: a newer commit replaces a waiting
  one, and an applied commit clears it. Failure or cancellation is a commit
  that never arrives — nothing half-done.
- An agent's `append` needs no base — it cannot overwrite — but keeps the
  same two promises: the person's unsaved words become a user version first,
  and the addition lands as an agent version.
- Versions count `v1, v2 …` per document. Rows filed before 2026-08-19 under
  the old edit counter are renumbered into that sequence once, at startup.

## The surface

**Page header** (documents only; the strip under the page is gone —
2026-08-19, his instruction: *"section below doc should be removed … move as
two buttons in header"*):

- `History` — opens the history dialog, beside Export. Tooltip: `Every
  version of this document`.
- `Save version` — the save, beside it. Tooltip: `Save the working copy as a
  version`, with `⌘S` in the Tooltip's own `keys` slot. After a press the
  button reads `Saved as a version` or `No changes to save`, until the next
  keystroke or a different text loads under the editor; while it runs its
  icon is the spinner. A press that fails says so in a note at the top of
  the page.
- ⌘S inside the editor is the same act; the browser's save dialog never
  answers. The autosave still runs on a pause — it just no longer captions
  itself.

**History dialog** (title `History`):

- Top entry: `now` · `As saved` when the working copy matches the base,
  `Unsaved changes` when it does not. No chip — `now` is the whole fact.
- Version rows: `v<n>` · the model's line, or `Summarizing…` while it is
  being written · time ago · `+a −r` counts · an `agent` chip on agent
  versions and none on the person's. Where no model answered, the counts
  alone carry the row — his ruling, 2026-08-19: *"计数行去掉只留徽标"* —
  and stored counted lines from before are stripped from the answer the
  same way. The one save the counts cannot see says `Formatting only`.
- A row opens its diff against the version before it, titled `v<n>` — the
  top row's is titled `Now`; `No visible change.` when only markup moved.
  `Go back to this` restores; `History` returns to the list.
- Note under the list: `Going back keeps every version; unsaved changes are
  saved first.`
- Loading: `Reading` with a spinner. Failure: the error note, list stays.

**Pending change** (only while an agent result waits):

- The page's list row wears a `review` mark (tooltip: `An agent change is
  waiting`), stepping aside when the pointer brings the row's own actions
  in — so a waiting change can be seen without opening every page. Interim
  spot, his word, while the rows are being redesigned.

- Banner over the editor: `An agent finished a change while you were editing.
  Nothing was overwritten — review it to apply or discard.` with one `Review`
  button.
- Dialog (title `Agent change`): the diff of applying it to the working copy
  as it reads now; `No visible change.` when they match. Note: `Applying
  keeps every version; unsaved changes are saved first.` — the history
  dialog's promise, in its words. Buttons: `Discard` · `Apply`.
- Apply replaces the working copy and lands the agent version; Discard drops
  the result and touches nothing. Both close the banner.

**The outside agent** (`logue.py`, words an agent repeats to the person):

- Applied: `Applied as v<n> (agent version) — <link>`.
- Unchanged: `No change against the base; no version was written.`
- Outrun: `The person edited this document while you worked. Nothing was
  overwritten; your result is waiting on the document for them to apply or
  discard.` — then, on its own line and marked as the agent's instruction:
  `(Report that and stop — do not try to force the change in.)`
- Appended: `Appended, as an agent version. Now revision <n> — <link>`.
- `read` header gains `pending: an agent result is waiting for the person's
  review` while one waits.
- `--label` is shown by `versions` only; the person's History shows the
  written line instead, and the help text says so.
- `versions` lists `now … working copy — as saved | unsaved changes`, then
  `v<n> <author> <time> <line> [<label>]`.

**Host refusals** (reach screens verbatim):

- Stale read, one wording for edits and begins alike: `This document has
  moved on to revision N; you read revision M. Read it again.`
- Foreign base: `That base version does not belong to this document. Begin
  again.`
- No pending: `There is no agent change waiting on this document.`
- Bad author: `author can be user or agent`.

## The rhythm

- Typing autosaves the working copy on a ~1s pause, as before. **No version
  is ever written by time or by typing** — the one-per-sitting autosave
  versions are gone.
- A version is written by: the footer save / ⌘S; an agent's begin (the
  person's unsaved edits), commit, append, or apply (theirs, then the
  agent's); a restore with unsaved edits; a generation or agent creating a
  document with content (`v1`, agent).
- The banner appears through the existing 1.5s change poll — never over
  unsaved words, never reordering the person's list (`updated_at` untouched).
- The version's line is written by a model after the save answers, never in
  front of it; the counted line stands in when no model can.
- A write that replaces the text under the editor — a restore, an applied
  agent change, the panel appending — leaves the caret where the person
  left it, clamped to the new end. An automatic write takes nothing.

## The model's part

Unchanged: the summary prompt in `summaries.py` (≤60 characters, the
document's language, describes the change not the content). New versions feed
it the diff against the version before, which is now exactly what that save
changed.

## What it must never do

- Lose or silently overwrite the person's words — the failure this whole
  design exists to prevent.
- Mint two versions saying the same thing, or a version from an agent that
  changed nothing.
- Leave a half-applied agent change, or apply one over a working copy that
  moved.

## Open questions

- The one-slot pending change: a newer agent result replaces an unreviewed
  older one, and an applied commit clears it. Say the word and a second
  commit becomes a refusal instead.
- ~~Where should a waiting change surface beyond the open page?~~ Ruled
  2026-08-19: *"pending 在列表行加个标记吧,等 redesign 定了再说"* — the
  `review` mark above, to be revisited when the row redesign lands.
- ~~Should the counted line yield to the `+a −r` chips?~~ Ruled the same
  day: *"计数行去掉只留徽标"* — done, including stripping the stored ones
  from the answer.
