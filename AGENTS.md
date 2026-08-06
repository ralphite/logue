# Logue project working rules

- Always work on the `main` branch. Do not create or use a development branch unless the user explicitly changes this rule.
- Keep commits small, atomic, and independently reviewable. Commit each verified product batch promptly and push it to `origin/main` immediately after committing.
- Do not combine unrelated UI, backend, release, documentation, or QA changes in one commit.
- The Web App UI uses English. Web App identifiers, comments, accessibility labels, and test descriptions also use English.
- Preserve user data and unrelated worktree changes. Never discard or overwrite another contributor's edits.

## Product authority and decision review

- Product authority order is: the user's latest explicit decision, the current V2 product definition, accepted V2 UI/UX, then reusable invisible engineering primitives. Old UI, existing code, mocks, tests, reviewers, and implementation convenience may not override that order.
- Logue does not download, run, recommend, or manage local AI models. `local-first` applies to the Logue Host, private data, and user control. Model setup connects only to an explicitly supported remote provider and must state the processing boundary.
- The complete confirmed V2 feature scope remains required. Core focus sets implementation order; it never authorizes deleting, refusing, or indefinitely postponing a confirmed feature. Do not add an unconfirmed product direction merely because it is technically possible or an old implementation exists.
- Before implementing any decision that adds, removes, or postpones a confirmed feature, or changes primary IA, product objects, default journeys, provider/model boundaries, permissions, data deletion or migration, installation/release, or a cross-surface contract, record the proposed decision in `DECISIONS_AND_RISKS.md` and run three fresh-context, independent, read-only reviews in parallel: scope/product-authority, product/UX, and engineering/runtime. Any direct conflict with an explicit user decision requires `REPLAN`; product scope, default UX, and major boundaries require the user's approval. Ordinary local implementation choices do not trigger this gate.
- Reviewers may block an inconsistent implementation but may not invent scope, remove confirmed features, or replace the user's product decision. Keep a single decision identifier and remove stale contradictory product text instead of preserving parallel interpretations.
- Capability status is strictly `SPECIFIED → CODED → INTEGRATED → RUNTIME_WORKING`. Only `RUNTIME_WORKING` may be reported as a real user capability. Code presence, mock behavior, documentation, tests, screenshots, component review, or commits alone do not prove product progress.
- Basic usability is a continuous quality floor, not deferred polish. Never knowingly leave the production product with broken layout, unreadable hierarchy, raw markup displayed as content, conflicting UI systems, or a blocked canonical journey while expanding to another feature. Pixel refinement and comprehensive QA may wait; a coherent usable interface may not.

## Required delivery phase order

- Always execute the product work in this order: (1) build all confirmed features and cross-surface contracts; (2) after all features are coded and integrated, perform one consolidated code review and compare every item with the V2 product specification; (3) after code/spec gaps are fixed, perform the multi-agent UX review and obtain the user's UX acceptance; (4) only then perform UI review and polish; (5) only after UI completion run comprehensive real-environment QA and release validation.
- During the build-all phase, maintain a complete feature inventory and use it as the implementation queue. Continue through the inventory without opening code-review, product-completeness, UX, UI, or broad QA loops between ordinary feature batches. Only minimal blocking compile/static checks and direct implementation debugging are allowed.
- During the build-all phase, do not run Browser/Computer Use QA, visual walkthroughs, screenshot capture, Storybook acceptance, or designer runtime gates. Browser control is allowed only for one narrow diagnosis when a real runtime failure completely blocks implementation and static investigation cannot identify it. Defer browser-based QA to the later UX/UI/QA phases.
- The important-decision review gate above still applies before a material product decision. It is an exception for preventing unauthorized scope or contract changes, not permission to review every implementation batch.
- During the build-all phase, report only what became `CODED` or `INTEGRATED`, which confirmed inventory items remain, and the next feature. Do not call the product usable, complete, or runtime-verified before the later review phases establish that evidence.

## Single-user data and compatibility rules

- This machine is the only supported installation and its current Logue data is the only data that must be preserved. There are no external users or deployed historical schemas to support.
- The current schema, routes, product names, defaults, and file formats are the only source of truth. Do not add or retain legacy migrations, deprecated field or route aliases, old-copy fallbacks, dual-format parsers, or compatibility fixtures unless the user explicitly requests compatibility.
- When a schema or format change affects this machine's current data, perform one explicit, backed-up, verified data update and then delete the migration code. Never keep a permanent migration path for a completed local transition.
- Installer overwrite and rollback must continue to preserve this machine's current data and recover the current installed version. This operational safety requirement does not authorize support for legacy schemas or obsolete product behavior.

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
