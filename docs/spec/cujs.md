# Critical user journeys

The rebuild is done when all ten pass **in a real browser** against a real Host and real Gemini. Each has a done-test that is observable, not inferred. Verification uses `.logue-data` in this repo; the user's installed Host and its data are never touched.

Speech is injected with Chrome for Testing `--use-file-for-fake-audio-capture=<wav>`, so transcription is genuinely exercised.

---

**CUJ 1 · Voice into any editable page** — Notion doc
Focus a paragraph → mic sits beside the caret → record → candidate appears → ⌘↵.
✅ Text lands at the caret; Undo restores; a voice Material with audio exists.

**CUJ 2 · Voice into Google Docs**
Same flow inside `docs.google.com`, whose editor is a canvas, not a contenteditable.
✅ Text lands in the document; Material saved with the Doc as source.

**CUJ 3 · Save a selection**
Select text on an article → Save.
✅ Selection Material with exact quote, page URL, title, timestamp; visible in Stream.

**CUJ 4 · Comment on a selection**
Select → voice comment (and text comment).
✅ Derived Material whose `parent_ids` points at the selection; original quote unchanged.

**CUJ 5 · Ask with sources**
Side Panel → Ask a question about the Project.
✅ Answer cites `[Source n]`; Run stores frozen source set + skill revision; the question itself is saved as a You Material; clicking a citation opens that Source.

**CUJ 6 · Draft a document**
Run Draft over a Project.
✅ Document created with citations; opens in Web; edits autosave; export markdown works.

**CUJ 7 · Side Panel page capture + Project**
Capture the current page, assign a Project.
✅ Page Material exists with membership; Project view lists it.

**CUJ 8 · Organize the Stream**
Search, assign to Project, exclude from context, delete.
✅ Each action persists across reload; excluded item stops feeding generation.

**CUJ 9 · Skills**
Edit a built-in prompt, create one, set it as a surface default, run it on a selection.
✅ Run uses the edited prompt; the Run records which revision it used.

**CUJ 10 · Settings**
Connect a model (Test → Save), change voice defaults, export a backup.
✅ Failed connection reads as failed (not green); after save generation works; the export bundle contains materials, audio, projects, documents, skills, settings.
