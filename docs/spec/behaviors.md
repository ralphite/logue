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
- **Verify in a real browser, against the real Host and a real model.** Unit
  tests are necessary and never sufficient. No mocks standing in for a run.
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
- **Wherever a Source is listed, the page it came from is a link.** Every
  screen, every list, including the Side Panel and the Sources under a
  Document. Printing the domain as dead text makes people go and find it by
  hand. Clicking the link must not also open the row.
- **⌘K finds anything**; ⌘\ collapses the rail.
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
- **Google Docs must work.** It is not optional.
- **A recording is saved before it is transcribed.** A model failure never
  costs someone what they said.
- **A transcript goes back where the caret was**, even if focus moved while it
  was being transcribed.
- **The microphone is never offered in a password field.**

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
