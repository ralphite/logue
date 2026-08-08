# Landscape

Researched 2026-08-08. Every claim below carries the URL it was read from. Anything not confirmed on a vendor page in this session is marked **unverified** rather than guessed.

## Positioning

Logue's individual parts are all owned by someone else, and mostly by someone better funded. Hold-to-talk dictation into any field is a commodity — Aqua, Wispr Flow, Willow and MacWhisper all ship it, three of them on more platforms than Chrome. Capture-with-source-URL is free: Obsidian Web Clipper does it in eight browsers into local Markdown ([obsidian.md/clipper](https://obsidian.md/clipper)), and Zotero has saved a full local page snapshot as a child item, into a local `zotero.sqlite`, with syncing optional, for years ([zotero.org/support/adding_items_to_zotero](https://www.zotero.org/support/adding_items_to_zotero), [zotero.org/support/zotero_data](https://www.zotero.org/support/zotero_data)). Claim-to-passage citation is not just done, it is done better: Gemini Notebook (the product formerly branded NotebookLM — [support.google.com/notebooklm/answer/16268631](https://support.google.com/notebooklm/answer/16268631)) lets you hover a citation for the quoted text and click it to jump to the passage in context ([answer/16179559](https://support.google.com/notebooklm/answer/16179559?hl=en)).

One thing is genuinely unowned. **No product surveyed can tell you which prompt revision, which model, and which exact input set produced a given piece of output.** The closest anyone comes is Aqua's Edit Mode History, which stores the original selection, the result, and the words you spoke ([aquavoice.com/blog/introducing-edit-mode](https://aquavoice.com/blog/introducing-edit-mode)) — one interaction, not a general record. Everything else treats generation as a disposable event. And every tool that does claim-to-passage citation is cloud-only and account-bound: Gemini Notebook, Elicit, Perplexity, Notion, Mem, Reflect, Recall.

So the honest statement: Logue is **the only tool where a generated claim is reproducible — you can re-derive it from the frozen sources, the pinned skill revision, and the recorded run** — and the only one doing it on locally-owned data with no account. The differentiator is the Run record, not the voice bar and not the clipper. The weak half of the claim is that reproducibility is a value nobody is currently shopping for, while "text appears where my cursor is" is something people pay $12–15/month for today. Logue's front door is a commodity; its floor is not.

---

## Gap table

