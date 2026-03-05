---
name: git-workflow
description: Git branching, commit, and PR workflow for Mission Control development
---

# Git Workflow

## Branch Naming
```
feature/{ticket-id}-short-description   # New features
fix/{ticket-id}-short-description       # Bug fixes
agent/{agent-name}                      # Agent worktrees (reserved)
```

## Commit Format
```
{type}({scope}): {short description}

Types: feat, fix, refactor, test, docs, chore
Scope: phase number, module name, or "agents"

Examples:
feat(16-01): add tmux-setup.sh and agent-start.sh
fix(api): correct pagination offset in tasks route
```

## Per-Task Commit Rule
- Stage only files modified by the current task
- Never `git add -A` or `git add .`
- One commit per logical change

## Pre-commit Checklist
1. `npx tsc --noEmit` → 0 errors
2. `npm run build` → succeeds (if touching routes or components)
3. No secrets or .env files staged
4. No console.log in production code

## Worktree Usage
Agent worktrees at `~/mission-control/worktrees/{coder,designer,chief}`:
- Each on branch `agent/{name}`
- Run `tools/worktree-setup.sh` to initialize
- Agent works in worktree; merge to main via PR

## Protected
- `main` branch: never force push
- External actions (deploy, publish) require Tier 3 approval
