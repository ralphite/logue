# Context Center

The queue, and the messages behind it. Three files, no dependencies.

```bash
python3 server.py
```

Opens `http://127.0.0.1:8788/`. Pass a number for a different port.

| File | What it is |
| --- | --- |
| `index.html` | The whole interface. Tailwind from a CDN, everything else inline. |
| `server.py` | Serves this folder, streams `tasks.json` on change, writes it back. |
| `tasks.json` | **The only source of truth.** Agents edit this file. |
| `config.json` | Project folder and which Claude Code session to talk to. |
| `runs.json` | The last 50 handoffs to that session, and how each went. |
| `shots/` | Screenshots referenced by `inputs[].images`, by filename. |
| `skill/` | The `/cc` Claude Code skill. `./skill/install.sh` to install it. |

## Saying something from inside the app

Every task's detail pane has a box under the note. Type into it, paste or drop
images, `⌘⏎` to send. The message goes to **one Claude Code session you already
created** — chosen in Settings (the gear, top left) — which runs the `/cc` skill
and writes the result back into `tasks.json`. The stream picks the file up and
your words appear below, in `From you`.

The loop closes on the file, not on a transcript. Nothing here is a chat.

**It needs a session that can actually run.** Settings has a *Send a test
message* button that performs a real call and prints exactly what came back.
If it says `OAuth session expired`, the CLI cannot authenticate on this machine
and nothing else will work either — run `claude` in a terminal once, then retry.

One turn at a time: a session is a single conversation on disk, so keep the
chosen one for Context Center rather than typing in it yourself at the same
time.

## /cc, from a Claude Code session

```bash
./skill/install.sh          # copies into ~/.claude/skills/cc
```

Then `/cc <message>` in any project turns it into queue state — a new task, words
filed against one that already exists, a field change, or several of those — while
keeping the original sentence verbatim in `inputs[]`. It writes through the server when one is up, so
it cannot clobber something being typed in an open tab; with no server it edits
the file. `skill/cc.py --help` lists the commands.

## The data

```json
{
  "tasks": [
    {
      "id": "X38",
      "title": "One page, one chat — and it is called Chat",
      "type": "bug",
      "status": "done",
      "priority": "P0",
      "confirmed": true,
      "tags": ["panel"],
      "note": "Why this matters.",
      "blocked_on": "",
      "input_ids": ["in_thread_bug"],
      "created": "2026-08-09",
      "updated": "2026-08-10"
    }
  ],
  "inputs": [
    {
      "id": "in_thread_bug",
      "at": "2026-08-09 21:39",
      "text": "the message, verbatim",
      "images": ["shots/x36-thread-not-per-page.png"]
    }
  ]
}
```

- **Order is array order.** To reorder, move the object. There is no `order` field.
- `status` — `queued` | `doing` | `blocked` | `done`
- `priority` — `P0` | `P1` | `P2` | `P3`
- `type` — open vocabulary, lower case. `bug` / `feature` / `question` / `test` are
  seeded; a new word just works and joins the picker on its own. `""` = unsorted.
- `confirmed` — `true` only once the user has said yes. Anything proposed, inferred, or
  carried over starts `false`; the flag is worth nothing if it defaults to `true`.
- `blocked_on` — read only while `status` is `blocked`.
- `input_ids` — many-to-many. One input may be referenced by any number of tasks,
  and the detail pane says which others.

`inputs[]` is raw and immutable: the interface reads it and never writes it.
Deleting a task never deletes an input — it may belong to other tasks, and even
when it belongs to none it is still something that was said.

## Two writers, no lost work

The browser and whoever edits the file both write the same bytes, so every write
carries the revision it was based on:

- a write from a stale revision is **rejected** (409) and handed the current
  contents, rather than overwriting them
- a remote change arriving while a field has focus is **parked**, not applied —
  a half-typed sentence is never yanked away
- on blur it **rebases**: take what is on disk, re-apply the one edited field, so
  both edits survive unless they are literally the same field
- with the server down, edits stay in the page and keep retrying; start it again
  and they land

Changes on disk reach the page within about half a second (mtime poll + SSE).
