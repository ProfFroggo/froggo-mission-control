# UI Review — Session Entry Point

## READ THIS FIRST EVERY SESSION

This is the Froggo Mission Control UI review project.
Goal: Review all 113 app screenshots as a world-class UI/UX designer and apply code fixes.

## Quick Start

```bash
# 1. See where we are
cat /Users/kevin.macarthur/git/froggo-mission-control/.planning/ui-review/PROGRESS.md | grep "\[ \]" | head -1

# 2. Read the full criteria
cat /Users/kevin.macarthur/git/froggo-mission-control/.planning/ui-review/CRITERIA.md

# 3. Pull latest
cd ~/git/froggo-mission-control && git checkout dev && git pull
```

## Context

- **Repo**: `~/git/froggo-mission-control` — Next.js 16 app
- **Branch**: `dev` (never commit to main directly)
- **Dev server**: `npm run dev -- --port 3001`
- **Build verify**: `npm run build:verify` (outputs to `.next-verify/`, never breaks running server)
- **Screenshots**: `/Users/kevin.macarthur/Froggo UI/` (113 PNG files, sorted by timestamp)
- **Design system**: Radix Themes 3 (`accentColor="violet"`). See CRITERIA.md for full rules.

## Design System Quick Reference

| Element | Pattern |
|---------|---------|
| Primary CTA | `<Button variant="solid">` — violet accent ONLY |
| Destructive | `<Button color="red">` |
| Secondary | `<Button variant="soft">` or `variant="ghost"` |
| Icon button | `<IconButton variant="ghost" size="2">` |
| Nav tabs | raw `<button>` + `border-b-2 border-accent` active |
| Segment toggle | raw `<button>` in bordered container, `bg-accent/10` active |
| Empty states | `<EmptyState>` component with icon + title + description + action |
| Toasts | `showToast('success'|'error'|'warning'|'info', title, desc)` |

## Known Cross-Cutting Issues (already identified, fix as you encounter)

1. Green CTAs (`color="green"`) → change to accent/violet (P1)
2. `99+` badge caps → show real numbers (P1)
3. Raw cron notation (`0 23 * * *`) → human-readable ("Daily at 11:00 PM") (P2)
4. Red downward arrows on empty/zero KPI data → show neutral dash (P2)
5. "---" as skill card description → filter out, show "No description" (P3)
6. Checklist items: checkboxes squished together → add `space-y-2` (P3)
7. Calendar Account dropdown empty in create event dialog (P1)
8. Agent dot color has no legend on hover (P3)

## Commit Convention
```
fix(ui-review): session N — <ScreenName> — <what was fixed>
```
Example: `fix(ui-review): session 12 — AgentPanel — green CTA → violet, status dot tooltip`

## Session Loop (autonomous)

1. Read PROGRESS.md → find first `[ ]`
2. Read the screenshot via Read tool
3. Apply CRITERIA.md 10-point framework
4. Grep for relevant component files, read them
5. Fix issues (spawn agents for large changes, inline for small)
6. `npm run build:verify` → must pass
7. `git add -A && git commit`
8. Update PROGRESS.md: `[ ]` → `[x]` + one-line fix summary
9. Repeat until all 113 done OR context limit approached

**Context limit**: If approaching limit, commit current work, update PROGRESS.md, stop. Next session picks up from first `[ ]`.
