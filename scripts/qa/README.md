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

Chrome's fake microphone plays silence, and a real model correctly hears
nothing in it — so every voice check needs a file with words in it:

```bash
say -o scripts/qa/spoken.wav --data-format=LEI16@48000 \
  "This sentence was spoken aloud by the test, so the model has something real to hear."
python3 -c "import wave;src=wave.open('scripts/qa/spoken.wav');p,f=src.getparams(),src.readframes(src.getnframes());out=wave.open('scripts/qa/spoken-loop.wav','wb');out.setparams(p);[out.writeframes(f) for _ in range(67)];out.close()"
LOGUE_TEST_AUDIO="$PWD/scripts/qa/spoken-loop.wav" ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
```

The loop matters: Chrome plays the file **once** and then feeds silence, so a
recording started a minute in hears nothing and the check fails looking
exactly like a broken feature. The looped file is not committed — it is 28MB
of the same sentence; the command above rebuilds it.

And give a recording something to record: accepting the moment the tick
appears captures about seven tenths of a second, which transcribes to
nothing. Four seconds is a sentence.

## Running one

```bash
./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
node scripts/qa/cdp.mjs 9899 ./scripts/qa/<check>.mjs
```

`browser.sh` launches real Chrome on a throwaway profile with the installed
extension registered as unpacked — not `--load-extension`, which Chrome
disables the moment an extension reloads itself. It refuses a port that is
already in use: two Chromes on one port send your clicks to the wrong browser,
which has happened.

Logged-in sites (Notion, Google Docs) are **not** in here. Those must be driven
in the owner's own Chrome — their rule, and the only honest way to test a page
that needs their account.

## What each one covers

| check | what it proves |
|---|---|
| `cuj-voice` · `cuj-selection` · `cuj-panel` · `cuj-web` · `cuj-ask` · `cuj-gdocs` | the ten journeys, end to end |
| `audit-states` | loading, error and oversized-answer states on the web routes |
| `audit-ext` | the panel and the page overlays measured against the type system |
| `overlay-states` | the four states of what Logue puts on a page |
| `f3-states` | the same four for the panel's agent |
| `f3a` · `f3b` | ⌘⇧K opens and listens; the agent shows its working and asks before it writes |
| `f5` | words learned from decisions, suggested from writing, never from transcripts |
| `f6` | the transcription Skill is the one in the slot, and its words are the plan |
| `f7` · `x26f7` | real paths in the address bar, sections opening on a draft |
| `v7` | a rewrite decided change by change |
| `p5` | the panel's keys leave typing alone |

## S3 — the day a real key arrives

Everything marked ⚠️ mock in `docs/spec/tasks.md` was proved through the
stand-in, which shows the plumbing and says nothing about the words. With a key
in Settings, rerun in this order and read the **output**, not just the count:

1. `f6` — then say the owner's own filler-heavy sentence out loud and read what
   comes back. The Skill's promise is "only remove"; a real model is the only
   thing that can break it.
2. `audit-states` — the three states at real latency, not a stand-in's one-second sleep.
3. `f5` — a correction learned from a real mishearing rather than a typed one.
4. `f3b` — whether the agent *chooses* well: does it search before answering,
   does it cite, does it propose a change only when one is wanted.
5. `v7` — whether the proposed rewrite is worth accepting, not merely well-shaped.
6. `cuj-voice`, `cuj-gdocs` — real transcription of real speech.

A check that passes here still proves nothing about quality. That judgement is
the owner's, and it is why S3 exists.
