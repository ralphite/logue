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
- **A design is reviewed by three agents before it is built, not only after.**
  (2026-08-13: *"review feature design with subagent (always). review ext panel
  design. too many issues"*.) The same three questions — does every string say
  a fact, does the rhythm make sense to a person, does it match what was
  approved — asked of the proposal and the mock while changing them is still
  cheap, and asked again of the code. Findings are verified on the running
  product before they are acted on; nothing is dismissed silently.
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
- **When a sentence has two readings, ask which one.** Not everything
  ambiguous can be settled by going and looking: if two readings lead to two
  different pieces of work, stop and ask rather than picking the convenient
  one. Guessing wrong costs either the work itself or something that was
  already right. This does not soften "never ask what can be measured" — those
  answers are gone and fetched; this is about what only the person knows.
- **Never stop early, never wait to be unblocked.** If something is in the way,
  find another route; a computer is available. When a task genuinely needs an
  answer only the person can give, write the question into the queue and move
  to the next task the same minute — there is always work that waits on nobody.
  Arrange the work so blocking is rare: do the part that depends on no one
  first, and save up questions to ask together rather than stopping at each.
- **"Blocked on him" is almost never real. Build it, and batch the reviews for
  the end.** (2026-08-14, his words: *"我们之前没有被 blocked，各种任务都应该去
  做，先把这些全部做完。后续做完之后，我们再一个个 review，包括需要我给你提供细
  节，或者需要我 review 的一些任务"*.) A task waiting on his taste, his details
  or his sign-off is not parked — it is done under a stated assumption, and the
  assumption is written on the task so the review afterwards knows what to
  check. One review pass over finished work replaces many small questions in
  front of unstarted work. This narrows "拿不准就先问我" to what it always
  meant: ask when two readings produce two different *builds*, not to get
  permission to start.
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
- **A check may not take away what it cannot put back.** (2026-08-13: a check
  wrote `api_key: "mock"` over the owner's real key and "restored" the same
  word. It passed.) Nothing hands a key out — that is deliberate — so nothing
  may write one. Where a check cannot restore what it would change, it prints
  why and skips that half rather than running quietly.
- **A design proposal is reviewed by an independent agent before it is shown,
  not only the code once it lands.** (2026-08-13, his words: "review feature
  design with subagent (always)".) The three questions in
  [review-process.md](review-process.md) — plain copy, sane rhythm, faithful
  to what was approved — apply to a mock and a written plan as much as to
  shipped code, because a mistake caught in a plan costs a rewrite of a
  document and a mistake caught after costs a rewrite of the feature.
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
- **Where the Host listens is chosen at install time, and defaults to this
  computer.** Changed 2026-08-10: it used to read "loopback only, never
  `0.0.0.0`". The workspace still has no password, so anything wider than
  loopback is a decision a person makes with a firewall, a VPN or a tunnel in
  mind — the installer asks, and says so.
- **The extension talks to whichever Logue it is told to.** One address is
  right until the Host is published — a tunnel, another computer on the desk —
  and a hard-coded one cannot be fixed from inside Chrome. The address is a
  setting in the panel, because the app's own Settings live behind the very
  Host being named. It is tried before it is kept: an address nothing answers
  at is refused with the reason, and the working one stays.
- **There is one address for the app**, the one the Host serves. A dev server's
  port is for building, never the address anything hands to the person or opens
  on its own.
- **One command installs Logue and leaves it running.** The Host, the app and
  the Extension come from one release, resolved once, and the service is up
  when the command returns. Two commands meant a machine could end up with a
  Host and no Extension, and the half that is missing is the half that cannot
  tell you it is missing. What is left for the person is what Chrome will not
  let a script do: Load unpacked.
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
- **A conversation belongs to the page it is about.** Asking about one page
  and then moving to another does not carry the answers along — the new page
  starts clean, and coming back brings its own conversation with it. One shared
  thread across every page puts unrelated questions under each other and calls
  it a history.
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
  A row that prints "28 Sources" as dead text is the same dead end. **The link
  goes to the Stream, not out to the web page the material came from** — the
  Stream entry is where the recording, the passage and everything derived from
  them sit together, and the original page is reachable from there. (Changed
  2026-08-09: an earlier rule required every listed Source to link out to its
  originating page. He asked for that to go — "we don't need it. we should link
  to stream".)
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
- **On Google Docs, voice goes to the caret and that is all.** No selection
  toolbar, no selection Skills there. Not because it cannot be done — it can:
  with screen reader support on, the selected text is readable from the hidden
  `docs-texteventtarget-iframe` (same-origin, `about:blank`), measured
  2026-08-09 on a real document. It is not built because he decided against
  spending it. Recording that here so nobody researches the same ground twice
  and concludes it is impossible.
- **The Side Panel must work, and v1 is what it must do.** v1's panel is the
  reference for its behaviour: read it out of the history and match it item by
  item, rather than inventing a replacement. A rebuild may change how the panel
  is built; what it does for the person was already settled.
- **⌘⇧K opens the Side Panel already recording.** One key, no aiming: the
  panel appears and the microphone is live. **Esc throws the recording away;
  Enter takes it** — and, from 2026-08-13, taking it means the words land in
  the composer, not that they are sent. (Changed by his request below; until
  N13 ships, Enter still sends.) Nothing is kept until Esc or Enter is chosen —
  a recording nobody accepted leaves no trace.
- **The panel is one list and one input box.** (2026-08-13, his request — see
  [panel-composer.md](panel-composer.md).) No verb row, no second input box, no
  tabs, no separate sections for transcripts, chat, kept passages and queued
  recordings. Everything the panel knows is one stream of records; everything a
  person can put in goes through one composer.
- **Speaking fills the box; it does not send.** The recording bar offers three
  things and no more: **✕ throw it away**, **✓ turn it into text in the box**,
  **↑ turn it into text and submit**. Enter is ✓, ⌘Enter is ↑, Esc is ✕. Words
  land at the caret and never overwrite what is already typed, so one message
  can be spoken in several goes with typing in between. Submitting is always a
  separate, deliberate act.
- **The page is the default scope; a selection narrows it.** Selecting text on
  the page puts that passage into the composer as a Markdown quote, with the
  anchor it was taken from, so what is written about it can be found back on
  the page later. Clearing the selection returns the scope to the whole page.
- **Submitting says what the thing is.** One box, but the person chooses the
  mode before they submit: **Comment** — keep it, nothing answers; **Question**
  — answer it out of their own material. (2026-08-13, his words: "你提交的时候,
  你可以选比如说你提交的是做什么的,比如说你这是一个 comment,问一个问题,需要
  回答,基本上就是几个不同模式吧".) The mode changes what happens after the
  submit, never the box itself, so changing one's mind costs a chip and not a
  retype. The mode is visible while recording too — nobody presses submit not
  knowing what it will make.
- **Nothing asks in advance which Document a recording goes into.**
  (2026-08-13: "记进某个文档这个叙述,什么叫记进某个文档我不太清楚.") A control
  the person cannot read is a wrong control, and it is removed rather than
  explained. Filing happens on its own afterwards and the record says where it
  landed, undoably.
- **Saving the whole page keeps its own one-press control** — an icon in the
  composer's row, needing nothing typed.
- **Every submitted record carries the Skills underneath it** — Ask, As
  Markdown, Into English, and whatever else is configured — whether it was
  typed, spoken, quoted or saved from the page. A transcript is not a special
  kind of text, and rewrites sit indented under what they were made from.
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
- **Logue asks for the microphone itself.** The first recording in a browser
  brings up Chrome's own Allow prompt, from the panel — the one surface at the
  extension's origin that has a window to draw it in. The recorder cannot ask:
  it runs in the offscreen document, which has no window, so Chrome refuses
  without asking anyone and the permission reads `prompt` forever. Two releases
  shipped a microphone that no sequence of clicks could grant.
- **A blocked microphone comes with the way out, not a description of it.** Once
  someone has refused, only Chrome's settings can undo it — on a page that is
  not linked from anywhere and never lists an extension in its site list. So the
  panel opens that page for the extension's own id. On a web page, where no
  prompt can appear at all, the surface says to open Logue and record there —
  the step that actually works — instead of naming a setting.
- **"Already recording." never reaches the screen, by any route.** Pressing the
  microphone either records or says something the person can act on. A message
  that only describes the extension's own confusion is not an answer, and the
  rule is about the sentence being unreachable — not about one path to it
  having been closed. (Written after it came back once already.)
- **A transcript goes back where the caret was**, even if focus moved while it
  was being transcribed.
- **The bar on a selection and the bar by a caret are one design.** Same
  shell, same handle and dragging, same look and placement for accept and
  cancel, same icons, same tooltips, same way of arriving and leaving. They
  differ in what they offer, never in how they are put together — and a change
  to one is a change to both. Built as shared parts used twice, because two
  copies of a design drift apart the first time anybody touches one of them.
- **Every floating surface can be dragged, and its handle is always visible.**
  Not on hover, not in some states and not others — if it floats over someone's
  page, there is something to take hold of. A bar that lands on the sentence
  being read and offers nothing to grab is the page being taken away.
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
- **A page is read in whatever language it is written in.** What counts as
  prose cannot be decided by a rule that only holds for Latin script: requiring
  a space to prove a block was more than one word threw away every paragraph of
  a Chinese page and kept its menu. Whatever is kept from a page is kept the
  same way whichever script it is in.

- **A Page-level story is the whole page.** The app pages mount the real
  `App` — rails, navigation and route at a real viewport — and the panel pages
  mount the real panel component at the size Chrome gives it. A route pane
  floating in a box is not a page, and reviewing it as one hides exactly the
  layout mistakes pages exist to catch. (His words, 2026-08-11: "why pages are
  not full page??? quality too low.")
- **The Storybook reads in levels, in order**: Foundation, Component, Feature,
  Page, Journey. Every story belongs to exactly one.

## One vocabulary on screen
- **A popup stays on the screen, and all of it can be pressed.** (2026-08-13,
  his report: *"dropdown/popup position. should fix base component to handle
  all cases"*.) Anything that floats over a trigger is placed by one rule —
  fixed, measured, clamped to the window on both axes, re-measured when its
  contents or the window change. Never by each component's own guess: an
  ancestor that scrolls clips an absolutely-placed panel, and the hidden half
  stops taking clicks as well as stops being visible.
- **A recording that failed says what the model said.** "The words did not come
  back" alone reads as Logue losing them; on 2026-08-13 three recordings said
  that while the log filled with 503s. And a failure that passes is kept being
  tried for hours rather than half an hour — nobody decided anything about
  those recordings, nobody has managed to ask yet.
- **Make one of these where they live.** The `+` for a Project, a Document or
  a Skill sits in the header of the list it adds to — not on the rail, where it
  appeared only while the pointer happened to be over the row. (2026-08-13,
  his instruction: *"把 Add New 这个 button 移到里面"*.)
- **Both halves of a screen start at the same height.** The list header's first
  row and the detail header are both 48px; they were 42 and 48, so the two
  panes of one window began at different places.
- **A saved setting is in the field, not in the hint.** The model name is the
  input's value, so it reads as set and one character can be changed without
  retyping the string. (His question: *"为什么这个模型它的文字是一个类似 tip 的
  方式,而不是真正的文字 input value 呢?"*) A key is the exception: it is never
  shown, and its placeholder says so.

- **One shape per kind of message.** A failure, a warning and a plain fact each
  have one component (`Notice`), and "nothing here" has one (`Empty`). There
  were seven spellings of the first and three placements of the second, two of
  them with colours typed in by hand — so the same failure looked like a
  different product depending on where it happened.
- **A key is drawn as a key.** Shortcuts are key caps (`Keys`), not grey words.
- **The destructive answer is the one that looks like the action.** In a "are
  you sure" dialog, Delete is filled and Cancel is quiet; two outline buttons
  give equal billing to both answers.
- **Whatever is selected is visible.** A highlighted row uses the same
  accent-soft fill and accent edge everywhere; `bg-active` on `bg-panel`
  measured 1.15:1, so arrowing through Find moved something nobody could see.
- **A citation is a chip you can follow, wherever it appears** — in an answer
  and in a document. `[Source 3]` printed as three words wrapped across lines
  and could not be opened.
- **A recording looks its length.** The waveform's density follows the
  duration, so a sentence and a ten-minute meeting do not draw the same picture.

## The panel: one list, one composer

(2026-08-13. His instruction: *"面板收成一个列表 + 一个 composer"*, and his
ruling on the three questions it raised — **A / keep / bookmark**.)

- **There is one place to say anything, and one list of what came of it.** No
  Record / Keep / Ask across the top, no second recorder, no ask box, no
  separate lists for dictation, conversation, what was kept, and what is
  queued. Every entry has the same shape and the same row of Skills.
- **Voice fills the box; it does not send.** Talking puts the words at the
  caret. `esc` throws the recording away, `↵` puts the words in, `⌘↵` puts
  them in and sends. This is what makes it possible to say a second sentence
  before deciding anything — the reason the change was asked for.
  - The behaviour this replaces, said plainly: ⌘⇧K used to open the panel
    listening and `↵` sent what was said straight into the conversation.
- **Sending keeps. Asking is something you do to what you kept.** One send is
  one Source: words that came out of the microphone are kept as a voice
  Source carrying the recording, so what was said can be played beside what it
  became. `Ask` sits on each entry's own Skills row.
- **A selection on the page changes the scope, not the controls.** The passage
  arrives above the box as a quote, with the anchor the page made while the
  selection existed, and goes in as its own Source with the note hanging off
  it. Dropping the quote is `esc` or the ✕.
- **Keeping this page is one press**, a bookmark beside the microphone.
- **Where the words are added stays a chip on the composer's row** — not a
  step, not a section. (Of 33 things dictated into this workspace, 33 were
  never used again; deciding the destination first is the one time it earned
  its place.)
- **A recording nobody kept is not unfinished.** The audio stays on the Host,
  the model answered, and it is not listed as waiting. What *is* listed is
  trouble: a busy model, a refusal, a queue — as entries, at the time they
  happened, with the audio playable and a way back.
- **A Skill run from the page's menu keeps its answer as a Source**, hanging
  off the passage it was run on, so it lands in the panel's one list and can
  be found in the app. It used to be written into a conversation the panel
  read from browser storage — which existed nowhere else and vanished when the
  conversation was cleared.

### What the three reviews changed (2026-08-14)

Every one of these is a deviation between the panel that shipped and the mock
he confirmed, found by the copy, behaviour and design-fidelity reviewers and
then measured in the real panel — see `scripts/qa/n14.mjs`.

- **An answer is a Source, hanging off what was asked about.** Every answer and
  every rewrite is kept as a `derived` Source, filed against the page it
  happened on and pointing at the text it came from. Until this, they lived in
  the panel's memory alone: asking a question and then closing the side panel —
  the ordinary way a side panel ends — threw the answer away, and the panel
  rebuilds its list from the Host. A text with no Source behind it (a send that
  failed) has nothing to hang off, and its rewrite stays on screen only, by the
  rule that nothing generated floats free of its evidence.
- **`[Source n]` is a chip you can press**, showing the passage it stands on,
  the same component the app uses. Printed as text it is a claim nobody can
  follow.
- **Asking is a Skill, on the Skills row**, not a strip below the entry. The
  strip drew a second divider through every row and the first one broke around
  the button.
- **A long entry folds at six lines.** One 4:14 dictation filled the whole
  panel — its own Skills row was a thousand pixels below the words it belonged
  to. One rule for both texts a row shows: the quote used to be cut at 220
  characters with no way back, the transcript printed whole however long.
- **Logue not running is not an error the person made.** A quiet line —
  *Logue is not running. Recordings are kept here.* — instead of the fetch's
  own words in red, and the server address form no longer opens itself on the
  first failed call. It is opened from the menu, by someone who thinks the
  address is wrong.
- **What is offered on a text does not depend on how the text arrived.** The
  Skills row filtered on the `dictation` context, so a saved page and a kept
  passage were offered nothing. The panel is the browser: it offers every Skill
  the browser can reach.
- **A recording waiting for Logue is a row in the list, at the time it
  happened** — not a block pinned above everything, where yesterday's queue sat
  permanently on top of today's work. Its one ordinary action is *Try again*;
  exporting the audio and deleting it are behind the ⋯, and deleting asks
  first, because the audio is only in this browser.
- **Anything that goes wrong after the words are safe still gets said.** A
  Skill that would not run, an answer that never came, a Document that would
  not take the words: the message was written onto the entry and shown by
  nothing, so asking a busy model looked exactly like not having asked.
- **The things you press have edges**, and say their word once. A product
  tooltip now clears the browser's own — a wrapped icon button was showing the
  black label and the yellow strip at the same time, saying two different
  things about one button.

## Two surfaces, one workspace

- **What one surface writes, the others show — without being reloaded.**
  (2026-08-12, his report: *"bugs: ext widget/sidepanel and webapp should have
  data synced."*) The panel, the on-page controls and the app read one Host,
  and each asks it every second and a half whether anything has been written.
  When something has, whatever shows that kind of thing loads again. There is
  no refresh button, and needing one is a bug in this.
- **Following costs nothing and is never noticed.** The question reads no
  files. The answer arrives without a spinner — a row appearing must not blank
  the pane it appears in — and a surface nobody is looking at does not ask at
  all.
- **Nothing reloads over words that are not saved yet.** An editor holding
  something unsaved is left alone until it is saved; the next change picks it
  up. A reload that costs a paragraph is worse than the staleness it fixes.

## Documents

- **A document's name is its first line. There is no title field.**
  (2026-08-13, his instruction: *"一个 document 不应该有一个 title 和内容的
  section。你参考一下 Google Doc，我们并没有专门的一个 title，它就是这个文档的
  第一行"*.) The markup comes off it — `# Tuesday` is called `Tuesday` — and it
  stops at 50 characters; an empty one is `Untitled`. Renaming is editing that
  line, and nothing else renames a document: no field, no model. A document
  written **for** you — by a generation or the agent — starts with the name it
  was given, as a heading, so the name is in the text like any other line.
  (This replaces "a document names itself until someone names it", and the
  three-way `title_state` that went with it.)
- **A document is Markdown, and it is edited as it will read.** (Same
  instruction: *"我们需要真的支持 Markdown… 为什么我们并没有所见即所得的
  Markdown 编辑？"*, pointing at his own `vibedoc` project.) Headings are large
  as they are typed, bold is bold, a list is a list — and the markup is hidden
  on every line the caret is not in, so `## Tuesday` reads as a heading until
  you put the caret in it. One format is stored: what the model writes, what
  the editor holds, what the diff reads and what the export writes are the
  same text. **Nothing stores HTML the person did not write.**
- **Converting a workspace to Markdown loses no name and no words.** It runs
  once, says how many documents it rewrote, and where the stored name was not
  already the first line it writes that name in as a heading rather than
  dropping it.
- **A document is Markdown as it will read.** (2026-08-14, his words: *"doc
  editing must support wysiwyg for markdown. see vibedoc… ux should be similar
  to notion"*.) Tables, task lists, strikethrough and bare links are
  understood; a task box is pressed rather than typed; an image is shown;
  `/` on an empty line offers the blocks, and what it writes is Markdown.
- **The document is a working copy; a version is a save that changed something.**
  (2026-08-19, his design: *"用户编辑时，只更新 Working Copy … 只有有意义的保存
  才会产生历史版本"*.) Editing — typing, appending from the panel, applying a
  rewrite — writes the working copy and nothing else; no version is written by
  the passage of time. Saving compares the working copy with the version it is
  based on: no difference, no version; a difference becomes a new immutable
  version, which is what the next save is compared against. (This replaces the
  one-version-per-sitting autosave of F3.)
- **A version says who made it: the person, or an agent.** His design's point:
  *"用户修改和 Agent 修改在历史中分别可见"*. Agent versions are marked in the
  history; everything unmarked is the person's.
- **An agent change never costs the person unsaved words.** Before an agent's
  change lands, unsaved edits in the working copy are saved as a *user*
  version. The agent's change then lands whole, as an *agent* version — an
  agent that fails or is cancelled leaves nothing behind, and an agent whose
  output matches what it started from leaves no version.
- **An agent works from a fixed version, and the person wins the race.**
  `begin` saves the person's unsaved edits and hands the agent the version its
  work is based on; `commit` applies the result only if the working copy still
  reads as that version. If the person edited meanwhile, the working copy is
  not touched: the result is kept beside the document as a pending change, to
  be read, applied or discarded — and applying it saves the person's words
  first, the same rule again.
- **Documents nest, and nothing is lost by moving them.** Each holds its own
  parent and its place among its siblings. Deleting a page moves its children
  up into its place; a page cannot be moved inside itself.
- **Every version of a document can be read back and gone back to.** Restoring
  puts that version's text into the working copy and deletes nothing — and
  anything that replaces the working copy wholesale (restore included) saves
  unsaved edits as a version first, unless the person explicitly discards
  them. Saving after a restore writes a new version rather than rewriting
  history.
- **Each version says what it changed, in words.** A model writes the line
  after the save, never in front of it — autosave is a pause someone can feel.
  Where no model can answer, the counted line stands in; a history row that
  says nothing at all reads as a broken row.
- **A Skill's prompt has the same history, reached the same way.** The
  revision number on the Skill page opens it; every past prompt can be read,
  diffed and gone back to. Going back is a new revision, so the numbers Runs
  recorded keep pointing at prompts that exist. No model writes summary lines
  here — a person edits a prompt by hand and the diff is the story.

### The habits of a person who writes (2026-08-14)

(F6, from *"ux should be similar to notion"*. Everything here writes Markdown;
the file is not a different thing from the page.)

- **The formatting keys are the ones every editor has**, and each one toggles.
  ⌘B, ⌘I, ⌘E, ⌘⇧X, ⌘K. A key that only ever adds is a key you can press once.
- **A link is made where the caret already is.** ⌘K wraps the selection and
  lands the caret in the half that is missing; an address pasted over a
  passage makes that passage a link.
- **What can be done to a passage appears on the passage.** Bold, italic,
  code, link, and Rewrite, in a bar above the selection. Rewrite used to be a
  button in the page header, disabled whenever nothing was selected and
  explaining its own disabled-ness — an action parked where the thing it acts
  on never is.
- **An empty line offers the block menu.** `Type / for commands`, on the line
  the caret is in. The one habit this editor borrowed from Notion was
  otherwise findable only by someone who already knew it.
- **A page inside another page says so**, in the header, each step a link.

### The list is rearranged by hand (2026-08-14)

(F4. The tree landed with `parent_id` and `position` real and no way to touch
them: moving a page meant calling the API.)

- **A page is dragged where it goes.** The whole row is the handle. A quarter
  at each end of the row it is over puts it above or below that page; the half
  in the middle puts it inside. A line is drawn where it would land, and the
  row it is being dropped into is ringed.
- **Hovering over a folded page opens it**, after a moment, so what is inside
  can be dropped into without letting go.
- **A page cannot be dropped inside itself.** That is the one move that would
  stop a tree being a tree, and the Host refuses it too.
- **Dragging is off while a search is on.** A search flattens the tree, and a
  flattened tree has no order to rearrange.
- **Renaming writes the first line**, because the first line is the name. The
  line's own markup is kept: `# Notes` renamed to `Plans` is `# Plans`, not a
  heading that quietly stopped being one. Double-click a row, or Rename in
  its ⋯.
- **Deleting asks, and says what moves.** The pages inside the one being
  deleted move up into its place rather than going with it, and the dialog
  says so before the press.

### The editing a page needs (2026-08-14)

(F5. Read against vibedoc line by line: on plain Markdown editing Logue was
already ahead — what was missing was ordinary editor furniture.)

- **⌘F finds and replaces**, in CodeMirror's own panel wearing the product's
  clothes. Only the surfaces are restated; nothing about how it works is
  touched.
- **More than one caret.** ⌘D takes the next occurrence of what is selected,
  ⌥-click adds a caret, ⌥-drag selects a rectangle.
- **Dragged text shows where it would land.**
- **The footer says how much has been written and whether it is saved.** Words,
  not characters — nobody writing a page thinks in characters — with markup
  and fenced blocks left out, and Chinese counted by character, because a
  Chinese sentence has no spaces to count between.

## An agent that is not ours

- **A document link is all another agent needs.** Hand the URL of a document to
  a coding agent — Claude Code first — and it can read that document and write
  back into it. Nothing else is set up first: no key, no account, no config
  file naming a port. The link says which Host and which document, and the Host
  already answers a local tool that arrives without an `Origin`.
- **The outside agent speaks Markdown, because Logue stores Markdown.** Since
  the editor became a Markdown editor (F2) there is no other format: what the
  agent reads is the stored text, and what it writes is stored as sent. The
  converter the first integration shipped — built when documents were HTML —
  wrote HTML into a Markdown workspace and escaped Markdown on the way out, so
  it is gone rather than kept for compatibility with a store that no longer
  exists.
- **A replacing write is an agent change, and lands as one.** The outside agent
  begins against a fixed version — the Host saves the person's unsaved edits as
  a user version first and hands back the base — and commits its whole result:
  applied as an agent version when the working copy has not moved, kept as a
  pending change for the person when it has, and dropped without a version when
  nothing actually changed. `begin` still refuses a stale `--revision`, so an
  agent that read an old working copy is told to read again rather than build
  on air. Appending needs none of this — it cannot overwrite anything.
- **The outside agent adds; it does not tidy up.** It may read, append, replace
  and create. Deleting a document is not something it does on its own — that is
  the same rule the in-product agent lives under, applied to a bigger blast
  radius.
- **What is installed lives in this repository.** The skill Claude Code loads is
  a copy of `integrations/claude-code/logue/`, put in place by a script that can
  be run again. A skill that only exists in someone's home directory is one
  machine away from not existing.

## Provenance — the part that cannot bend

- **Web evidence, what you said, and what a model produced never look alike.**
- **Anything generated points back at what it came from.**
- **The unchangeable things come first on the screen.** The recording itself
  and the passage taken from the page are the source of truth; they sit at the
  top, and they are visibly two separate things, because one is what the person
  said and the other is what the page gave. A transcript is derived from the
  first, so it reads below them. An order that leads with the derived text
  states the opposite of how this product works.
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
- **Every surface shows the same data, without being reloaded.** The web app,
  the side panel and the widgets on a page all read the one workspace, and a
  change made through any of them appears in the others on its own — file
  something from the panel and the app's Stream already has it; rename a
  Project in the app and the panel's list says the new name. Two surfaces
  disagreeing about the same workspace is a bug, not a refresh away from
  correct. (Asked for 2026-08-12: "ext widget/sidepanel and webapp should have
  data synced." — queued as X1.)

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
- **A failed dictation row shows the audio player, not only the error.**
  (2026-08-12, his report: "we should always show the audio if dictation
  fails. why only showing the err?") Whenever the Host kept the recording, the
  row plays it next to the failure message and the retry. Only a failure with
  nothing kept — the capture itself failed — is a message alone.
- **What waits offline is bounded in bytes, not in recordings.** Ten
  ten-minute recordings are more than this storage holds; a count alone means
  the quota does the refusing, from somewhere else, about something the person
  cannot see.
- **What the model was asked and what it said can be watched, on this
  machine.** Every hard failure in this product has been about the prompt that
  actually went over the wire — a transcript sent as a request, silence turned
  into a sentence, a page that arrived without its Chinese paragraphs — and in
  each case the code looked right. It is off unless an endpoint is set, it adds
  no dependency to the Host, and an endpoint that is not this machine is
  refused unless somebody says otherwise in as many words: these traces carry
  everything a person said and every page they said it about.
- **A recording that never became words is findable without the tab that made
  it.** The audio is written before the model is asked, so a refusal never
  costs the recording — but for a long time the only thing that knew its id was
  the surface that made it, and a surface is a browser tab. Close it and "the
  recording was kept" was true and useless. Counted the day this was written:
  292 recordings on one workspace, 86 with nothing pointing at them.
- **A refusal is retried without being asked, and then it waits.** Recent ones
  are tried again a few times on their own; past that they are listed with a
  button rather than tried forever. Giving up automatically and giving up are
  different things.
- **A busy model is waited out, not handed over.** (2026-08-13, his report of
  a 1:05 recording answered with `Model rejected the request (503) … high
  demand … Please try again later.` and a `Try again` link to press.) A status
  that means "not this second" — 429, 500, 502, 503, 504, a dropped
  connection — is asked again by the Host itself, four attempts over about
  seven seconds, honouring a `Retry-After` it is given up to twenty seconds.
  If it is still busy, the surface holding the recording asks twice more, at
  five seconds and fifteen, and says so where the recording is: **`The model
  was busy. Trying again…`**, with the audio playable beside it. Only then
  does the failure and its button appear. **A refusal that repeating cannot
  fix — a bad key, a rejected request — is never repeated**: the person hears
  it at once instead of thirty seconds later.
- **Whether a failure is worth waiting on is the Host's to say.** The status
  code is only visible there; every surface reads one flag and none of them
  guesses from the wording of a message.
- **A failure a person is shown is a sentence, not a service's JSON.** A busy
  model reads `The model is busy (503). The recording was kept — you can try
  again.`; the provider's own body is printed in the Host's terminal, where a
  failure is looked into. A refusal that is **about the request** — a bad key,
  a malformed call — keeps its detail on screen, because that is the one a
  person has to act on.
- **A recording the model answered about is finished, not waiting.** Silence
  was reported at the time, to the person standing there. Presenting every
  wordless recording as unfinished turns an ordinary week into fifty things
  demanding attention — which is what it did, the first time this list existed.
- **One recording, one place to act on it.** What the panel is already showing
  with its own message and its own button is not counted again in the heading
  above it.
- **A dictation keeps both halves.** The recording and the words it became are
  both there afterwards, and both survive the panel being closed. Words alone
  cannot be checked against what was said; audio alone cannot be used.
- **Speaking again never waits for the last one to finish.** The microphone is
  exclusive only while it is capturing; from the moment a recording is ended,
  the next one can start, however many are still being transcribed. Each one
  carries its own state — its own clock, its own words, its own failure — so a
  list of four can say which one went wrong.
- **A rewrite is added, never substituted.** Running a Skill over a transcript
  — into another language, into Markdown — puts its result beside the
  transcript with the Skill's name on it. The transcript is the first-hand text
  of the recording; replacing it with a conclusion loses what the audio proves.
- **A rewrite is handed writing, never a request.** A Skill that translates or
  restructures a piece of text is given the text as material and no question at
  all. Sent as the request it arrived labelled as one, and a real model wrote
  the label into its own answer — then again, compounded, on the next rewrite.
- **Running a Skill over something already kept does not keep it again.** The
  words of a recording are already a Source; a rewrite of them points at that
  Source rather than storing a second copy of it.
- **Every text a recording produced offers the same things**: copy it, and run
  any dictation Skill that has not already been run on it. The transcript is
  not privileged — it is the first text, shaped like the ones after it.
- **Where a Skill is offered is a control, not a sentence.** Every surface
  decides what to show from a Skill's contexts, so a Skill can be written and
  then appear nowhere; the page that says where it is used is the page that
  sets it.
- **Context spells what was said; it never supplies it.** Whatever surrounds
  the words — the page being read, the document being written into — goes to
  the model as quoted material, to get names and terms spelled the way they are
  spelled there. It is never an instruction, and no amount of it makes silence
  into a sentence.
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
- **A panel shortcut never steals a key from what is being typed into.** Esc
  and Enter drive the recording only when no input, textarea, select or
  contenteditable has focus, no IME composition is in progress, the key is not
  a repeat, and no modifier is held. Without this, Esc in the ask box cancels
  a recording and Enter accepts it instead of making a new line.
- **"Busy" means a microphone is live, not that an object still exists.** Two
  questions, kept apart: a reload waits only for a live microphone, because
  that is what would cost someone words; closing the offscreen document waits
  for audio nobody has collected. After the ten-minute ceiling stops the
  microphone the first is false and the second is true — and the second cannot
  last: uncollected audio is released after a few minutes, because a page that
  has gone is never coming back for it. Conflating the two froze self-update
  permanently on any browser where a recording hit its ceiling with the page
  already gone.
- **Two voice keys, two destinations, never mixed up.** ⌘⇧Space is dictation on
  the page: what you say is *text*, and it lands at the caret with no gate in
  between. ⌘⇧K is the command key: it opens the panel and starts listening, and
  what you say is an *instruction to Logue*, which becomes a message in the
  conversation. Anything that proposes moving words from one path to the other
  has confused them.
- **The panel says who it belongs to before it says anything else.** Its first
  row is Logue's own — the same mark and wordmark the app carries, and a way
  into the app that says "Open app" in words. The second row is the page you
  are on. They shared a row once, and the only control up there read as an
  action on the page's title, so a person who had asked for that link twice
  concluded it was gone. A permanent way into somewhere else is not the kind
  of icon that may go without words.
- **Asking happens in the panel; the page keeps only what must be on the page.**
  A question about the page is a conversation, and conversations live in one
  place. The page's ✦ opens the panel rather than raising a second box over the
  reading; what stays on the page is dictation into the caret and a handle to
  move it. Two voice paths, two destinations, and now two different surfaces.
- **A conversation is written the way conversations are written**: what was
  said stays above, and the place to say the next thing is pinned to the
  bottom and does not move. The box used to sit in the middle with the answer
  printed underneath, which reads as a form that has been filled in.
- **A recording waiting for Logue can be seen, retried, exported or dropped.**
  The queue already kept them and already sent them, but only the queue knew
  that: audio on disk nobody can reach reads exactly like audio that was lost.
  Each one says when it was made, how long it ran, and whether it is waiting
  or has failed — and how many times.
- **An open tab notices it has been replaced, and never takes unsaved words
  with it.** A build is named by its content hash, so deploying deletes the
  chunks an open page still needs — it does not go stale, it breaks. The page
  asks the Host which build it is serving; when the answer stops matching the
  one it loaded with, it reloads itself. Unless something is unsaved: then it
  says a newer Logue is ready and waits to be told, because an update that
  costs someone a paragraph is worse than the bug it fixes. This is not hot
  reloading and does not pretend to be — there is no dev server, by the rule
  that says one machine, one address.
- **A menu is a list to scan, and it can be finished without the pointer.**
  Compact rows, a narrow frame, the item's name in small grey type rather than
  a heading that outranks the actions, focus shown as a wash rather than a
  ring — a heavy outline inside a small popover reads as an error. Every
  action carries one letter, shown on the right, and pressing that letter runs
  it and closes the menu.
- **Filing is automatic, silent, and always undoable.** (2026-08-12, his words:
  "全自动静默归档", "no to file pls".) The moment classification returns, the
  Source is in its Projects and wearing its tags — no queue, no File or Skip,
  no confidence number anywhere. The Source's own view carries the receipt:
  what was added, the model's one-sentence reason, and Undo. Undo subtracts
  exactly what filing added and nothing a person did, because the addition was
  recorded at the moment it was made. A look that failed stays `pending` and
  is retried on the next start, silently. One thing still waits for a person:
  "this replaces an older Source" changes how other material reads, so it
  remains a question in the Source view. On first start after this rule, the
  old queue's backlog is filed the same way — recorded as automatic, undoable
  one by one — and the word `needs_review` retires.
- **The page travels with a dictation all the way to filing.** (2026-08-12, his
  report: "加一个 dictation 的时候,页面里面的文字内容并没有作为 context 发送过
  去".) The page text collected when a recording starts was already sent to
  transcription to spell names; it is now also saved on the voice Source as
  `context` — the same field, and the same 2000-character ceiling, a selection
  uses for the passage around a quote — and the filing prompt quotes it. A
  transcript rarely names its own subject ("why doesn't this work?"); the page
  it was spoken over does. Quoted line by line and declared to be quoted, never
  instructions, because it is whatever the internet happens to say. This holds
  on every voice path: the side panel's Dictate (whole readable page), the
  on-page caret bar (text around the caret), and recordings queued while the
  Host was off.

- **A recording says where it is going before it is made.** (2026-08-13) The
  panel picks a Document to record into; the words are added there when the
  transcript lands, and the row says so. Speaking into the panel used to end
  at a transcript with a Copy button — 33 of them on this workspace, none ever
  used again — because by the time the words exist the moment to decide where
  they belong has passed. The choice is remembered across the panel closing.
- **An ask reads what it asked about, not the whole Project.** Sources are
  retrieved and ranked for the question, capped. One ask here read 192 Sources,
  cited one, and twice answered "the evidence is insufficient" with the answer
  in the pile. The question itself is never one of them.
- **A search can be widened into the other language.** These notes are written
  in English and Chinese together and the match is a substring: `progressive
  disclosure` found nothing while `渐进式` found five, about the same
  afternoon. Widening asks a model for short terms that would appear verbatim,
  remembers the answer, and names what it also searched — a result containing
  none of the typed words must be able to account for itself. Never on the
  typing path.
- **A generated answer becomes a document, not a wall of Markdown.** Headings,
  lists and checkboxes arrive as themselves, and the document is named by what
  was asked, cut on a word. The editor's own naming runs on the body losing
  focus, which a document nobody has opened never does.
