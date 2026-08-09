---
name: peer
description: Check whether the sibling work session ("long session 1") is still running, and if it has stopped, tell it there is new work in docs/spec/tasks.md. Use when new tasks have just been queued, or when asked how the other session is doing.
---

# Is the other session still working?

Two sessions share this repository. **This one queues work** — every request the
person makes is written into `docs/spec/tasks.md` and `docs/spec/behaviors.md`
the moment it is made. **The other one does the work**, reading that queue.

A queue nobody is reading is just a document. So whenever tasks are added here,
check that the other session is still alive to read them.

## The check

Session to watch: **"long session 1"**, `local_28c0716d-8cb1-4f4f-b4b2-baf0f5ad3312`

1. Call `mcp__ccd_session_mgmt__list_sessions`.
2. Find the entry whose `title` is "long session 1". Prefer matching the title
   over the id — a session can be recreated with a new id under the same name,
   and then the id above is the stale one, not the session.
3. Read `isRunning` and `lastActivityAt`.

There is no shell equivalent. The CCD sessions are not the `.jsonl` files under
`~/.claude/projects/`, and `~/.claude/sessions/*.json` lists only processes that
happen to be alive right now — neither knows this session. `list_sessions` is
the only thing that does.

## What to do with the answer

**Still running** — say so with how long ago it last did something, and stop.
Do not message it. It is mid-task, and a message arrives as a user turn that
interrupts whatever it is holding in its head.

**Stopped** — send it one message with `mcp__ccd_session_mgmt__send_message`,
containing:

- that new work is queued, and to `git pull` before reading `docs/spec/tasks.md`
  (this session commits and pushes; its working tree will be behind)
- **each new task by id, one line each, saying what it is** — not "there are new
  tasks". The id alone means it has to go and read the whole file to find out
  whether anything concerns it.
- anything that **retracts or overrides** an earlier note, said plainly. This is
  the part that is expensive to get wrong: it may already be building against
  the older instruction.
- which task to read **first** when several are related, and why. Tasks that
  share a surface have to be done as one piece, or the second one undoes the
  first.

Then report to the person: that it had stopped, and what was sent.

## Keep it to one message

Do not send a second message to chase a reply. If it is running it will get to
the queue; if it has stopped again, the next run of this check will find it.
