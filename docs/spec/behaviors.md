# Behaviours asked for, and why

Every exact behaviour the person who uses this product has asked for, kept in
one place so a rewrite cannot quietly drop it. A rebuild is allowed to change
how something is built; it is not allowed to change what is written here
without being asked.

Add a line the moment a behaviour is requested — not after it is built. Each
entry says what must be true, not how it is done, so it survives the next
rewrite too. If an entry is ever deliberately changed, edit it and say when.

## Working agreement

- **A new request goes into the task queue, not in front of the current work.**
  Write it down, keep going, finish what is in hand. Interrupting the thread to
  chase each new ask leaves everything half-built. The exception is something
  actively broken for the person right now.
- **The queue lives in the repository**, in [tasks.md](tasks.md). A list that
  exists only in a session is one crash from being lost, and this one has been
  lost before. Every new request is written there the moment it is made, before
  any work on it — a request that lives only in a reply is not queued.
- **Verify in a real browser, against the real Host and a real model.** Unit
  tests are necessary and never sufficient. No mocks standing in for a run.
- **A screenshot that reports a bug is saved into the repository tree and
  ignored by git**, under `docs/spec/shots/`, and the task cites it by name. It
  belongs next to the task it explains, not in a temporary folder that empties
  itself — and not in the history either.
- **Never stop early, never wait to be unblocked.** If something is in the way,
  find another route; a computer is available.
- **Start the next task the moment the last one is done.** Do not stop to
  report, do not wait to be told to carry on. Report when there is something
  worth reading, not between every item.
- **Work in parallel where the work is independent.**
- **No TDD.** Tests pin the rules that would silently corrupt data, and the
  contracts the UI reads. Not every line.
- **Default to keeping a feature.** Remove only what is clearly unnecessary,
  and say so first.
- **Do not add back a removed feature without asking**, even an obviously good
  one.
- **Ask in Chinese, answer in Chinese.** Code, identifiers, paths and product
  nouns stay as they are.
- **Verification writes into the "Logue QA" Project, tagged `qa`, and deletes
  nothing.** A check that borrows a real record puts it back exactly.

## The machine

- **One version, everywhere.** One copy of the code in the repository, one
  Host running, one extension installed. A deploy retires what came before it
  rather than adding to it — no `releases/` to grow, no second login item, no
  archived tree kept "just in case" (git already keeps it).
- **Installed and running, so it can be checked at any moment.** The Host is a
  login item that restarts if it stops, and it serves the app itself at
  `http://127.0.0.1:8787`. Needing a terminal window left open means the
  product is not actually installed.
- **The Host listens on loopback only.** Never `0.0.0.0` — the workspace has no
  password.
- **There is one address for the app**, the one the Host serves. A dev server's
  port is for building, never the address anything hands to the person or opens
  on its own.
- **Installing Logue adds no permission prompt to anybody's page.** A browser
  asking to "access other apps and services on this device" on an ordinary
  article is not something the extension may cause.

- **One version of the extension on this machine.** No `releases/` directory
  that grows. Deploy swaps the contents of one folder in place.
- **The Host is always running the build that is installed**, and restarts onto
  it automatically.
- **The browser catches up by itself.** Nobody visits `chrome://extensions`
  after a deploy.
- **Installers are based on the old ones** — they worked; do not reinvent them.

## The interface

- **Follows Notion.** Very simple, very minimal, small spacing everywhere.
- **Progressive disclosure.** Anything secondary is folded away by default.
- **Never introduce a control unless it is needed.**
- **No hand-written CSS** where a utility, token or existing component will do.
  Never a raw hex colour or a magic pixel when a token exists.
- **The product's identity appears once**, in the rail. Everything else on
  screen is the person's own material.
- **Every route has a fixed bar** naming where you are, carrying its actions.
  Actions must not scroll away.
- **The rail collapses to icons and can be dragged wider, and remembers both**
  across a reload.
- **A control that appears on hover appears when the pointer is anywhere in the
  region it belongs to** — not only when it is already over the invisible
  control. (Asked for after the sidebar's collapse button only appeared when
  hovered directly.)
- **Every text control is a real `<select>` / `<input>`** — no look-alikes.
- **A long line wraps; it never widens the page.** No screen grows a
  horizontal scrollbar at any window width. A grid item that refuses to shrink
  below its content is the usual cause, and the rule is set once in the theme
  rather than remembered at each new grid.
- **Wherever a Source is listed, it is one click from where it lives** — the
  Stream. A citation you cannot follow is a dead end. This holds for a Run in a
  list too: the row opens the answer, and its Source count opens those Sources.
  A row that prints "28 Sources" as dead text is the same dead end.
- **Wherever a Source is listed, the page it came from is a link.** Every
  screen, every list, including the Side Panel and the Sources under a
  Document. Printing the domain as dead text makes people go and find it by
  hand. Clicking the link must not also open the row.
- **⌘K finds anything**; ⌘\ collapses the rail.
- **One Find, and it searches everything.** Stream, Projects, Documents,
  Skills — one entry point, not a second Search box above whichever list is
  open. Two controls doing the same job is one too many, and a search that only
  covers the section you happen to be in is not a search.
- **What is open is in the URL** — `#/documents/doc_1a2b`. It can be
  bookmarked, sent to someone, reloaded onto, and Back returns to what you were
  reading rather than to the section you were in before it. A link to something
  that has since been deleted says so plainly; it does not draw an editor
  around nothing.
