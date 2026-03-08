phase: 18-approval-rules-worktrees
plan: "01"
subsystem: infra
tags: [approvals, git, worktrees, policy]
requires: [15-env-and-config]
provides:
  - APPROVAL_RULES.md — Tier 0-3 policy with per-agent matrix
  - tools/worktree-setup.sh — isolated agent git worktrees
tech-stack:
  added: []
  patterns: ["Tier-based approval escalation", "Isolated agent worktrees on agent/{name} branches"]
key-files:
  created: [APPROVAL_RULES.md, tools/worktree-setup.sh]
key-decisions:
  - "Tier 1 soft-approve auto-proceeds after 5s — low friction for common edits"
  - "Tier 3 blocks agent — irreversible external actions require human confirmation"
  - "Worktrees at ~/mission-control-worktrees/ (not inside repo)"
affects: [19, 22]
duration: 4min
completed: 2026-03-05
