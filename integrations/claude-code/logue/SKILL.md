---
name: logue
description: Read and write a Logue document from its link (http://127.0.0.1:8787/documents/doc_...). Use when given a Logue document URL or a doc_ id, or when asked to read, edit, rewrite, append to, list or create documents in Logue.
---

# Logue documents, from outside Logue

Logue is a local-first workspace running on this machine: a Host at
`http://127.0.0.1:8787` owns everything the person has captured, and serves the
app at the same address. A **document link** looks like

```
http://127.0.0.1:8787/documents/doc_7c5095ec3f0daffa
```

That link is all you need. It says which Host to talk to and which document to
talk about. There is no key and no config file.

Everything goes through one command:

```bash
python3 ~/.claude/skills/logue/logue.py --help
```

Documents are **Markdown, stored as written**. What `read` prints is exactly
what is stored; what you send is stored exactly as you sent it. Do not convert
anything.

## How your writes land

Each document is one **working copy** (what the person edits) over immutable
**versions** (saved states). Your replacing writes follow the Host's agent
protocol, and the Host enforces three promises:

- The person's unsaved words are saved as a *user version* before your change
  touches anything.
- Your change lands whole, as an *agent version* — or not at all. A result
  identical to what you started from writes no version.
- If the person edited while you worked, your result is **not applied**: it
  waits beside the document for them to apply or discard. Report that
  honestly; never try to force past it.

## Always read before you write

```bash
python3 ~/.claude/skills/logue/logue.py read <link>
```

It prints a small header and then the body as Markdown:

```
---
id: doc_7c5095ec3f0daffa
title: ContextCenter
revision: 36
link: http://127.0.0.1:8787/documents/doc_7c5095ec3f0daffa
sources: 2
---
## 需求
...
```

**Keep the `revision` number.** A replacing write hands it back, and the Host
refuses one made against a revision that has since moved on. That refusal is
the point: read again, re-apply your change to the new text, and write again.

## Adding to the end — the safe write

```bash
python3 ~/.claude/skills/logue/logue.py append <link> --file - <<'EOF'
## What I found

The build fails because ...
EOF
```

`append` cannot overwrite anything, so it needs no revision. Prefer it
whenever the job is "add a section", "write your findings here", "leave a
summary". It keeps the same two promises as a replacing write: the person's
unsaved words are saved as their version first, and your addition lands as an
agent version.

## Replacing the body

```bash
python3 ~/.claude/skills/logue/logue.py write <link> --revision 36 --file draft.md --label "tightened the plan"
```

Read, change what needs changing, send the **whole** new body. `--label` is a
few words `versions` shows beside your version; the person's own History list
shows a written line instead.

The answer tells you what happened — repeat it to the person:

- `Applied as v4 (agent version)` — it landed.
- `No change against the base; no version was written.` — your output matched
  what you started from.
- `The person edited this document while you worked. Nothing was overwritten …`
  — your result is waiting on the document for their review. Report that and
  stop.

If it answers `Refused: This document has moved on to revision N` — read
again, re-apply your change, write again with the new number. Never reach for
`--force` to get past a refusal; say what happened instead.

## Long tasks — fix your base first

For work that takes a while (research, a big rewrite), do not hold a `read`
open in your head. Fix the base at the start, work, then commit:

```bash
python3 ~/.claude/skills/logue/logue.py begin <link>
# prints `base: rev_…` and the body to work from
python3 ~/.claude/skills/logue/logue.py commit <link> --base rev_… --file result.md --label "…"
```

`begin` is also where the person's unsaved edits get saved, so run it before
you start working, not after. `commit` answers the same three ways `write`
does.

## The rest

```bash
logue.py list [words]              # documents, newest edit first, with their links
logue.py create --title "Notes" --file plan.md   # your content becomes an agent version
logue.py versions <link>           # the history: v3  agent  2026-08-19…  tightened the plan
logue.py read <link> --body        # body alone, nothing else — good for piping
logue.py status                    # is the Host answering, and with which model
```

`--text "..."` works anywhere `--file` does. `--file -` reads stdin.

`[Source 1]`, `[Source 2]` … in a body are Logue's citations, pointing at the
Sources listed under the document. **Leave them attached to the sentences they
belong to, and never invent a new one** — a citation that points at nothing is
worse than no citation, in a product whose whole claim is that every sentence
can be traced.

## Rules

- **Read before every replacing write**, and pass the revision you read.
- **Add rather than replace** when either would do.
- **Do not delete documents.** If deleting looks like the answer, say so and
  let the person do it.
- **Keep the person's words.** You are writing into their notes, not producing
  a document of your own. Do not reformat, translate or tidy what you were not
  asked to touch — including the parts you are only passing through on a
  replacing write.
- **Answer in the document's language.** A Chinese document gets Chinese.
- **Report the Host's ruling as it stands** — applied, unchanged, or waiting
  for the person — and check it landed with `read --body` when it applied.

## When it does not work

- `No Logue Host is answering at ...` — the Host is not running. It is a login
  item; tell the person rather than trying to start something.
- The link came from a dev server on another port: this is handled — the tool
  falls back to `http://127.0.0.1:8787`. Set `LOGUE_HOST` if the Host lives
  somewhere else (`LOGUE_HOST=192.168.1.10:8787`).
- Given no link at all, run `list` and ask which document.