- **The rail's list is flat, and it has no headings at all.** A Source belongs
  to several Projects at once, so a folder for one of them hid it from the
  rest. Pinned items simply sit at the top; "Pinned" and "Everything else" as
  printed labels say what the order already says. (Asked for after the two
  headings appeared above a twelve-row list.)
- **The rail's list is never truncated.** No "9 more" to expand — everything
  the section holds is listed, and the scrollbar is how a long list is read.
- **Every rail row carries its kind on the left**, in a fixed slot, so the
  whole rail is one column of icons with words beside them — and the kind is
  the one fact every row has exactly one of.
- **No mark without a word.** A bare coloured dot, or an icon standing alone
  for something like "groupings Logue noticed", tells nobody anything. Either
  it says what it means or it goes.
- **A section's list lives in the rail, under that section** — the way
  chatgpt.com and Codex do it. Clicking Stream, Projects, Documents or Skills
  opens its list below the nav item; the main area shows only the one thing
  selected, not the list again.
- **A competitor's feature list is a menu, not an order.** Take what earns its
  place and drop the rest. The bar is minimal and immediately obvious, not
  complete. Two controls that do the same thing is one control too many.
- **Icons in the rail sit on one vertical line, and that line does not move
  when the rail collapses.** An icon that jumps sideways on collapse makes the
  two states read as two different apps.
- **New things are made from a `+` that appears on hover**, on the section that
  will hold them — not from a permanent button taking a row of its own. Every
  section that can make one has it; a section that cannot says why in its empty
  state instead of leaving a gap where the control would be.
- **Nothing is written until it is meant.** A new Document, Skill or Project
  that has never been touched is not in the workspace. Pressing `+` five times
  leaves one draft, not five empty rows.
- **An empty section carries the way out of it.** A hover-only `+` is useless
  when there is no list to hover near.
- **Hover reads above selected.** The chosen row still answers the pointer —
  one that stops responding once chosen looks disabled. And choosing a row does
  not leave its actions showing: clicking leaves focus inside the row, which
  kept the `⋯` pinned open long after the pointer had gone.
- **A hover card can be moved into.** A preview you cannot reach is one you
  cannot read to the end, select from, or scroll. The gap between the row and
  the card is bridged, and leaving the row waits a moment before closing.
- **The nav and the list it opened are separated by a line**, so the five
  destinations do not read as the top of the list.

## In the browser

- **The voice button appears next to the cursor** in an editable document, not
  parked in a corner. Verified on Notion.
- **Exactly one Logue surface is on screen at a time.** A selection means the
  selection toolbar and nothing else — the input bar does not sit under it.
- **A tab never keeps running a build that has been replaced.** After a
  background update the surfaces are put back on every open page, and if that
  cannot be done it is written down rather than passed off as done. A content
  script that outlives its extension removes itself instead of drawing bars
  whose buttons reach nothing.
- **Google Docs must work.** It is not optional. It is confirmed on a Google
  Doc created for that check, never on one already open — a page carrying a
  content script from an older build reports on that build, not this one.
- **The Side Panel must work, and v1 is what it must do.** v1's panel is the
  reference for its behaviour: read it out of the history and match it item by
  item, rather than inventing a replacement. A rebuild may change how the panel
  is built; what it does for the person was already settled.
- **A recording is saved before it is transcribed.** A model failure never
  costs someone what they said — and neither does the Host being off. A
  recording made while nothing is listening waits in the extension and goes in
  the moment the Host answers. The bar says it is kept, not that it failed.
- **The microphone never gets stuck.** A recorder left behind by a session
  nobody finished is released rather than refusing every recording after it.
- **A transcript goes back where the caret was**, even if focus moved while it
  was being transcribed.
- **The microphone is never offered in a password field.**

## Documents

- **A document names itself until someone names it.** The title follows the
  first line while nobody has claimed it; when the body is left alone a model
  writes a real one, once. After a person types a title, nothing changes it —
  not the first line, not a model, not a second attempt at the same model.
- **Every version of a document can be read back and gone back to.** Going
  back is written forward as a new version; the ones it skipped over survive.
- **Each version says what it changed, in words.** A model writes the line
  after the save, never in front of it — autosave is a pause someone can feel.
  Where no model can answer, the counted line stands in; a history row that
  says nothing at all reads as a broken row.
- **A Skill's prompt has the same history, reached the same way.** The
  revision number on the Skill page opens it; every past prompt can be read,
  diffed and gone back to. Going back is a new revision, so the numbers Runs
  recorded keep pointing at prompts that exist. No model writes summary lines
  here — a person edits a prompt by hand and the diff is the story.

## Provenance — the part that cannot bend

- **Web evidence, what you said, and what a model produced never look alike.**
- **Anything generated points back at what it came from.**
- **A Run freezes its Sources and the exact Skill revision it used**, so it
  stays explainable after the prompt changes.
- **A quote keeps the passage around it**, so a citation can be read in context
  after the page changes.
- **How a transcript was heard is recorded with it** — profile, language,
  terms, Skill revision, the instructions actually sent.
- **Nothing is filed into a Project without a person saying so.** A suggestion
  is a suggestion however confident the model claims to be.
- **What became of an answer is recorded** — kept, inserted, copied, made into
  a Document — and undoing it says so rather than erasing it.

## Data

- **Nothing the person made is deleted to make the code simpler.** A grouping
  they renamed, a tag they wrote, a transcript they corrected: all theirs.
- **A second writer is refused, not silently overwritten.**
- **The Host answers only Logue** — an extension, or a page on this machine.
