# Logue — feature contract

One sentence: **capture voice and selections anywhere in the browser, keep them as traceable local Materials organized by Projects, and generate answers and documents whose every claim cites a frozen Source.**

Local-first: one zero-dependency Python 3.13 Host owns all data on this machine (or a LAN Linux box). No accounts.

```
Chrome Extension ──┐
                   ├──► Host (127.0.0.1:8787, http.server, JSON store)
Web App ───────────┘         └── Gemini (transcription + generation)
```

## Exposure levels

- **Core** — visible by default. The value loop: capture → organize → generate with sources.
- **Secondary** — kept, works, but folded behind a disclosure (▾ / ⋯ / settings section).
- **Hidden-UI** — data still recorded (provenance is non-negotiable), no interface. Listed so nobody "rediscovers" a missing panel as a bug.

Nothing else was removed.

## Host domains

| Domain | What it owns | Level |
|---|---|---|
| materials | voice/selection/text/page/derived items; `parent_ids` chain; project + topic membership; organization (duplicate-of, exclude) | Core |
| projects | overview, confirmed terms, transcription profile, skill bindings | Core |
| documents | editable generated docs, autosave revisions, `[Source n]` citations | Core |
| skills | reusable prompts incl. built-in Ask/Draft; revisions recorded | Core (revisions Hidden-UI) |
| runs | every generation: frozen source set + skill revision + citations + status | Core |
| captures | original audio bytes + frozen capture context | Core |
| ai | provider config (Gemini), health per capability, transcribe, generate | Core |
| topics | auto/manual topic grouping of materials | Secondary |
| topic-vocabularies | per-topic term lists feeding transcription | Secondary |
| corrections | heard→preferred, scopes once/topic/project/global | Core control, Secondary scopes |
| backups | export bundle, restore with pre-restore backup | Core export, Secondary restore |
| clients | pairing for LAN deployments (Linux host + Mac Chrome) | Secondary |
| settings | data dir, voice defaults, model connection | Core |

## Extension

| Piece | What it does | Level |
|---|---|---|
| Inline voice bar | caret-anchored mic in any editable field; record → candidate → insert/undo | Core |
| Selection toolbar | save selection · voice/text comment · run skill on selection | Core |
| Candidate panel | edit transcript, insert (⌘↵), one-line settled state, correction fold | Core |
| Command launcher | ask/draft at the caret (⌘⇧M) | Secondary (kept; Ask also lives in panel) |
| Side Panel | capture page, assign project, Ask with sources, recent work | Core |
| **Google Docs proxy** | voice write into Docs' canvas editor via background proxy | **Core — must work** |
| Voice profile picker | 3 rows: profile / language / vocabulary | Secondary (behind ▾) |

Behavioral spec carried from the field (regressions must not return):
- Shadow host parents into `<body>` (a host under `<html>` never paints on Notion).
- Shadow root declares `color-scheme: light` so native dropdowns don't render dark.
- Caret in an empty block anchors to that block's content start, not the field corner.
- Every text control is a real `<select>`/`<input>` — no datalist look-alikes.

## Web (five top-level destinations)

| Route | Content | Level |
|---|---|---|
| Stream | everything captured, newest first; search; assign/exclude/delete | Core |
| Projects | context, terms, members, project runs, draft from here | Core |
| Documents | Notion-like list + editor, autosave, citations panel, export md | Core |
| Skills | built-ins + own skills, edit prompt, defaults per surface | Core (archive-impact, revision pinning: Hidden-UI) |
| Settings | model connect (test→save), voice defaults, data/backup, LAN pairing | Core (pairing Secondary) |

## Hidden-UI (recorded, no panels)

- Skill revision pinning/browsing (runs still store the exact revision)
- Transcript revision browser (re-transcriptions still versioned)
- Classification memories (auto-topic reasoning stays internal)

## Non-goals now

Multi-tenant, sync services, mobile, non-Chrome browsers, plugin marketplaces.
