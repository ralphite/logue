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
- **Where a check needs an account, it runs in the person's own browser.** A
  clean throwaway profile cannot open Notion or a Google Doc, and "it needed a
  login" is not a reason to skip the check or to swap in a page that does not
  need one. Use the signed-in browser, and inside it stay to what the check
  needs: read, write into the QA Project, delete nothing, send nothing.
- **Checks run on real content, never on a page written to be checked.** The
  little "Draft / Existing text. / Article" page proves nothing: it is short,
  tidy, and shaped exactly like the code expects. Use real articles, real
  Notion pages, real Google Docs, real chat boxes.
- **Prefer Logue's own app, on a long and complicated document.** Mixed
  languages, headings, lists, `[Source n]` citations everywhere, a toolbar
  sitting over the text — that is where wrapping, selection, caret placement
  and overlap actually break. Three tidy lines will never surface them.
- **Notion is part of every check, not a bonus round.** Anything touching the
  browser surfaces is tested in Notion as well — a plain `<textarea>` on a test
  page proves nothing about the editors people actually write in. Notion and
  Google Docs are where a caret, a selection and a paint cycle behave unlike
  anywhere else, and both must pass before something is called done.
- **A screenshot that reports a bug is saved into the repository tree and
  ignored by git**, under `docs/spec/shots/`, and the task cites it by name. It
  belongs next to the task it explains, not in a temporary folder that empties
  itself — and not in the history either.
