# The queue

Everything asked for, and where it stands. This file is the durable copy — the
session's task list is a working mirror of it and dies with the session.
Anything only in a session is one crash from being lost, and this list has been
lost before.

**Every new request goes in here the moment it is made**, before any work on
it. A request that is only in a reply is not queued.

Two files, two jobs. This one is the order of work and what is still open.
[behaviors.md](behaviors.md) is what must be true when a thing is done, written
so it survives the next rewrite. A request usually lands in both.

## Now, in this order

| | Task | Why it is here |
|---|---|---|
| **X7** | An untouched new Document, Skill or Project must not be saved. Clicking `+` repeatedly must not leave a trail of empty items | Reported. Caused by U5: the `+` creates through the Host immediately. Nothing should be written until it is meant |
| **U6** | Stream rail back to a flat list; a type icon on the left of each row; drop the blue dot, "47 to file", and the groups icon | Reported. Grouping by Project was a modelling error — a Source belongs to several Projects and `projects[0]` silently dropped the rest. The row icon follows Notion; `OriginMark` already exists and the main area uses it |
| **V8** | Document deep links — the open document in the URL, bookmarkable, Back works | The hash carries the route but not the selection, so a document cannot be linked or reached with Back |
| **B14** | Extension resilience: offline voice queue, all Skills on a selection | Tab self-healing is done; these two remain |
| **B3** | Skill revision browsing | Skills already keep revisions and nothing reads them back — the same gap documents had before V5 |
| **R12** | Competitor sweep and whatever it turns up | The rebuild it was waiting on is finished |

## Waiting on a decision

| | Task | The question |
|---|---|---|
| **V7** | Selection rewrite inside a document, per-hunk accept/reject | Should a model edit a document in place, or only produce answers a person places? An in-place rewrite carries no `[Source n]`, which cuts against the one rule the product exists to enforce |
| **V3** | Async dictation — keep typing while it transcribes | How long does transcription actually take? Under a second and the queue-and-remap machinery is cost for nothing. Measure first |
| **V6** | Microphone in the CommandBox | Small, and only worth it if V3 lands |

## Standing rules, as they were asked for

These are working agreements, not tasks. Each one is also in
[behaviors.md](behaviors.md), which is where the detail lives.

- **Manage the queue and keep working through it.** Decide the order; do not
  wait to be told to carry on.
- **Start the next task the moment the last one is done.** Report when there is
  something worth reading, not between every item.
- **Never stop.** If something is in the way, find another route.
- **A new ask goes into the queue, not in front of the current work** — unless
  it is broken for the person right now.
- **Write every requested behaviour down the moment it is asked for**, so a
  rewrite cannot quietly drop it.
- **A competitor's feature list is a menu, not an order.** Take what earns its
  place and delete the rest. Minimal and immediately obvious, not complete.
- **Verify in a real browser, with the real Host and a real model.** No mocks
  standing in for a run.
- **Verification writes into the "Logue QA" Project and deletes nothing.**
- **One version everywhere** — one copy in the repository, one Host, one
  extension — and all of it installed and running, so it can be checked at any
  moment without a terminal.
- **Answer in Chinese.**

## Done

**The rebuild (R1–R11)** — archive, feature tiers and ten journeys, scaffold
and four gates, then server, UI package, web, extension, install, the journeys
run for real, three review loops, and finally deleting the archived tree.

**One machine, one Logue (M1)** — the Host serves the app itself at
`http://127.0.0.1:8787` and is a login item that restarts if it stops; the
v0.2.13 install, its ten releases and its login item are gone. Asked for as
"there should be just one version in code and running service/extension …
installed/running so that i can use/check anytime".

**Documents** — version history you can read and go back through (V5), a model
writing what each version changed (V2), a title that names itself until someone
names it (V4). Chosen from the vibedoc review (U4) and confirmed.

**The rail** — the section's list moved into it, chatgpt.com style (U2); it
learned what a rail is for, taken from agentrunner (U3); it was trimmed back
down, aligned, and given a hover `+` (U5); and the half-built parts were
finished — Skills' `+`, empty sections that are no longer dead ends, hover
reading above selected, and a preview card the pointer can enter (U7).

**The shell (U1)** — product mark, a fixed bar per route, a rail that collapses
and drags wider and remembers both. Asked for as "新的 UI 没有 header,也没有
Product logo … 参考第一版".

**Capture and the Side Panel (B1–B19)** — automatic grouping, transcript
revisions and corrections, the Side Panel's five panes, lineage, deletion
previews, backup and restore, ⌘K, automatic filing with a review queue, frozen
transcription context, tags, adoption and undo, default Skill slots.

**Bugs reported and fixed (X1–X6)** — two surfaces on screen at once (X1);
extensions that needed a manual reload (X2); a second writer silently
overwriting a document (X3); verification writing into the real workspace (X4);
an error bubble that followed you to the next field (X5); a tab left running a
build that had been replaced, which is what put an input bar under a selection
toolbar (X6).

**The Host (S1)** — loopback only, origin-checked, and writes refused from a
page that cannot prove it is Logue.

**vibedoc and agentrunner reviews (C1, U3, U4)** — read, listed, and pruned
rather than copied wholesale.

**Keeping going without being asked** — a cron job could not do it, because
cron only fires while the session is idle and misses every tick that lands
mid-task. A background command that exits, and a Monitor heartbeat, both wake
the session regardless. Proven, not assumed.
