# Logue project working rules

- Always work on the `main` branch. Do not create or use a development branch unless the user explicitly changes this rule.
- Keep commits small, atomic, and independently reviewable. Commit each verified product batch promptly and push it to `origin/main` immediately after committing.
- Do not combine unrelated UI, backend, release, documentation, or QA changes in one commit.
- The Web App UI uses English. Web App identifiers, comments, accessibility labels, and test descriptions also use English.
- Preserve user data and unrelated worktree changes. Never discard or overwrite another contributor's edits.

## Single-user data and compatibility rules

- This machine is the only supported installation and its current Logue data is the only data that must be preserved. There are no external users or deployed historical schemas to support.
- The current schema, routes, product names, defaults, and file formats are the only source of truth. Do not add or retain legacy migrations, deprecated field or route aliases, old-copy fallbacks, dual-format parsers, or compatibility fixtures unless the user explicitly requests compatibility.
- When a schema or format change affects this machine's current data, perform one explicit, backed-up, verified data update and then delete the migration code. Never keep a permanent migration path for a completed local transition.
- Installer overwrite and rollback must continue to preserve this machine's current data and recover the current installed version. This operational safety requirement does not authorize support for legacy schemas or obsolete product behavior.

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
