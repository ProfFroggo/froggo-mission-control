---
title: Library Structure
tags: [knowledge, library, files, output]
updated: 2026-03-08
---

# Mission Control — Library Structure

## Purpose

`~/mission-control/library/` is the canonical location for all agent-produced output files. Documents, code exports, design assets, research, and campaign materials all live here — never in tmp, home directory, or scattered around the filesystem.

## Directory Layout

```
~/mission-control/library/
├── code/                              # Standalone scripts, utilities, snippets
├── design/
│   ├── ui/                            # UI mockups, wireframes, specs
│   ├── images/                        # Generated or sourced images, illustrations
│   └── media/                         # Video, audio, animations, motion graphics
├── docs/
│   ├── research/                      # Research reports, market analysis, audits
│   ├── presentations/                 # Slide decks, pitch docs, demos
│   └── strategies/                    # Strategy docs, plans, roadmaps, briefs
├── campaigns/
│   └── campaign-{name}-{date}/        # One folder per campaign
│       ├── code/
│       ├── design/{ui, images, media}
│       └── docs/{research, presentations, strategies}
└── projects/
    └── project-{name}-{date}/         # One folder per project
        ├── code/
        ├── design/{ui, images, media}
        └── docs/{research, presentations, strategies}
```

## Agent → Output Folder Mapping

| Agent | Output location |
|-------|----------------|
| coder | `library/code/` or `library/projects/{name}/code/` |
| senior-coder | `library/code/` or `library/projects/{name}/code/` |
| chief | `library/docs/strategies/` |
| clara | `library/docs/research/` (review reports, audits) |
| designer | `library/design/ui/`, `library/design/images/`, `library/design/media/` |
| researcher | `library/docs/research/` |
| writer | `library/docs/presentations/`, `library/docs/strategies/` |
| growth-director | `library/campaigns/{name}/`, `library/docs/strategies/` |
| social-manager | `library/campaigns/campaign-{name}-{date}/` |
| finance-manager | `library/docs/research/` |
| hr | `library/docs/strategies/` (agent specs, onboarding docs) |
| discord-manager | `library/docs/research/`, `library/campaigns/{name}/` |
| voice | `library/design/media/` (audio), `library/docs/` (transcripts) |
| mission-control | Creates project/campaign folders; no direct file output |
| inbox | No direct file output |

## File Naming Convention

Format: `YYYY-MM-DD_type_description.ext`

- `type` matches the folder context: `code`, `design`, `research`, `strategy`, `presentation`, `audit`, `report`
- Use kebab-case for description
- Add `_draft` suffix to work-in-progress files
- Remove `_draft` when finalised

### Examples
```
2026-03-08_research_solana-defi-landscape.md
2026-03-08_strategy_q2-growth-plan.md
2026-03-08_code_wallet-connect-util.ts
2026-03-08_design_dashboard-v2-wireframe.fig
2026-03-08_presentation_seed-deck_draft.md
```

## Rules

1. **Always save to library** — never leave output files in tmp, home, or Downloads
2. **Project context first** — if working on a named project, use `library/projects/project-{name}/`
3. **Campaign context first** — if working on a campaign, use `library/campaigns/campaign-{name}/`
4. **Mission Control creates the root folder** — agents ask Mission Control to initialise a project/campaign folder before writing to it
5. **Consistent naming** — always use the `YYYY-MM-DD_type_description.ext` pattern
