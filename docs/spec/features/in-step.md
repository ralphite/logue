# Two surfaces, one workspace — declaration

Status: **declared and built** (2026-08-13). Covers what the side panel, the
on-page widgets and the web app do when the *other* one writes something.

His words (2026-08-12): *"bugs: ext widget/sidepanel and webapp should have
data synced."*

## What it is for

There is one workspace. Saying something in the panel and then looking at the
app should not require knowing that a reload exists.

## The surface

**Nothing new on screen.** No refresh button, no "there are updates" bar, no
toast. A list that has gained a row shows the row; a document that was renamed
somewhere else shows its new name. The only way to notice this feature is that
it is no longer wrong.

- **No spinner for a change nobody asked for.** The loading state belongs to
  the first load and to a deliberate one (opening a route, pressing Retry).
  A row appearing must not blank the pane it appears in.

## The rhythm

- Every surface asks the Host **every 1.5 seconds** whether anything has
  changed. The question is one number and no disk: `GET /v1/changes` returns a
  counter per kind of record, incremented by every write.
- The **panel asks only while it is on screen** — a side panel behind another
  window is not being read, and a browser with ten tabs must not become ten
  pollers.
- When a number moves, the surfaces that read that kind reload **silently**.
- **Nothing reloads over words that are not saved yet.** The editor already
  says when it is holding something (`freshness.ts`); while it does, a
  background reload is skipped, not queued and not forced. The next change
  after the save picks it up.
- A Host that has restarted hands out fresh counters. That reads as
  "everything changed", which after a restart is the honest answer.

## The model's part

None.

## What it must never do

- Never lose what someone is typing. A reload that costs a paragraph is worse
  than the staleness it fixes.
- Never poll the expensive endpoints on a timer. `GET /v1/changes` touches no
  files; `/v1/status` walks the workspace (11 ms on a 156 MB one, measured
  2026-08-13) and stays where it was: on the two events that need it.
- Never make the person hunt for a refresh. If a surface cannot follow a
  change, that is a bug in this feature, not a reason for a button.
- Never poll when nobody is looking.

## Open questions

1. On-page widgets are opened, read and closed within seconds, so they load
   when they open and do not poll. If one is ever left open, it will be as
   stale as the moment it opened — worth revisiting only if that changes.
