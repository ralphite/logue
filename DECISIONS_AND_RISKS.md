# Decisions and risks

This is the project's visible decision record. It exists so a design or engineering
tradeoff never becomes a hidden constraint that the user discovers only after a
feature fails.

## Working agreement

- Create this file at the beginning of every project and link it in the initial
  project update.
- Before choosing an implementation that can materially affect a core workflow,
  permissions, data, security, delivery, performance, architecture, or user
  interaction, add a concise entry below.
- State the user-visible downside, alternatives considered, evidence, and whether
  the choice needs the user's decision. Do not disguise an unresolved tradeoff as
  a completed feature.
- Tell the user about any open **P0/P1** item or any choice that changes the
  expected workflow before relying on it. Routine, reversible implementation
  details do not need a separate approval.
- When real use exposes an issue, update this file in the same work batch with
  the evidence and the next smallest fix. Remove resolved entries only after
  direct user-flow verification; keep the decision summary under **Resolved**.
- Keep entries concrete. This is not a speculative risk dump: record only choices
  with a plausible user impact or a real observed failure.

## Open

### DR-001 — Extension microphone permission surface

- **Priority:** P0
- **Status:** implementation in progress; real Chrome verification required
- **Decision:** Native Chrome Side Panel recording uses the extension origin, not
  the webpage's microphone permission. In real Chrome, requesting microphone
  access directly from the Side Panel can be dismissed without displaying the
  browser prompt. We request the one-time permission from a small foreground
  Logue extension page, then record in the Side Panel.
- **Why it matters:** A page may record successfully while Logue still cannot;
  webpage permission does not grant the extension microphone access.
- **Tradeoff:** The first use may briefly open a normal Chrome permission page.
  It must be a one-time browser consent, not an extra Logue confirmation, and it
  must not block later recording.
- **Evidence:** Reproduced in the real ChatGPT Chrome tab: Side Panel
  `getUserMedia` returned `NotAllowedError: Permission dismissed` while the
  extension microphone permission was still `prompt`.
- **Next proof:** In a real Chrome page, allow the Logue extension microphone
  prompt once, start recording, then cancel without creating test data. Repeat in
  an actual Google Docs editor.

### DR-002 — Google Docs input recording

- **Priority:** P0
- **Status:** not complete
- **Decision boundary:** Google Docs edits through a nested editor frame. Its
  frame and the content script do not reliably inherit microphone access. The
  extension must therefore keep recording independent of the page and must not
  assume that a page-level input or iframe is available.
- **User-visible requirement:** Opening Logue on a real Google Docs editor must
  show a working Record action. The compact in-editor voice action must also be
  discoverable and cannot silently fail because the Docs frame changes.
- **Evidence:** Real Docs investigation showed its text event iframe is the
  current recording origin; direct page/frame microphone capture is the fragile
  path. Fixture-page success is explicitly not completion evidence. On
  2026-08-03, the real Docs inline control was reproduced stuck at “Starting
  microphone”; an initial background/offscreen route build did not fix it, and
  a stale top-frame proxy state could show Cancel/Starting while the editor
  frame was still idle. After a fresh unpacked-extension reload and Docs
  refresh, a direct-frame control attempt still left the real editor at Start
  with no recording state or local error. A subsequent direct message to that
  freshly located `about:blank` frame was rejected by Chrome, and the control
  now exposes the actionable local error `Could not reach the active Google
  Docs editor.` rather than hiding it. On 2026-08-03, after reloading the
  unpacked extension and the real signed-in Docs page for each attempt, all of
  these still failed to reach the editor: background frame routing, DOM
  mutation bridging, parent/child `postMessage`, and a child-frame Chrome
  `runtime.Port` with `match_origin_as_fallback`. This is an active P0 failure,
  not a completed fix. The native Side Panel can record on that same real Docs
  tab, but it is not evidence that the required in-editor action works.
- **Next proof:** Verify the actual Docs editor with the extension permission
  granted; record and cancel without editing the document. Then verify the
  in-editor action appears and its accept/cancel state works.

### DR-003 — Real Docs transcription evidence

- **Priority:** P0
- **Status:** partially verified; spoken-audio insertion remains unproven
- **Decision:** Do not add a fallback or page-change guard for an empty
  recording. A user must be able to start, cancel, stop, and immediately try
  again; a no-speech result is a local error, not a blocked recorder state.
- **Evidence:** On 2026-08-03, after reloading the current unpacked extension
  and the signed-in Docs editor, the canvas launcher changed from `Start` to
  `Cancel` + `Stop and insert`; Stop reached `Transcribing and inserting`.
  The installed unpacked folder was first found to reference stale v0.2.8
  assets, so the current v0.2.10 build was atomically staged under the same
  Chrome extension identity and Docs was refreshed before repeating the run.
  The automated run captured no human speech, so Gemini returned no text. The
  error is now the product copy `Couldn't transcribe. Recording saved.` and
  Start remains immediately available. This verifies the current real Docs
  routing and recorder lifecycle, but not a spoken-audio save and one-time
  insertion.
- **Open downside:** The automated environment cannot supply a trustworthy
  human microphone sample. Claiming full Docs insertion without one would be
  false evidence.
- **Next proof:** Record a short spoken phrase in the real Docs editor; verify
  it is saved once, inserted once, and does not trigger a Docs command. The
  separate keyboard-reachability P1 remains open.

### DR-004 — Current-build Chrome QA asset

- **Priority:** P1
- **Status:** active until the next verified Release
- **Decision:** For real current-code QA, the existing unpacked Extension keeps
  its stable root and Chrome identity, while its manifest points to a copied
  `releases/workspace-current` build. The previous v0.2.8 assets remain intact
  beside it for rollback.
- **Why it matters:** Reloading an unpacked Extension does not load workspace
  files when its manifest points at an older versioned asset. Without this
  switch, a real browser test can accidentally test a stale Release.
- **User-visible effect:** Existing Chrome storage and permissions remain. This
  is a local QA build, not a Release; the next verified Release must replace it
  through the normal installer path.

## Resolved

Move an item here only after its stated direct user-flow proof passes. Keep its
decision and evidence so later work does not reintroduce the same hidden choice.
