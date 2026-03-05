# Mission Control Platform

## Project Structure
- Repo: `/Users/kevin.macarthur/git/mission-control-nextjs`
- Next.js app on localhost:3000
- SQLite database at ~/mission-control/data/mission-control.db
- Obsidian vault at ~/mission-control/memory/
- Output library at ~/mission-control/library/
- MCP servers in tools/

## Library — Output File Structure

All agent-produced files (documents, code, designs, research, media) go in `~/mission-control/library/`.

```
~/mission-control/library/
├── code/                          # standalone scripts, snippets, exports
├── design/
│   ├── ui/                        # UI mockups, Figma exports, specs
│   ├── images/                    # generated or sourced images
│   └── media/                     # video, audio, animations
├── docs/
│   ├── research/                  # research reports, analysis
│   ├── presentations/             # slide decks, pitch docs
│   └── stratagies/                # strategy docs, plans, roadmaps
├── campaigns/
│   └── campaign-{name}-{date}/    # per-campaign folder (same sub-structure)
│       ├── code/
│       ├── design/{ui,images,media}
│       └── docs/{research,presentations,stratagies}
└── projects/
    └── project-{name}-{date}/     # per-project folder (same sub-structure)
        ├── code/
        ├── design/{ui,images,media}
        └── docs/{research,presentations,stratagies}
```

### Agent → Library Routing

| Agent | Primary output location |
|-------|------------------------|
| coder / senior-coder | `library/code/` or `library/projects/{name}/code/` |
| chief | `library/code/` or `library/projects/{name}/code/` |
| designer | `library/design/ui/`, `library/design/images/`, `library/design/media/` |
| researcher | `library/docs/research/` |
| writer | `library/docs/presentations/`, `library/docs/stratagies/` |
| growth-director | `library/campaigns/{name}/`, `library/docs/stratagies/` |
| social-manager | `library/campaigns/campaign-{name}-{date}/` |
| finance-manager | `library/docs/research/` |
| voice | `library/design/media/` |
| mission-control | Creates project/campaign root folders, no direct file output |

### File Naming Convention
`YYYY-MM-DD_type_description.ext`
- `type` matches the folder: `code`, `design`, `research`, `strategy`, `presentation`
- Example: `2026-03-05_research_solana-defi-landscape.md`

### Rules
1. ALWAYS save output to library — never leave files in tmp or home directory
2. If working on a named project or campaign, use the project/campaign subfolder
3. If unsure which folder, ask Mission Control to create the project folder first
4. Mission Control creates project/campaign root folders (`library/projects/project-{name}-{date}/`)

## Agent Communication
- Use chat_post/chat_read MCP tools for async messaging
- Post task activity for all task-related updates
- Use approval_create for anything going external

## Task Lifecycle
blocked → todo → in-progress → internal-review → review → human-review → done

## Key Rules
- Always check task board before starting work
- Always post activity when making decisions
- External actions (tweets, emails, deploys) MUST go through approval_create
- P0/P1 tasks always need Clara review before done

## Skills Protocol

**Before starting any task, check if a relevant skill exists and read it.**

```
Read .claude/skills/{skill-name}/SKILL.md
```

Match your task to a skill:

| If you're doing... | Read this skill |
|--------------------|----------------|
| Writing or reviewing code | `froggo-coding-standards` |
| Writing tests | `froggo-testing-patterns` |
| Reviewing someone's code | `code-review-checklist` |
| Security review | `security-checklist` |
| Routing work to another agent | `agent-routing` |
| Breaking work into tasks | `task-decomposition` |
| Writing Next.js routes/components | `nextjs-patterns` |
| Git commits, branches, PRs | `git-workflow` |
| Social media / X content | `x-twitter-strategy` |

Skills are at `.claude/skills/{name}/SKILL.md`. Read the file — don't guess the content.
