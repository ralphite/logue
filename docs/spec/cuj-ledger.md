# CUJ ledger

Every journey run against a real Host, a real model, and a real browser. Speech
is injected with Chrome for Testing's `--use-file-for-fake-audio-capture`, so
transcription is genuinely exercised rather than stubbed.

Last run: 2026-08-08 · extension 1.0.0 · Host on `.logue-data` · Gemini 3.6 Flash

| # | Journey | Result | Evidence |
|---|---|---|---|
| 1 | Voice into any editable page | PASS | spoken WAV → "Logue, Vibedoc, Gemini, Codex, Storybook, Tailwind CSS." → appended at the caret; voice Material with 1,766 bytes of retrievable audio |
| 2 | Voice into Google Docs | PASS* | bar anchors with no focusable editable; text delivered through `beforeinput` at the hidden sink; Material saved against `docs.google.com` |
| 3 | Save a selection | PASS | selection Material with the exact quote, page URL, and timestamp |
| 4 | Comment on a selection | PASS | comment stored as `derived` with `parent_ids` → the quote |
| 5 | Ask, in the page, with citations | PASS | 7 Sources frozen; `[Source 2]` chip opens "Asynchronous research removes the pressure of the moment." |
| 6 | Draft a document | PASS | Run complete, citations `[2,1]`, Document carries the frozen Sources, markdown export lists them |
| 7 | Side Panel | PASS | renders, reads Projects, answers with citations `[10,15]` |
| 8 | Organize the Stream | PASS | 123 rows listed; excluded Source kept out of generation; deleting a Source repoints its child and marks it orphaned |
| 9 | Skills | PASS | editing a prompt bumps revision 2 → 3; the earlier Run still reports revision 2 |
| 10 | Settings and backup | PASS | readiness reported honestly; export preview counts 131 Sources, 15 Documents, 173 recordings |

\* CUJ 2 runs against a structural stand-in served as `docs.google.com`: a canvas
page whose hidden `[aria-label="Document content"]` sink lives in an iframe.
That exercises the real code path — hostname check, cross-frame sink lookup,
`beforeinput` insertion — but it is not Google's own editor. Verifying against a
real Doc needs a signed-in Google session.

## What running these found

Five failures that no unit test would have caught, each invisible until the
product was actually used:

1. `:host { all: initial }` left the shadow host `position: static`, trapping
   every surface in the host's own stacking context. Correct layout, correct
   size, hit-testable in isolation — and completely invisible on Notion.
2. The offscreen recorder was addressed as a bare `offscreen.html`, which
   resolves to the extension root. Recording failed on every installed build
   while working perfectly from an unpacked one.
3. The transcript panel was placed from the live caret, so when focus left the
   editor the transcript became unreachable.
4. Insertion refocused the editor, which puts the caret at its start, so speech
   landed at the top of the document instead of where the person was writing.
5. Tracking ran only on `requestAnimationFrame`, which never fires in a hidden
   tab.

## Running them

```bash
npm run build && bash scripts/deploy.sh     # one version on the machine
node scratch/cdp.mjs 9666 scratch/cuj-voice.mjs
```

The drivers live outside the repo because they carry machine-specific paths;
what they assert is recorded above.
