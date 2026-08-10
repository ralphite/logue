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
format: markdown
sources: 2
---
## 需求
...
```

**Keep the `revision` number.** A write that replaces the body must hand it
back, and the Host refuses a write made against a version that has since moved
on. That refusal is the point: the person may have typed something into the
same document while you were reading it.

## Adding to the end — the safe write

```bash
python3 ~/.claude/skills/logue/logue.py append <link> --file - <<'EOF'
## What I found

The build fails because ...
EOF
```

`append` cannot overwrite anything, so it needs no revision. Prefer it whenever
the job is "add a section", "write your findings here", "leave a summary".

## Replacing the body — when the whole thing changes

```bash
python3 ~/.claude/skills/logue/logue.py write <link> --revision 36 --file draft.md
```

Read, change what needs changing, send the **whole** new body. `--title "..."`
renames at the same time.

If it answers `Refused: This document has moved on to revision N` — read again,
re-apply your change to the new text, and write again with the new number.
Never reach for `--force` to get past a refusal; that is how the person's
paragraph disappears.

## The rest

```bash
logue.py list [words]              # documents, newest edit first, with their links
logue.py create --title "Notes" --file plan.md
logue.py versions <link>           # what each version changed
logue.py read <link> --body        # body alone, nothing else — good for piping
logue.py read <link> --raw         # the stored HTML, when exactness matters
logue.py status                    # is the Host answering, and with which model
```

`--text "..."` works anywhere `--file` does. `--file -` reads stdin.

## What the format actually is

Logue stores its editor's HTML; this tool converts both ways, so **you read and
write Markdown**. Headings, lists, `**bold**`, `*italic*`, `` `code` ``,
`[links](url)` and `==highlight==` survive the round trip.

One line is one block. A blank line is a blank line — this is not CommonMark,
and two adjacent lines stay two paragraphs, because that is how Logue's editor
behaves. Write the body the way you want to see it.

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
- **Check it landed**: the command prints the new revision, and `read --body`
  shows what is actually stored now.

## When it does not work

- `No Logue Host is answering at ...` — the Host is not running. It is a login
  item; tell the person rather than trying to start something.
- The link came from a dev server on another port: this is handled — the tool
  falls back to `http://127.0.0.1:8787`. Set `LOGUE_HOST` if the Host lives
  somewhere else (`LOGUE_HOST=192.168.1.10:8787`).
- Given no link at all, run `list` and ask which document.
