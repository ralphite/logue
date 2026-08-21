# Real-browser checks

Every check in here drives a **real Chrome with the real extension installed**,
against the **real Host**, and asserts what is on screen. They exist because
this product's promises — the caret it lands on, the panel surviving an update,
the answer you can still reach — are not things a unit test can see.

They lived in a session scratchpad until 2026-08-09, which meant they died with
the session that wrote them. That made S3 ("re-verify everything checked under
the stand-in, once there is a real key") a rewrite rather than a rerun. Hence
this directory.

## Speech, for the voice checks

**The fake microphone does not work in this Chrome, and it fails silently.**
Measured 2026-08-09 on Chrome for Testing 151.0.7922.76:
`--use-file-for-fake-audio-capture` is accepted, `getUserMedia` succeeds,
`MediaRecorder` writes a WebM — and the peak level is **0**. Mono, stereo,
48k, 44.1k, 16k, inside the repo and out: every variant silent. Drop the flag
and Chrome's own fake device gives peak 1.03 and 74KB in five seconds, so the
pipe is fine; it is the file that never plays.

This is worse than a broken flag, because nothing fails. The recording is
made, the Host takes it, and a model handed silence used to answer with a
fluent sentence nobody said — which read as "the model heard it wrong", not as
"there was nothing to hear". Every earlier voice check that claimed a real
transcript through this harness was measuring silence.

So the question is split in two, and neither half pretends to be the other:

**Does the model hear real speech properly?** — `node scripts/qa/speech.mjs`.
No browser. macOS `say` speaks a filler-heavy sentence, it goes straight to the
Host, and the output is printed next to what was said so it can be read rather
than counted. It also posts pure silence and asserts an empty transcript back.

**Does the browser half work — bar, caret, queue, the ten-minute ceiling?** —
launch without `LOGUE_TEST_AUDIO` and use Chrome's built-in fake device. It is
a tone, not speech, so it proves the plumbing and says nothing about words.

**And when a check needs real words in a real browser** — a transcript to
rewrite, say — `LOGUE_TEST_REAL_MIC=1` drops the fake device and leaves Chrome
on the machine's own microphone. The check speaks with `say` and the recording
hears it through the room. Measured 2026-08-11: peak 0.0434, 400KB in five
seconds, against 0 for every file-backed variant including a stereo 48k
re-encode. It needs the speakers audible and nothing plugged into the
headphone jack, so it is opt-in — but it is the only way to get real speech
through a real recording, and `n4` uses it.

**Before trusting any browser-side voice check**, run the gate:

```bash
node scripts/qa/cdp.mjs 9899 ./scripts/qa/mic-level.mjs
```

It records five seconds and reports the peak. If that is 0, everything
downstream is measuring nothing.

And give a recording something to record: accepting the moment the tick
appears captures about seven tenths of a second, which transcribes to
nothing. Four seconds is a sentence.

## Running one

```bash
./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
node scripts/qa/cdp.mjs 9899 ./scripts/qa/<check>.mjs
```

`LOGUE_TEST_EXTENSION=<dir>` loads a build that has not been deployed — checking
a change otherwise means installing it over the machine's own Logue first.

`browser.sh` launches real Chrome on a throwaway profile with the installed
extension registered as unpacked — not `--load-extension`, which Chrome
disables the moment an extension reloads itself. It refuses a port that is
already in use: two Chromes on one port send your clicks to the wrong browser,
which has happened.

Logged-in sites (Notion, Google Docs) are **not** in here. Those must be driven
in the owner's own Chrome — their rule, and the only honest way to test a page
that needs their account.

## Rewritten for the panel N13 left behind (2026-08-19)

Four checks were written against the panel's old four tabs — Chat · Dictation ·
This page · Project. They were left failing on purpose while N13 was still a
proposal, because rewriting them against a panel about to change is work thrown
away twice. The panel settled, and all four have been rewritten against one
list and one composer: `audit-ext`, `cuj-panel`, `a1`, `x38`. `n13` covers the
journey itself — a passage pushed from the page, and the entry that comes of
keeping it.

`cuj-web` still points at `http://127.0.0.1:5173`, a dev server. Everything
else reads the installed app at `:8787`.

**A failing check here is not evidence of a working product, and not evidence
of a broken one either — read the reason before either.**

## What each one covers

| check | what it proves |
|---|---|
| `cuj-voice` · `cuj-selection` · `cuj-panel` · `cuj-web` · `cuj-ask` · `cuj-gdocs` | the ten journeys, end to end |
| `audit-states` | loading, error and oversized-answer states on the web routes |
| `audit-ext` | the panel and the page overlays measured against the type system |
| `overlay-states` | the four states of what Logue puts on a page |
| `f3-states` | the same four for the panel's agent |
| `f3a` · `f3b` | ⌘⇧K opens and listens; the agent shows its working and asks before it writes |
| `mic-level` | whether the fake microphone is feeding audio at all — the gate for every check below |
| `speech` | real speech through the real model, and silence transcribing to nothing (no browser) |
| `f8-versions` | the version model over the real Host: saves dedup, an outrun agent commit waits, apply keeps the person's words first, restore deletes nothing (no browser) |
| `subpage` | a child born under its parent, and a rename reaching every link wearing the old name while chosen words stay (no browser) |
| `d2d3` | a kept item's words edited in the panel; a Skill's answer landing there and nowhere else |
| `f5` | words learned from decisions, suggested from writing, never from transcripts |
| `f6` | the transcription Skill is the one in the slot, and its words are the plan |
| `f7` · `x26f7` | real paths in the address bar, sections opening on a draft |
| `v7` | a rewrite decided change by change |
| `p5` | the panel's keys leave typing alone |
| `remote-host` | the address in the panel is what the extension calls — a second Host, and a real https tunnel |
| `n4` | Dictation: one control that morphs where it is, a transcript, and Skills chained over it (needs `LOGUE_TEST_REAL_MIC=1`) |
| `n5` | nothing said is lost: no Host at all, and a Host whose model refuses (`n5-hosts.sh start` first; needs `LOGUE_TEST_REAL_MIC=1`) |
| `n7.py` | the spans the Host writes are spans Phoenix accepts, nests and shows (`phoenix serve` first) |
| `notion-shape` | the page list and the page against Notion's own measurements — row, column, and the whole type scale |
| `tree-hover` | the fold takes the page glyph's slot under the pointer, the way Notion's does |
| `editor-typing` | the drawn bullet is still text: the caret opens it, typing lands, and the document is left as it was found |
| `contrast` | every piece of text on the five routes, against what is really behind it |
| `probe-hosts` | where the injected bar lands on a real chat composer (`PROBE_URL=`) |
| `bar-anchor` | the selection toolbar sits on the selection, with Skill names you can read |
| `shots` · `panel-shot` | the screens a review needs, captured from the running product (`LOGUE_SHOTS=`) |
| `skill-order` | Skills follow the person's order on the toolbar, its menu and the Skills page — and the menu stacks one line per Skill |
| `rendered-blocks` | the quote, the fence, the divider and the page link hold Notion's measured numbers, read off the words themselves |
| `markdown-parity` | the second pass's eight parities — continuation columns, hidden tildes, quote depth, the band, renumbering, h4–h6, link titles, references — on the words and the bytes |
| `save-conflict` | one writer, one refusal: saves run in turn, a 409 stops the stream, Keep mine recovers |

## S3 — the day a real key arrives

Everything marked ⚠️ mock in `docs/spec/tasks.md` was proved through the
stand-in, which shows the plumbing and says nothing about the words. With a key
in Settings, rerun in this order and read the **output**, not just the count:

1. `speech` — the Skill's promise is "only remove", and a real model is the
   only thing that can break it. Done 2026-08-09: every tic gone ("um", "uh",
   "you know", a stuttered "I I"), every word that carries meaning kept,
   nothing added, and silence transcribing to nothing. The softer filler
   ("basically", "the thing is", "right?") comes and goes run to run — the
   check reports it rather than asserting on it, because that judgement is
   yours. `f6` still covers the other half: that the Skill in the slot is the
   plan that was frozen onto the Source.
2. `audit-states` — the three states at real latency, not a stand-in's one-second sleep.
3. `f5` — a correction learned from a real mishearing rather than a typed one.
4. `f3b` — whether the agent *chooses* well: does it search before answering,
   does it cite, does it propose a change only when one is wanted.
5. `v7` — whether the proposed rewrite is worth accepting, not merely well-shaped.
6. `cuj-voice`, `cuj-gdocs` — real transcription of real speech.

A check that passes here still proves nothing about quality. That judgement is
the owner's, and it is why S3 exists.