| Capability | Who does it best | Exact mechanism | Logue? | Why |
|---|---|---|---|---|
| Hold-to-talk dictation anywhere | Aqua | "Hold Space and speak"; text lands at the cursor in any app; macOS/Windows/iOS, cloud-processed, ~450ms ([aquavoice.com](https://aquavoice.com/), [faq](https://aquavoice.com/info/faq)) | **Yes — already core** | Table stakes. Logue's version is Chrome-scoped, which is a narrower promise than four competitors make. Do not try to win here. |
| Voice-edit a selection in place | Aqua Edit Mode | Select text → hold the *same* key → a chip reads "12 words selected" → speak the change → release → selection replaced. Follow-ups "undo that", "go back to the original". 6,000-char cap; address bars excluded ([blog/introducing-edit-mode](https://aquavoice.com/blog/introducing-edit-mode)) | **Yes** | Zero new UI: Logue already has a selection toolbar and an inline voice bar. Same key, different branch. And the rewrite is naturally a derived Material with `parent_ids` at the original. |
| Per-app / per-context prompts | MacWhisper | "App-specific prompts for dictation", Pro-only, €64 one-time ([macwhisper.com](https://www.macwhisper.com/)) | **Yes** | Maps to per-site skill defaults. One select in the Skills route. |
| Explicit, named context injection | Superwhisper | Three separately-configurable context types: *Selected Text* ("highlighted/selected in your active window"), *Application* ("text from active input fields, names, and title from your active window", needs Accessibility), *Clipboard* (copied within 3s). Most built-in modes have none on by default; only "Super Mode" has all three ([docs/common-issues/context](https://superwhisper.com/docs/common-issues/context)) | **Yes** | Logue's skills currently take context implicitly. Naming and toggling the inputs is what makes a run reproducible. |
| Prompt variables | Raycast, Readwise | Raycast: `{selection}`, `{clipboard}`, `{argument name="Language"}`, inserted with `{`; output behavior is *Open in Raycast* or *Replace Selection* ([manual.raycast.com/ai/ai-commands](https://manual.raycast.com/ai/ai-commands)). Readwise Ghostreader: full Jinja2 — `{{ }}` for values, `{% %}` for statements, with `document.title/author/content/highlights/key_sentences` and `selection`, `selection.sentence`, `selection.paragraph`, plus subroutines `most_similar`, `lexical_search`, `truncate` ([reference](https://docs.readwise.io/reader/guides/ghostreader/reference), [custom-prompts](https://docs.readwise.io/reader/guides/ghostreader/custom-prompts)) | **Yes — Raycast's syntax, not Readwise's** | Raycast's `{selection}` is learnable in one glance. Jinja2 with subroutines is a programming language in a text box. |
| Rules scoped by context | Cursor | `.cursor/rules/*.mdc` with frontmatter; four types — `alwaysApply: true`; `description` only (agent decides); `globs` (auto-attach when a matching file is in context); neither (manual `@`-mention). Plus plain `AGENTS.md` ([cursor.com/docs/context/rules](https://cursor.com/docs/context/rules)) | **Later** | The glob→URL-pattern analogy is exact and cheap. The four-way taxonomy is not; two states (always / on this site) is enough. |
| Claim → passage citation | Gemini Notebook | "You can hover over any citation to get the full quoted text right away." Select it and it "automatically navigates to the location of the quote, so you can easily view it in context." "Chat responses in Gemini Notebook only use data from your sources." ([answer/16179559](https://support.google.com/notebooklm/answer/16179559?hl=en)) | **Yes** | Logue has `[Source n]` chips already. Hover-for-quote and click-to-passage are the two interactions that convert a citation from a label into proof. |
| Provenance of the generation itself | **Nobody** | Closest is Aqua's Edit Mode History: "Every edit is saved in History with the original selection, the result, and the exact words you spoke" ([blog/introducing-edit-mode](https://aquavoice.com/blog/introducing-edit-mode)). Elicit's claim→passage mechanism: **unverified** (support article 404'd) | **Yes — this is the position** | Logue's `runs` domain already stores frozen source set + skill revision + citations. It is currently Core-with-no-emphasis. It should be the thing the product is *about*. |
| Capture to an inbox | Capacities | "Your **daily note** is your inbox. No pressure to organize. Just capture and link as you go." Objects are created ad hoc — "A meeting becomes a Meeting object" ([capacities.io](https://capacities.io/)) | **Later** | Logue's Stream is already a newest-first inbox. A date-grouping toggle is the whole delta. Not urgent. |
| Frozen source that survives link rot | Zotero, mymind | Zotero: "a copy (or snapshot) of the webpage will be saved to your computer and added as a child item" — optional, off by default ([adding_items_to_zotero](https://www.zotero.org/support/adding_items_to_zotero)). mymind Mastermind: articles "stored in their entirety – even if the original source is deleted" ([access.mymind.com/pricing](https://access.mymind.com/pricing)) | **Yes** | Logue promises a *frozen* Source. If it stores only a URL, the promise is false the first time a page 404s. |
| Offline / local-first | Obsidian, Zotero, MacWhisper | Obsidian personal use: "Free without limits. No sign-up required. No strings attached." ([obsidian.md/pricing](https://obsidian.md/pricing)). Smart Connections: "Embeddings are created locally by default. Your notes stay on your machine." ([github.com/brianpetro/obsidian-smart-connections](https://github.com/brianpetro/obsidian-smart-connections)). MacWhisper runs local Whisper models plus Ollama/LM Studio ([macwhisper.com](https://www.macwhisper.com/)) | **Yes — already core** | Logue is local for storage but calls Gemini for both transcription and generation. That is a partial claim and should be stated as one. |
| Output lands on the source, not in a chat log | Readwise Ghostreader | Highlight-level prompts: "the response is outputted to the highlight note"; the auto-summary prompt "outputs its response into the summary field in the document's metadata" ([custom-prompts](https://docs.readwise.io/reader/guides/ghostreader/custom-prompts)) | **Yes** | The cheapest structural win here. A skill run on a Material should attach to that Material, not scroll away in a panel. |

---

## Ranked candidates

Ranked by value to the capture → organize → cite-generate loop, divided by UI added. Logue's design rules cap the currency: five top-level routes, progressive disclosure, no new panels ([docs/spec/design.md](../spec/design.md)).

| # | Candidate | One line | Proven by | UI added | Loop |
|---|---|---|---|---|---|
| 1 | **Voice-edit the selection in place** | Select text → hold the mic key → speak the change → selection replaced; the edit is a derived Material pointing at the original | [Aqua Edit Mode](https://aquavoice.com/blog/introducing-edit-mode) | None. One chip ("12 words selected") on the existing voice bar | Capture + organize. Every edit becomes a parent-chained Material for free |
| 2 | **Run record as a "why this sentence" disclosure** | Click a `[Source n]` chip → see the frozen sources, the skill revision, and the model that produced the claim | Nobody — this is the gap | One fold inside the existing citations panel | Cite-generate. This is the positioning made visible |
| 3 | **Hover a citation for the quote; click to open the source at the passage** | Hover `[Source 3]` → the frozen quote in a tooltip; click → the Source opens scrolled to it | [Gemini Notebook](https://support.google.com/notebooklm/answer/16179559?hl=en) | Tooltip + scroll target. No new surface | Cite-generate. Turns a label into proof |
| 4 | **Skill output attaches to the Material it ran on** | Run a skill on a selection → the result lands on that Material, not in a transient panel | [Readwise Ghostreader](https://docs.readwise.io/reader/guides/ghostreader/custom-prompts) | None — reuses derived Materials | Organize + cite-generate |
| 5 | **Snapshot the page body at capture time** | Store the readable text of the source page alongside the URL so citations survive link rot | [Zotero](https://www.zotero.org/support/adding_items_to_zotero), [mymind](https://access.mymind.com/pricing) | None (host-side) | Capture. Makes "frozen Source" true rather than aspirational |
| 6 | **Named, toggleable context inputs on a skill** | A skill declares which inputs it takes: selection / page / project / clipboard — each on or off, and recorded in the Run | [Superwhisper](https://superwhisper.com/docs/common-issues/context) | A four-checkbox row in the skill editor | All three. Precondition for #2 being meaningful |
| 7 | **`{selection}`-style prompt placeholders** | Type `{` in a skill prompt to insert `{selection}`, `{page}`, `{project}`, `{argument name="…"}` | [Raycast](https://manual.raycast.com/ai/ai-commands) | An autocomplete menu in one textarea | Cite-generate. Makes skills reusable instead of one-off |
| 8 | **Voice undo as a follow-up command** | After a voice edit, say "undo that" / "go back to the original" | [Aqua](https://aquavoice.com/blog/introducing-edit-mode) | None | Capture. Removes the fear that makes people not use #1 |
| 9 | **Per-site skill defaults** | This skill is the default on `docs.google.com`; that one on `github.com` | [MacWhisper app-specific prompts](https://www.macwhisper.com/), [Cursor globs](https://cursor.com/docs/context/rules) | One select per skill in Skills | Organize. Low value until the user has more than ~5 skills |
| 10 | **Auto-promote repeated corrections into vocabulary** | The same heard→preferred fix three times becomes a project term without being asked | [Willow auto-learning dictionary](https://willowvoice.com/), [Superwhisper vocabulary](https://superwhisper.com/) | None — a toast at most | Capture. Logue already has `corrections` with scopes; this is plumbing |
| 11 | **Date-grouped Stream** | A toggle that groups the Stream by day, so today's captures read as an inbox | [Capacities daily note](https://capacities.io/) | One segmented control | Organize. Nice; not load-bearing |
| 12 | **Local embeddings for related-Material suggestions** | A "related" list beside a Material, computed on-device | [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) | A sidebar section | Organize — but it breaks the zero-dependency Python host. **Later, or never** |

Cut line: 1–8 are worth doing. 9–11 are cheap enough to do opportunistically. 12 costs an architecture change for a soft benefit.

---

## Do not build

| Thing | Who does it | Why it would make Logue worse |
|---|---|---|
| **Notion-style synced blocks** | Notion: with more than 10 copies, "clicking `Unsync all`, or deleting the original synced block, will remove all copies" and "Undo won't restore them" ([notion.com/help/synced-blocks](https://www.notion.com/help/synced-blocks)) | A provenance product cannot ship a data model where deleting a parent silently destroys every descendant and undo does not work. Logue's `parent_ids` chain must survive deletion of the parent. |
| **Schema-first typed objects** | Tana's supertag/field model. Note: tana.inc now markets a *meetings* product — "You'll spend 30,000 hours in meetings" — with Free (5 meetings/mo), Pro $20/mo early-bird ($30 regular), Max $80/mo ($120 regular) ([tana.inc/pricing](https://tana.inc/pricing)). The outliner is now referred to separately as "Tana Outliner"; its current status is **unverified** | Making the user define types before capturing anything inverts the loop. Capture must never be blocked on schema. The pivot away from the outliner is at least suggestive about the cost of that learning curve. |
| **Scripting/grammar files as the customization surface** | Talon: "Python Scripts" to "customize everything" ([talonvoice.com](https://talonvoice.com/)) | Same reason Raycast's `{selection}` beats Readwise's Jinja2 subroutines. If customizing a skill needs a language, the skill editor is wrong. |
| **Live-URL citations** | Perplexity's search results carry `result.title` / `result.url` ([docs.perplexity.ai](https://docs.perplexity.ai/getting-started/overview)). Whether Perplexity freezes or re-fetches its sources is **unverified** — perplexity.ai returned 403 to fetching in this session | A citation that re-resolves at read time is not reproducible: the page changes, the paywall drops, the URL 404s, and the claim is now unfalsifiable. Freezing the Source is the whole point. |
| **Eye tracking** | Talon: "mouse where you look" ([talonvoice.com](https://talonvoice.com/)) | Requires hardware, and Logue is a browser extension. Different product. |
| **Gating the core interaction behind a tier** | Aqua puts voice commands in Max at $24/mo ([aquavoice.com](https://aquavoice.com/)); MacWhisper puts app-specific prompts behind Pro at €64 ([macwhisper.com](https://www.macwhisper.com/)); Wispr Flow's free tier is 2,000 words/week on desktop, 1,000/week on iPhone ([wisprflow.ai/pricing](https://wisprflow.ai/pricing)) | Logue has no accounts and no server to meter against. A metered core would require building the exact infrastructure the product exists to avoid. |
| **Chat as the primary output surface** | Gemini Notebook, Perplexity, Mem, Recall | Logue's output is an editable Document with citations. A chat log is a place answers go to be lost. |
| **Meeting recording / audio overviews / spaced repetition** | Tana, Gemini Notebook, Recall ($10/mo Plus, $38/mo Max — [recall.it/pricing](https://www.recall.it/pricing)) | Adjacent markets with their own incumbents. Each adds a route; none strengthens capture → organize → cite-generate. |
| **A general web clipper** | Obsidian Web Clipper — free, open source, eight browsers, templates with `{{title}}` ([obsidian.md/clipper](https://obsidian.md/clipper)) | Free and better. Logue's capture only earns its place because the captured thing carries a parent chain into a cited generation. Competing on clipping alone is a loss. |

---

## Reference: verified pricing

| Product | Price | Source |
|---|---|---|
| Wispr Flow | Free (2,000 words/wk desktop, 1,000/wk iPhone); Pro $12/user/mo annual, $15 monthly | [wisprflow.ai/pricing](https://wisprflow.ai/pricing) |
| Aqua | Starter free (1,000 words/mo); Pro $8/mo; Max $24/mo; Team $12/user/mo. Cloud-only | [aquavoice.com](https://aquavoice.com/), [faq](https://aquavoice.com/info/faq) |
| Willow | Basic free; Pro $15/mo ($12 annual); Business $35/mo ($28 annual) | [willowvoice.com/pricing](https://willowvoice.com/pricing) |
| MacWhisper | Free €0; Pro €64 one-time, lifetime updates | [macwhisper.com](https://www.macwhisper.com/) |
| Superwhisper | **unverified** — no pricing page reachable; third-party figures conflict | — |
| Talon | Free downloads (macOS/Linux/Windows); Patreon for early access and priority support | [talonvoice.com](https://talonvoice.com/) |
| Voice In (Chrome) | Free tier; Plus referenced as "$60 per year" in FAQ copy — **exact current price unverified**. "Audio is transcribed in your browser — no audio or transcript is ever sent to our servers" | [dictanote.co/voicein](https://dictanote.co/voicein/) |
| AudioPen | One-time: $33/3mo, $99/yr, $159/2yr | [audiopen.ai](https://audiopen.ai/) |
| Notion | Free $0; Plus $10/mo; Business $20/mo; Enterprise custom. AI is a "Limited Trial" on Free/Plus; Custom Agents $10 per 1,000 monthly credits. Annual rates not itemized on the page | [notion.com/pricing](https://www.notion.com/pricing) |
| Raycast | Free (50 AI messages); Pro $10/mo ($8 annual); Advanced AI +$8/mo; Teams Pro $15/user/mo ($12 annual) | [raycast.com/pricing](https://www.raycast.com/pricing) |
| Obsidian | Personal free; Sync $4/mo annual ($5 monthly); Publish $8/mo per site ($10 monthly); Commercial $50/user/yr; Catalyst $25 one-time | [obsidian.md/pricing](https://obsidian.md/pricing) |
| Cursor | **unverified** | — |
| Gemini Notebook (ex-NotebookLM) | Free tier allows "up to 50 sources"; paid limits and price **unverified** | [answer/16215270](https://support.google.com/notebooklm/answer/16215270) |
| Perplexity | **unverified** — 403 on fetch | — |
| Elicit | Basic free; Pro $49/mo ($588/yr); Scale $169/mo ($2,028/yr); Enterprise custom | [elicit.com/pricing](https://elicit.com/pricing) |
| Mem | Alive as of this session; "AI that remembers", push-to-remember voice capture, web clipping. Pricing not on homepage — **unverified** | [get.mem.ai](https://get.mem.ai/) |
| Reflect | $10/mo billed annually; E2E encrypted; saved custom AI prompts; Chrome/Safari extensions | [reflect.app](https://reflect.app/) |
| Readwise | **unverified** | — |
| Capacities | Basic free (offline, full import/export); Pro and Believer prices not shown on the page — **unverified** | [capacities.io/pricing](https://capacities.io/pricing) |
| Tana | Free (5 meetings/mo); Pro $20/mo early-bird ($30); Max $80/mo ($120); Business custom | [tana.inc/pricing](https://tana.inc/pricing) |
| Heptabase | Pro $8.99/mo; Premium $17.99/mo; Premium+ $53.99/mo | [heptabase.com/pricing](https://heptabase.com/pricing) |
| Recall | Free (10 AI summaries/mo); Plus $10/mo annual; Max $38/mo annual. Account required | [recall.it/pricing](https://www.recall.it/pricing) |
| mymind | $4.99 / $7.99 / $12.99 per month tiers; Newton $299/yr (not yet available) | [access.mymind.com/pricing](https://access.mymind.com/pricing) |
| Zotero | Local `zotero.sqlite` + `storage/` folder; syncing optional | [zotero_data](https://www.zotero.org/support/zotero_data) |

## Platform risk

Google shipped Gemini into Chrome as a persistent sidebar on 2026-01-28; it can "ask questions about the current website or other open tabs", and an agentic auto-browse mode rolled out to AI Pro and Ultra subscribers in the U.S. ([techcrunch.com](https://techcrunch.com/2026/01/28/chrome-takes-on-ai-browsers-with-tighter-gemini-integration-agentic-features-for-autonomous-tasks/), [9to5google.com](https://9to5google.com/2026/01/28/gemini-chrome-side-panel-more/)). That is Logue's Side Panel "Ask about this page", free and pre-installed. Reports of a selection-triggered "Ask Gemini" toolbar are **unverified** — the 9to5Google piece covering the same announcement does not mention one.

Google Docs has had free built-in voice typing with formatting commands for years, in Chrome, Edge and Safari, with commands English-only ([support.google.com/docs/answer/4492226](https://support.google.com/docs/answer/4492226)). Logue's Google Docs proxy is Core-and-must-work, and its differentiator over the native feature is only that the dictation becomes a Material with provenance — not that it types better.

The conclusion both point at: Logue should not be sold on capture. It should be sold on what happens to the thing after it is captured.
