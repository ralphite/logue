# Logue project working rules

- Always work on the `main` branch. Do not create or use a development branch unless the user explicitly changes this rule.
- Keep commits small, atomic, and independently reviewable. Commit each verified product batch promptly and push it to `origin/main` immediately after committing.
- Do not combine unrelated UI, backend, release, documentation, or QA changes in one commit.
- The Web App UI uses English. Web App identifiers, comments, accessibility labels, and test descriptions also use English.
- Preserve unrelated worktree changes. Never discard or overwrite another contributor's edits.

## Single-user data and compatibility rules

- There are no external users or deployed historical schemas. Existing code, UI, schema, routes, product names, defaults, file formats, and current local data are disposable prototype inputs, not product constraints or sources of truth.
- Design and implement from the latest user outcome and current product specification. Freely replace or delete existing flows, objects, routes, storage formats, and components when a better product requires it; do not preserve a path merely because it already exists.
- Do not add or retain legacy migrations, deprecated field or route aliases, old-copy fallbacks, dual-format parsers, compatibility fixtures, or parallel old/new UI. Cut over cleanly.
- Before a destructive local data transition, create a recoverable backup when practical and attempt one explicit best-effort import. Migration success is not a release blocker; report records that could not be imported, then delete the migration code and obsolete storage.
- Installer rollback must recover the installed program version. Preserving pre-redesign prototype data is not a rollback or release requirement unless the user explicitly restores that constraint.

## Prototype delivery and complexity discipline

- Optimize first for the user's normal, high-frequency workflow working directly and reliably. A prototype with fewer working paths is better than a broader system whose main path is blocked by speculative safeguards.
- Do not add guards, lifecycle checks, state transitions, validation, fallbacks, retries, compatibility layers, or edge-case handling merely because a failure is imaginable. Add complexity only when a real, reproducible user problem or an explicit requirement proves that its benefit exceeds its cost to the primary flow.
- Prefer the smallest direct implementation that satisfies the current user outcome. Every additional condition must have a named user-visible failure it prevents, a clear owner, and a realistic removal path if it later blocks normal use.
- When a safeguard conflicts with normal use, preserve the normal workflow and make the exceptional case recoverable rather than silently preventing the primary action. Do not turn uncertain background state into a hard stop.
- Diagnose concrete failures from the real product before generalizing a solution. Do not spend prototype time pre-solving hypothetical lifecycle, compatibility, migration, permission, or concurrency scenarios while requested core features remain incomplete.
- Revisit hardening only after the requested end-to-end workflow is working and the user asks for it, or when direct runtime evidence shows it is necessary to protect data, privacy, or a completed primary action.

## Non-negotiable product design rules

- Internal consistency is the minimum quality bar. Navigation, content axes, typography, spacing, buttons, tooltips, selected/hover/focus states, drawers, dialogs, and resizers must come from shared product patterns. A page must not invent a local visual language.
- Minimalism means removing UI, not shrinking it. Every visible word, status, icon, divider, card, and action must justify a current user decision or task. Delete promotional subtitles, redundant explanations, normal success states, duplicate actions, and technical implementation details.
- Keep normal operation quiet. Autosave, connectivity, background organization, and successful Agent work stay invisible unless the user must act. Show concise, local errors and low-confidence review states only when needed.
- Use progressive disclosure. Put useful but nonessential explanation in an accessible tooltip or a clearly labeled advanced disclosure; never leave long helper paragraphs in the primary flow.
- Use product language, not technical names. The current reusable prompt feature is called `Skills` in the UI; reserve `Agents` for future autonomous features with triggers, tools, permissions, and runs.
- Desktop content must use the shared page, editor, and reading axes. Side panels use shared responsive min/default/max rules, open wide enough to be useful, and remain resizable. Never leave a narrow panel beside unused whitespace.
- Text must remain comfortably readable without browser zoom. Do not solve density by dropping formal UI text below the shared type scale.
- Use real `app.notion.com` and `chatgpt.com` screens in the browser as the polish benchmark. Capture matching Notion/Logue screenshots and judge hierarchy, density, alignment, width, interaction states, and noise—not superficial color similarity.
- Before and after every large user-visible feature or UI/UX change, spawn or reuse the project `logue_product_designer` agent from `.codex/agents/logue-product-designer.toml`. It must remain read-only, inspect the real runtime, compare against current Notion screenshots, and block completion when consistency or minimalism fails.
