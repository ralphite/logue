# Detailed design review — the process

Every user-visible decision is **declared before it is built** and **reviewed by
other agents before it lands**. The high-level designs were good; the mistakes
came in at the level nobody wrote down — the exact words on screen, the empty
state, the failure state, the rhythm of an automatic action. This is the level
this process governs.

Written 2026-08-12, after a day of reading the shipped product surfaced nine
defects of exactly this kind in one sitting (`Filed to Logue because the voice
input explicitly discusses…`, `v2..v7` from one sentence, `no visible change`
as a history line, a panel dictation labelled "Dictated into a page").

## What must be declared

A **decision** is anything the person can see, read, or feel the timing of:

1. **Words** — every string on screen. Labels, empty states, errors, receipts,
   tooltips, buttons.
2. **Model-written words** — any prompt whose output is shown. The prompt is
   UI. It gets a length, a register, and a list of forbidden moves.
3. **States** — what each surface shows when it is empty, loading, failed,
   partial, or holding too much.
4. **Rhythm** — anything automatic: when it fires, how often it writes, what it
   costs the person to undo.
5. **Vocabulary** — the name of a thing, used identically everywhere.

If a change touches none of these, it is not a design decision and skips this
process.

## The declaration

One Markdown file per feature under `docs/spec/features/<name>.md`, written
**before** the code. Sections, in order:

- **What it is for** — one sentence, the person's purpose, not the mechanism.
- **The surface** — every state, each with the exact words. Copy is quoted
  verbatim, not described.
- **The rhythm** — every automatic action: trigger, frequency, what it writes,
  how it is undone.
- **The model's part** — every prompt that produces shown text, with its
  spec: max length, register, forbidden moves, and a worked example of good
  and bad output.
- **What it must never do** — the failure this design exists to prevent.
- **Open questions** — anything the owner must rule on. Never guessed.

## The review starts at the proposal, not the code

Added 2026-08-13, his words: *"review feature design with subagent (always).
review ext panel design. too many issues."* A mock and a written plan are
declarations too — the three questions below apply to them before a line of
product code exists, not only to the finished feature. Skipping straight to
code review meant the first read of a design was also the last chance to
change it cheaply.

## The review

Three independent agents read the declaration — a proposal doc, a mock, or
the shipped code — against what it claims to do. They do not coordinate, and
none of them wrote it. Each returns findings, or nothing.

| Reviewer | The single question it asks |
|---|---|
| **Copy** | Does every string say a fact plainly? Any justification, chattiness, filler, or the same thing named two ways? |
| **Behaviour** | Does the declared rhythm make sense to a person? Does an automatic action produce noise they must wade through? |
| **Design-fidelity** | Does the implementation match what the owner approved — every state, every verb, nothing silently folded away? |

A finding must name the file, the line, and what the person would see. A
reviewer that cannot say what the person sees has not found anything.

Findings are then **verified against the running product** — the claim is read
off a real screen, not off the source. A finding that survives verification is
fixed or, when it is a matter of taste, raised with the owner. Nothing is
dismissed silently.

## The gates

Before any of this reaches the owner's machine:

1. `npm run lint` · `npm run typecheck` · `npm test` — the existing four.
2. **The copy inventory** (`scripts/qa/copy-inventory.mjs`) — every
   user-visible string in the repo, with file and line. Checked in. A change
   to it shows up in the diff, so no new string lands unread.
3. **Used like a person** — the real product, real Host, real model: the flow
   is performed and every line on screen is read. A screenshot is the proof.
4. The behaviour goes into `behaviors.md`; anything a script can assert gets
   a check under `scripts/qa/`.

## Reflection — does the process itself work

Every pass ends by asking: **did this find what a person would have found?**
The measure is defects the owner reports *after* a feature passed review. Each
one is a hole in the process, and the fix is a change to this file — a new
reviewer question, a new gate — not just a fix to the feature. That history is
kept at the bottom of this file so the process is answerable for itself.

### Holes found so far

- **2026-08-12 — the first nine.** Found by the owner using the product, not by
  any gate. Causes: mocks covered layout but never microcopy, empty states, or
  the rhythm of automatic writes; prompts producing shown text were never
  reviewed as UI; verification proved "it runs" and never "read every word".
  All three are now gates above.
- **2026-08-13 — a check took away what it could not put back.** `f7.mjs`
  proved the provider round trip by writing `api_key: "mock"` and "restoring"
  `api_key: "mock"` — correct in the weeks the workspace held the stand-in key,
  and on a real one it replaced the owner's Gemini key with the word `mock`.
  Nothing failed; the check passed. It came back from a backup taken an hour
  earlier for an unrelated reason, which is luck, not a process.
  **The rule this adds:** a check may only change what it can read back and
  write again. A key cannot be read back — no endpoint hands one out, by
  design — so no check may write one. Where a check cannot restore, it says so
  out loud and skips that half; a short green run must never be mistaken for a
  complete one.
  **And the gate:** anything that writes to `/v1/model`, `/v1/settings` or any
  other singleton reads it first, restores it last, and asserts the restore.