- **Never ask what can be measured.** A question is only worth the person's
  time when the answer lives in their head — what they want, which trade-off
  they prefer, what counts as good enough. Anything findable by running it,
  reading the code, or timing it is not a question: go and find it. Bring the
  number, say what it means for the decision, and give a recommendation. Where
  something genuinely cannot be measured yet, say what it is expected to be and
  why, so there is something to be wrong about. (Written after "how long does
  transcription actually take?" was put to the person instead of a stopwatch.)
- **Never stop early, never wait to be unblocked.** If something is in the way,
  find another route; a computer is available. When a task genuinely needs an
  answer only the person can give, write the question into the queue and move
  to the next task the same minute — there is always work that waits on nobody.
  Arrange the work so blocking is rare: do the part that depends on no one
  first, and save up questions to ask together rather than stopping at each.
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
- **Commit when a piece is done and checked; push whenever pushing is
  possible.** Work that sits uncommitted cannot be stepped back through when
  something turns out wrong, and one enormous commit is the same problem in
  disguise. If pushing fails — no remote, no network, rejected — say so rather
  than leaving it sitting locally without a word.

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
- **The browser is on the newest extension, and stays there.** Not only in the
  minute after a deploy: it is checked and brought up to date regularly, so the
  answer to "which build am I looking at?" is always "the current one". Copied
  into the install folder is not the same as running in the browser — a tab
  that has been open all day can still be on last week's script, and the person
  finding that out from a bug is the failure this rule exists to prevent.
- **Installers are based on the old ones** — they worked; do not reinvent them.

## The interface

- **Consistency is the floor, not a finishing touch.** The same thing looks and
  behaves the same way everywhere, at every level: page widths and margins;
  section headings and empty states; rows, cards and lists; buttons, inputs and
  menus; icons, spacing, type sizes, colours, wording. Two screens that solve
  the same problem differently means one of them is wrong — the fix is to pick
  one and use it in both, not to leave both. This is checked at every level,
  and nothing built on top of it counts while it is broken.
- **On top of consistency, the interface is held to what good UI design
  actually requires** — hierarchy, alignment, contrast, hit targets, focus and
  keyboard order, states for loading, empty, error and too-much-content,
  wording that says what happens. Audited deliberately and in full, not spotted
  by accident.
- **Follows Notion.** Very simple, very minimal, small spacing everywhere.
- **Progressive disclosure.** Anything secondary is folded away by default.
- **Opening a section opens a new one of whatever it holds.** Clicking Skills
  lands on a new Skill, Documents on a new page, Projects on a new Project —
  ready to type into, not a button offering to make one. The list is already in
  the rail for anything that exists, so a screen whose only message is "pick
  something from the list" wastes the click. Nothing is written until the first
  keystroke. Stream is the exception: its material is captured, never made.
- **An empty section takes up no room.** A heading over "Nothing saved yet."
  spends a screenful saying nothing; it folds to a single line, or it is not
  drawn at all. This does not contradict "an empty section carries the way out
  of it" — that one is about places where a person makes something and would
  otherwise have nowhere to start. A read-out of what is on this page has no
  such door, so when it is empty it gets out of the way.
- **Never introduce a control unless it is needed.**
- **No hand-written CSS** where a utility, token or existing component will do.
  Never a raw hex colour or a magic pixel when a token exists.
- **The product's identity appears once**, in the rail. Everything else on
  screen is the person's own material.
- **Every route has a fixed bar** naming where you are, carrying its actions.
  Actions must not scroll away.
- **Every page is laid out the same way** — same width, same margins, same
  rhythm. Moving between Stream, Projects, Documents and Settings should not
  feel like moving between products. A narrower measure for long-form reading
  is the one allowed exception, and it is chosen deliberately and said out
  loud; a page that differs because nobody passed the argument is a bug.
- **The rail collapses to icons and can be dragged wider, and remembers both**
  across a reload.
- **A control that appears on hover appears when the pointer is anywhere in the
  region it belongs to** — not only when it is already over the invisible
  control. (Asked for after the sidebar's collapse button only appeared when
  hovered directly.)
- **Every text control is a real `<select>` / `<input>`** — no look-alikes.
- **A form never demands a field it does not show.** If something is required,
  it is on the screen being asked for; an error naming a field nobody was
  offered is a dead end, not a validation message. Where the value can wait,
  the form asks for less and the thing gets made.
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
- **⌘K finds anything**; ⌘\ collapses the rail; **⌘⇧L opens the Side Panel and
  closes it again** — one key for both directions, so the panel never needs the
  mouse to be put away.
- **One Find, and it searches everything.** Stream, Projects, Documents,
  Skills — one entry point, not a second Search box above whichever list is
  open. Two controls doing the same job is one too many, and a search that only
  covers the section you happen to be in is not a search.
- **What is open is in the URL** — `/documents/doc_1a2b`. It can be
  bookmarked, sent to someone, reloaded onto, and Back returns to what you were
  reading rather than to the section you were in before it. A link to something
  that has since been deleted says so plainly; it does not draw an editor
  around nothing.
- **No `#` in the address.** A real path, not a fragment: `/documents/doc_1a2b`,
  never `/#/documents/doc_1a2b`. Which means the Host serves the app for every
  one of these paths — typing one in, or reloading on it, lands on that page
  rather than on a 404.
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
- **⌘⇧K opens the Side Panel already recording.** One key, no aiming: the
  panel appears and the microphone is live. **Esc throws the recording away;
  Enter takes it** and puts what was said into the panel's conversation as a
  message. Nothing is sent until Enter — a recording nobody accepted leaves no
  trace.
- **The panel's conversation can call the Skills already configured** —
  translate, file into a Project, and the rest — rather than offering its own
  parallel set of verbs. A Skill is defined once and reachable from everywhere.
- **The conversation runs on an agent we control**, not a single prompt fired
  at a model. What it may read, which Skills it may reach for, and what it does
  with the answer are ours to set.
- **Right-clicking a page offers the Skills that apply to a whole page** —
  "translate to Chinese" and its like — listed by name in the browser's own
  menu. Choosing one opens the Side Panel onto a conversation: first a message
  naming the Skill that ran, then a message carrying what it produced. The
  panel is where an answer about the page is read, and it reads as a thread,
  not as a box that has been filled in.
- **A recording is saved before it is transcribed.** A model failure never
  costs someone what they said — and neither does the Host being off. A
  recording made while nothing is listening waits in the extension and goes in
  the moment the Host answers. The bar says it is kept, not that it failed.
- **A transcript is cleaned, never rewritten.** The fillers, the repetitions
  and the false starts come out; what is left is the person's own wording, tone
  and meaning, tightened only where tightening costs nothing. Nothing is added
  — no sentence finished on their behalf, no plainer word swapped in for
  theirs. Clean-up that changes what someone said is not clean-up.
- **Transcription learns from what has already been said well.** The names and
  special words someone uses again and again stop being misheard: past
  transcripts that proved good — accepted, or corrected by hand — feed the
  vocabulary the next transcription is given. Nothing is learned from a
  recording nobody kept, and a learned word can be seen and taken back.
- **Ten minutes of speech survives.** A long recording is a normal recording:
  no silent truncation, no crash, no quiet drop at some limit nobody mentioned.
- **Past a minute, the surface says so.** A recording that has run over a
  minute tells the person while it is still running, rather than letting them
  find out afterwards.
- **Audio is never lost, at any step.** If transcription fails, the recording
  is still saved and the surface offers to try again — a failed transcript is a
  retry, never an apology in place of what was said.
- **The microphone never gets stuck.** A recorder left behind by a session
  nobody finished is released rather than refusing every recording after it.
- **"Already recording." never reaches the screen, by any route.** Pressing the
  microphone either records or says something the person can act on. A message
  that only describes the extension's own confusion is not an answer, and the
  rule is about the sentence being unreachable — not about one path to it
  having been closed. (Written after it came back once already.)
- **A transcript goes back where the caret was**, even if focus moved while it
  was being transcribed.
- **No Logue surface ever covers what the person is reading or writing.** A
  confirmation sitting on top of the sentence it just inserted hides the one
  thing someone wants to look at. Either it keeps itself clear of the text, or
  it can be dragged out of the way and stays where it was put — and a bar that
  can do neither does not belong on the page.
- **Dictation lands; it is not offered first.** Speaking into a field puts the
  words in the field — no panel holding the transcript behind an Insert button,
  no second confirmation of something already said. Corrections happen in
  place, where the text now is. (The Enter in the ⌘⇧K flow is a different
  thing: there the words are being handed to the panel's conversation, and
  choosing to send them is the point.)
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

## Surviving an update

- **An update leaves nothing of Logue's broken behind.** Reloading the
  extension destroys every content script and every extension page it had
  running, and each surface has to come back on its own: content scripts are
  re-injected into open tabs, and the side panel is re-pointed so Chrome
  navigates it again. A panel frame with Chrome's own "Your file couldn't be
  accessed" inside it is the shape this failure takes.
- **Nothing that a person is in the middle of is interrupted to update.** A
  live recording holds the reload back. Being *idle* is not the same as being
  in use, though: an idle offscreen document once blocked every update for the
  rest of a session, so a surface only defers an update while it is actually
  doing something.
- **A shortcut is bound, not merely declared.** Chrome keeps some keys for
  itself and refuses an extension's claim in silence: the command exists,
  `chrome.commands.getAll()` reports it bound to nothing, and the key does
  nothing forever. (⌘⇧M was ours on paper for months and never once worked —
  it is Chrome's own profile menu on macOS.) Every shortcut is checked against
  what Chrome actually bound, in a real browser.
- **A shortcut that opens something closes it again.** Pressing it over an
  open panel must not do nothing; that reads as a broken key rather than as a
  panel already where you asked for it.
- **A selection can be kept from the right-click menu.** Not every page can
  carry a floating bar, and the context menu is where people reach out of
  habit. It is rebuilt on every worker start, because a reload clears an
  extension's menus and `onInstalled` does not fire for one.

## A recording is never the thing that is lost

- **A long recording looks long.** The bar carries a clock from the first
  second, and past a minute it also says where it will stop — nobody should
  discover a ceiling by hitting it.
- **Ten minutes is the ceiling, and reaching it keeps the audio.** The
  microphone stops itself; the words already spoken stay, waiting to be
  accepted. A recording nobody ends must not grow until something else breaks.
- **Audio is written in slices while it is being spoken**, so a session that
  ends unexpectedly still has everything up to the last second rather than
  nothing at all.
- **A failed transcription says where the recording is.** The audio is written
  before the model is asked, and the id of it comes back with the failure —
  without that the recording is saved and unreachable, which is the same as
  lost. Both "the model refused" and "nothing was heard" offer another try on
  the audio that is already there.
- **What waits offline is bounded in bytes, not in recordings.** Ten
  ten-minute recordings are more than this storage holds; a count alone means
  the quota does the refusing, from somewhere else, about something the person
  cannot see.
- **A page's own Skills are on its right-click menu**, and which Skills those
  are is the Skill's `contexts` — never a second list kept in step by hand.
  Choosing one opens the panel and shows what ran and what came back, in that
  order. The page is kept as a Source first, so the answer stands on something
  that can be followed afterwards.
- **Work that is done and verified is committed, and pushed when it can be.**
  Something that exists only on this machine is one failure away from never
  having happened.
- **A form never refuses for a field it does not show.** A Skill was created
  from a name and the refusal named `instructions` — something with no input
  anywhere on screen, so no Skill could be made at all. A Skill is named
  first and written on its own page; until it has a prompt it is not offered
  anywhere and will not run, and its page says so rather than looking finished.
- **One column, every page.** Same width, same padding, everywhere. A narrower
  column is allowed only where long prose is genuinely read, and only when it
  is asked for and defensible — never because nobody passed a parameter. There
  were four widths at once and not one of them had been chosen.
- **A component's frame can be left off; it cannot be overridden away.** A
  `focus:` variant beats `border-0` at the call site, and a box that
  autofocuses is in focus always — so a "borderless" input drew a permanent
  ring. Where a control sits inside something already framed, it takes the
  variant that has no frame.
- **An empty section takes the room of a line.** Two of them in a 360-pixel
  panel, each with a heading and a block saying nothing was there, reported
  the same absence twice and pushed what did exist off the bottom. The count
  beside the heading already says it: 0. This is not the rail's rule — a rail
  list that is empty must offer a way to begin, because things are created
  from there. Nothing is created from a reading of the current page.
- **Every commit is read before it is made** — each staged file, each diff. A
  file you cannot explain does not go in. The machine gate (check-secrets)
  is the backstop, not the practice; 455 unread files is what the practice
  being absent cost.
- **When there is no model key, a stand-in keeps the flows walkable** — by the
  owner's explicit say-so, and only at the model layer. It is entered like a
  key ("mock" in Settings), it names itself in status and in every answer,
  and nothing verified against it counts as verified until a real key repeats
  it.
- **Text that is a control still gets a finger-sized target.** 24px is the
  floor. Grown with padding and handed back with negative margin, so a
  compact text line keeps its height while the target underneath it does not
  lie about where it can be pressed.
- **A model may touch a document only through a person's accept.** A rewrite
  arrives as decisions — kept stretches and changes with both sides shown —
  each change taken or refused on its own, and Apply lands as an ordinary
  edit the history records like any other. The proposal itself is kept as a
  Run, so "why does it say this now" has an answer later. Decided by the
  owner after the provenance conflict was put to them plainly.
- **The address is a real path, and it tells the truth.** `/documents/doc_1a2b`,
  never `#/...`; a cold load or a reload on any deep link lands on the right
  thing (the Host answers every non-file path with the app). Old `#/` bookmarks
  still resolve, once, and the address is rewritten without the hash.
- **A section with nothing chosen opens on a fresh draft** — `/skills/new`,
  a real editor, nothing saved until the first keystroke (the untouched-draft
  rule). The list is already in the rail; a page that only says "pick from the
  list" made a person click twice for nothing. Stream and Settings are the
  honest exceptions: their content arrives or is configured, it cannot be
  "made new".
- **Two text tiers, everywhere: body 13px, supporting 12px.** There is no
  third size — the 11px tier (`--text-meta` and every `text-[11px]`) was one
  decision spread across two spellings, and pages drifted a size apart. The
  document editor's own typography is the exception; interface text is not.
  Likewise one grey: `faint` was 3 RGB points from `muted` — a distinction
  that existed in code and nowhere on screen — so `muted` is the only one.
- **A word is learned from a decision, never from a transcript.** Corrections
  are learned outright and keep their reason in words; proper nouns written by
  hand three times or more, that no transcript has produced, are *suggested*
  and wait for approval; anything whose only source is a transcript is never
  learned — a name misheard ten times appears ten times, and frequency would
  make the mistake permanent. Every learned word shows why it is there and can
  be taken back. Two layers in the prompt: the global list, then a Project's
  own vocabulary, which wins.
- **⌘⇧K opens Logue and starts listening, as one act.** Not open-then-reach-
  for-a-microphone. Esc cancels and leaves nothing behind; Enter accepts and
  the words become your own message in the panel's conversation — the same two
  keys as the bar on the page, so nobody learns a second set. The panel may
  not be open when the key is pressed, so the intent is left where the panel
  finds it on arrival, and consumed on read: re-opening later never starts a
  recording nobody asked for.
- **The agent reads freely and asks before it writes.** Finding Sources,
  reading the page, running a configured Skill change nothing, so they happen.
  Saving a Source, filing into a Project, drafting a document change the
  workspace, so the agent may only *propose* them: the proposal waits in the
  conversation with Do it / Leave it, and nothing is written until a person
  clicks. **Every step it took is listed above its answer, in words** — an
  agent that quietly did three things and reported one would be worse than no
  agent. Answers carry live `[Source n]` citations like every other output.
  Typing and speaking reach the same conversation; two ways to ask one
  question, with answers that did not know about each other, was the bug.
