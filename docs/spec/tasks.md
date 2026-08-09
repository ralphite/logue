# The queue

What is waiting to be done, in the order it will be taken. This file is the
durable copy — the session's task list is a working mirror of it and dies with
the session. Anything only in the session is one crash from being lost.

Update this file when a task is added, finished, or reordered. A task that is
only in someone's head is not queued.

Each entry says what it is and, where it is not obvious, why it earns its
place. The exact behaviours a task must satisfy live in
[behaviors.md](behaviors.md); this file is only the order of work.

## Next, in this order

| | Task | Why it is here |
|---|---|---|
| **U6** | Stream rail back to a flat list; drop the blue dot, "47 to file", and the groups icon | Reported. Grouping by Project was a modelling error — a Source belongs to several Projects and `projects[0]` silently dropped the rest. Also: give each row a type icon on the left, Notion-style, from the `OriginMark` the main area already uses |
| **V8** | Document deep links — the open document in the URL, bookmarkable, Back works | The hash carries the route but not the selection, so a document cannot be linked or reached with Back |
| **B14** | Extension resilience: offline voice queue, all Skills on a selection | Tab self-healing is done; these two remain |
| **B3** | Skill revision browsing | Skills already keep revisions; nothing reads them back. Same gap documents had before V5 |
| **R12** | Competitor sweep and the features it turns up | After the rebuild, which is now finished |

## Waiting on the user

| | Task | The question |
|---|---|---|
| **V7** | Selection rewrite inside a document, per-hunk accept/reject | Should a model edit a document in place, or only produce answers a person places? An in-place rewrite has no `[Source n]`, which cuts against the one rule the product exists to enforce |
| **V3** | Async dictation — keep typing while it transcribes | How long does transcription actually take? Under a second and the whole queue-and-remap machine is cost for nothing. Measure first |
| **V6** | Microphone in the CommandBox | Small, but only worth it if V3 lands |

## Done

Grouped by what they were for, newest first within each group.

**The rebuild (R1–R11)** — archive, tiers and CUJs, scaffold and gates, then
server, UI package, web, extension, install, ten journeys, three review loops,
and finally deleting the archived tree.

**One machine, one Logue (M1)** — the Host serves the app itself and is a login
item that restarts; the v0.2.13 install, its releases, and its login item are
gone.

**Documents** — version history you can read and go back through (V5), a model
writing what each version changed (V2), a title that names itself until someone
names it (V4).

**The rail** — the list moved into it (U2), it learned what a rail is for (U3),
it was trimmed back down and aligned (U5), and the half-built parts were
finished (U7).

**Surfaces and capture (B1–B19, X1–X6)** — grouping, transcript revisions, the
Side Panel's five panes, lineage, deletion previews, backups, ⌘K, automatic
filing, frozen transcription context, tags, adoption, default Skill slots, and
the fixes for two surfaces at once, self-update, silent overwrites, verification
writing into the workspace, stale error bubbles, and tabs stuck on a replaced
build.

**The Host (S1)** — loopback only, origin-checked, writes refused from a page
that cannot prove it is Logue.
