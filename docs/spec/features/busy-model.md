# A busy model — declaration

Status: **declared and built** (2026-08-13). Covers what happens between a
model saying "not this second" and a person being asked to do anything about
it. Written from his report: a 1:05 recording came back as

> Model rejected the request (503). { "error": { "code": 503, "message": "This
> model is currently experiencing high demand. Spikes in demand are usually
> temporary. Please try again later.", "status": "UNAVAILABLE" } } The
> recording was kept — you can try again.

with a `Try again` link under it. His words: *"auto retry when this err"*.

## What it is for

A model that is busy for four seconds should cost the person nothing. The
waiting is the machine's job; the button is the last resort, not the first
answer.

## The surface

**A recording being transcribed** (panel row, one per recording)

- Working, as before: spinner · `Transcribing…`
- Being asked again: the recording's own audio player, and under it
  spinner · `The model was busy. Trying again…`
- Given up on: the audio player, then
  `The model is busy (503). The recording was kept — you can try again.`, then
  `Try again` — the state that exists today, reached later and less often.
  - The service's own body — `{"error":{"code":503,"message":"This model is
    currently experiencing high demand…` — is **not** shown. It was, braces
    and all, in a red box beside a recording. It is printed in the Host's
    terminal instead, where a failure is looked into.
  - A refusal that is *about the request* — a bad key, a malformed call —
    keeps its detail on screen. That is the one a person has to act on.
- Heard: the transcript. The waiting line disappears with it; nothing stays on
  screen to say a row once had trouble.

**A recording being dictated into a page** (the bar at the caret)

- No new words. The bar already shows the count of recordings still settling,
  and one being asked again is one still settling. The error balloon and its
  `Try again on the kept recording` appear only once the attempts are spent.

**Everything else a model does** (asks, rewrites, titles, filing)

- No new words at all. The Host's own attempts are invisible: the answer
  simply takes a few seconds longer, or the same failure arrives as today.

## The rhythm

| Where | Attempts | Waits | Total |
|---|---|---|---|
| The Host, inside one request | 4 | 1s · 2s · 4s | ~7s |
| The surface, on the kept recording | 2 more | 5s · 15s | ~30s more |

- A `Retry-After` from the service replaces the wait, **capped at 20 seconds**.
  Longer than that is a queue, not a spike, and the person is told instead.
- **Only these are retried**: 408, 425, 429, 500, 502, 503, 504, and a
  connection that never landed. Everything else — 400, 401, 403, a safety
  refusal, a bad key — is reported the first time, unrepeated.
- The audio is on the Host before the model is asked, so every attempt after
  the first re-transcribes the same recording. Nothing is uploaded twice and
  no second recording is ever created.
- Each attempt the Host makes prints one line in its terminal:
  `Model busy on gemini-3.6-flash; asking again in 2s (attempt 3 of 4).` — and
  when it stops, one more carrying what the service actually said.
- The background worker's five-minute sweep is unchanged and still behind all
  of this: recordings from the last half hour, three attempts each.

## The model's part

None. No prompt changes; the same request is sent again unaltered.

## What it must never do

- Never repeat a request the model has decided about. A rejected key repeated
  four times is the same answer, thirty seconds later.
- Never retry forever, and never in the background where nobody can see it.
  Two visible attempts, then the person's button.
- Never let the waiting hide the recording. The audio player is on the row
  while it waits, because "we are trying again" must not read as "it is gone".
- Never claim to be trying again while doing nothing — the line appears only
  around a real attempt, and goes when the attempts do.
- Never hold the microphone. Asking again happens off to the side; a new
  recording can start at any point during it.

## Open questions

None outstanding. One judgement call worth naming: the surface stops after two
attempts (~30s) rather than continuing quietly, on the grounds that a person
who spoke a minute of audio is standing there waiting, and a spinner with no
end is worse than a button.
