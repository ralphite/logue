---
name: cc
description: Record a request into Context Center's tasks.json — as a new task, or as words added to one that already exists — and make any change the message asks for. Use on /cc, when asked to queue, log, or capture something, or right after a new requirement is stated that would otherwise live only in this conversation.
---

# Context Center, from a Claude Code session

Context Center is a local task queue. `cc/tasks.json` holds the tasks and,
separately, **the raw messages behind them**. A browser at
`http://127.0.0.1:8788/` renders it and picks up file changes within about half
a second.

Everything goes through one command:

```bash
python3 ~/.claude/skills/cc/cc.py --help
```

It talks to the running server when there is one, so a write cannot clobber
something being typed in the open tab. With no server it edits the file.

## Two kinds of message

A message arriving here is one of two things, and mistaking one for the other is
the main way this goes wrong.

**An instruction.** "更新一下这个 item", "make it P0", "mark it done", "this is a
bug not a feature". Act on it with `set`. There is nothing to file — storing
"make it P0" verbatim leaves a line nobody will ever read and, worse, leaves the
priority unchanged.

**Something worth keeping.** A requirement, a bug report, an opinion, a decision,
a constraint, a screenshot of what is wrong. File it with `add` or `say`, word
for word. This is the half that has to survive: a title can be rewritten later,
the original wording cannot be reconstructed.

Plenty of messages are both — "这个太慢了，改成 P0" reports a judgement *and*
asks for a change. Do both.

## Always read first

```bash
python3 ~/.claude/skills/cc/cc.py list
```

```
# 5 shown, 8 total   (via server)
# id     type      pri  status   ok  inputs  title
M2v    test      P0   blocked  ok  1in   Confirm the installed extension is running v1.0.0
A2     question  P1   blocked  ?   1in   Pick which of the five remaining audit items to fix
```

`ok` means confirmed; `?` means nobody has confirmed it yet. Read the list before
writing — a message is often about a task that already exists, and a second task
saying the same thing is worse than none.

`show <id>` prints one task in full, with the messages already filed against it.

## A new request → `add`

```bash
python3 ~/.claude/skills/cc/cc.py add "Reorder the panel rows by drag" \
  --type feature --priority P1 --tag panel \
  --note "Reordering means editing the file by hand today." \
  --said "拖动排序，现在只能靠改文件，太蠢了"
```

- `--said` is **verbatim**: original language, original punctuation, original
  typos. Never a translation, never a cleaned-up version — that is the whole
  point of the field.
- `--type` is an open vocabulary: `bug`, `feature`, `question`, `test` are
  seeded, and any other word works and joins the picker on its own. Leave it off
  when the type genuinely is not clear; `""` shows as unsorted, which is honest.
- `--priority` defaults to `P2`. Reserve `P0` for something broken right now.
- The id comes from the type (`X`=bug, `F`=feature, `Q`=question, `T`=test).
  Pass `--id` only when a specific one is asked for.
- **Position defaults to the end.** A new request does not jump ahead of the one
  already in hand — that is a standing rule here. Use `--position top` only when
  asked, or when the thing is broken right now.
- Screenshots: `--image ~/Desktop/shot.png` (repeatable) copies into `shots/` and
  attaches to the same message. An image needs a `--said` to belong to.

## Something to file against an existing task → `say`

```bash
python3 ~/.claude/skills/cc/cc.py say "先别做这个，等我确认" --on A2
```

One message can belong to several tasks — that is the many-to-many, and the
detail pane shows "also on":

```bash
python3 ~/.claude/skills/cc/cc.py say "ui design must be consistent! everywhere!" --on X33 --on R13
```

Prefer this over `add` whenever the message elaborates, corrects, or confirms
something already queued.

## A change to the task → `set`

```bash
python3 ~/.claude/skills/cc/cc.py set A2 --status doing
python3 ~/.claude/skills/cc/cc.py set P6b --confirmed true
python3 ~/.claude/skills/cc/cc.py set M2v --status blocked --blocked-on "Needs you at the keyboard"
python3 ~/.claude/skills/cc/cc.py set F1 --position top --priority P0
```

## The confirmed flag

`confirmed` is true only when the request came from the user. `add` sets it true,
because a `/cc` message is the user asking for something. Pass `--unconfirmed`
when the task is your own reading rather than the request itself — something you
noticed in passing, a follow-up you think is implied, an idea taken from
somewhere else. The flag is worth nothing if everything carries it, and
`Unconfirmed` in the interface is how the user finds what still needs a yes.

Never set `confirmed` true on the user's behalf to tidy the list up.

## Standing rules here

- **Write it down as soon as it is asked.** A requirement that lives only in a
  conversation dies with the session. That is what `/cc` is for.
- **Do not tidy the words.** File the sentence, not a summary of it.
- **New requests go to the end**, unless the thing is broken right now.
- **When a message has two readings, ask** rather than picking one and queueing
  it — or queue it as a `question` with `--unconfirmed`.

## After writing

Say what landed, in one or two lines: the id, and whether it was a new task,
words filed against an existing one, a field change, or several of those. If the
browser is open the change shows up within half a second; there is nothing to
reload.
