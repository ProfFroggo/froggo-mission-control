# Roadmap: Mission Control — Froggo Platform

## Overview

Multi-agent AI orchestration platform. v1.0 migrated from Electron/OpenClaw to Next.js/Claude Code. v2.0 (Froggo Platform) adds operational infrastructure: tmux orchestration, enhanced memory, voice layer, per-agent capability configs, and git worktrees.

Spec sources:
- v1.0: `/Users/kevin.macarthur/Downloads/fork-merge.md`
- v2.0: `FROGGO-MIGRATION-ADDENDUM.pdf`, `FROGGO-AGENT-CAPABILITY-MATRIX.pdf`, `FROGGO-VOICE-INTEGRATION.pdf`, `FROGGO-MIGRATION-EXECUTION-PLAN.pdf`

## Milestones

- ✅ [v1.0 Migration](v1.0-migration-ARCHIVE.md) — Phases 0–14 — SHIPPED 2026-03-04
- 🚧 **v2.0 Froggo Platform** — Phases 15–22 (in progress)

---

## Completed

<details>
<summary>✅ v1.0 Migration (Phases 0–14) — SHIPPED 2026-03-04</summary>

- [x] Phase 0: Setup & Audit — 2026-03-04
- [x] Phase 1: Electron Strip + Next.js Scaffold (3/3 plans) — 2026-03-04
- [x] Phase 2: Database Layer (2/2 plans) — 2026-03-04
- [x] Phase 3: API Routes (4/4 plans) — 2026-03-04
- [x] Phase 4: Frontend Wiring (2/2 plans) — 2026-03-04
- [x] Phase 5: MCP Servers (2/2 plans) — 2026-03-04
- [x] Phase 6: Agent Definitions (2/2 plans) — 2026-03-04
- [x] Phase 7: Permission & Hook System (2/2 plans) — 2026-03-04
- [x] Phase 8: Memory System (2/2 plans) — 2026-03-04
- [x] Phase 9: Chat Rooms (2/2 plans) — 2026-03-04
- [x] Phase 10: Session Management (2/2 plans) — 2026-03-04
- [x] Phase 11: Cron & Automation (2/2 plans) — 2026-03-04
- [x] Phase 12: SSE Streaming (2/2 plans) — 2026-03-04
- [x] Phase 13: Skills (1/1 plan) — 2026-03-04
- [x] Phase 14: Final Integration & Testing (2/2 plans) — 2026-03-04

See full details: [v1.0-migration-ARCHIVE.md](v1.0-migration-ARCHIVE.md)

</details>

---

## 🚧 v2.0 Froggo Platform (In Progress)

### Phase 15: Environment & Configuration
**Goal**: Single `.env` file as source of truth for all paths + model strategy; typed `src/lib/env.ts` wrapper; `COST_STRATEGY.md` documented
**Depends on**: Phase 14
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 15-01: Create `.env` (FROGGO_DB_PATH, VAULT_PATH, PROJECT_DIR, QMD_BIN, LOG_DIR, model tiers), `src/lib/env.ts` typed wrapper, `COST_STRATEGY.md`

---

### Phase 16: Tmux Orchestration
**Goal**: `tools/tmux-setup.sh` creates named `froggo-agents` session with per-agent panes; `tools/agent-start.sh` resumes existing sessions by ID or starts new; dashboard spawn API wired to tmux panes
**Depends on**: Phase 15
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 16-01: `tools/tmux-setup.sh` — session `froggo-agents`, window 0 (panes: froggo/coder/clara/on-demand), window 1 (log monitoring), window 2 (Next.js dev server)
- [ ] 16-02: `tools/agent-start.sh` (check DB for session ID → `claude --resume` or new); update `/api/agents/[id]/spawn` to call agent-start.sh via tmux pane mapping

---

### Phase 17: Enhanced Memory MCP
**Goal**: Upgrade memory MCP from 3 tools to 4 tools with QMD BM25/vector/hybrid search; session sync hook exports to Obsidian + updates QMD index
**Depends on**: Phase 15
**Research**: Unlikely (memory MCP already exists at tools/memory-mcp/)
**Plans**: 2 plans

Plans:
- [ ] 17-01: Upgrade `tools/memory-mcp/src/index.ts` — add `memory_recall` (temporal/topic/graph), upgrade `memory_search` to QMD BM25/vector/hybrid, upgrade `memory_write` to category routing (decision/gotcha/pattern/daily/review)
- [ ] 17-02: Upgrade `tools/hooks/session-sync.js` — POST to `/api/sync-claude-sessions`, update QMD indexes, log analytics event

---

### Phase 18: APPROVAL_RULES + Git Worktrees
**Goal**: `APPROVAL_RULES.md` documents Tier 0–3 with explicit examples per agent action; git worktrees created for coder/designer/chief agents
**Depends on**: Phase 15
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 18-01: Create `APPROVAL_RULES.md` (Tier 0: auto-approve, Tier 1: soft/logged, Tier 2: review required, Tier 3: explicit human); `tools/worktree-setup.sh` creates `~/mission-control-worktrees/{coder,designer,chief}` on branches `agent/{name}`

---

### Phase 19: Per-Agent Capability Configs
**Goal**: All 13 agent SOUL.md files upgraded with full frontmatter (model tier, mode, maxTurns, allowed tools, worktree path) and real personality content
**Depends on**: Phases 15, 18
**Research**: Unlikely (full spec in FROGGO-AGENT-CAPABILITY-MATRIX.pdf)
**Plans**: 2 plans

Plans:
- [ ] 19-01: Update `.claude/settings.json` — per-agent model config, maxTurns, tool allowlists; update `CLAUDE.md` shared context with library routing table
- [ ] 19-02: Enrich all 13 SOUL.md files — real personality, role context, constraints, output routing; add `froggo-db-mcp` + `memory` MCP to all agent configs

---

### Phase 20: Agent Skill Enrichment
**Goal**: Existing 6 skills enriched with Froggo-specific context; new skills added per capability matrix
**Depends on**: Phase 19
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 20-01: Update existing 6 skills with Froggo paths/conventions; add: `x-twitter-strategy`, `nextjs-patterns`, `git-workflow`; register all in `settings.json`

---

### Phase 21: Voice Bridge
**Goal**: Gemini Live API voice bridge running — voice input → Gemini → Claude Code → response streamed back; per-agent voice personalities; `switch_agent` function call
**Depends on**: Phase 19
**Research**: Likely (Gemini Live API `gemini-2.5-flash-native-audio-preview` current SDK patterns)
**Plans**: 2 plans

Plans:
- [ ] 21-01: Create `tools/voice-bridge/` — `src/index.ts` (Gemini Live session + function call handler), `src/personality.ts` (loads agent SOUL.md → Gemini system_instruction, VOICE_MAP per agent)
- [ ] 21-02: `src/tools.ts` (Gemini FunctionDeclarations mirroring all MCP tools + `delegate_to_claude` + `switch_agent`); `/api/voice/status` endpoint; voice bridge start/stop from dashboard

---

### Phase 22: E2E Verification v2.0
**Goal**: All v2.0 components verified end-to-end — tmux sessions start, agents resume, memory search works, approval tiers fire correctly, voice bridge connects
**Depends on**: All v2.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 22-01: E2E smoke test — tmux session start, agent spawn/resume, memory write/search, Tier 1 approval auto-approve, Tier 3 approval queues for human, voice bridge handshake

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Setup & Audit | v1.0 | — | Complete | 2026-03-04 |
| 1. Electron Strip | v1.0 | 3/3 | Complete | 2026-03-04 |
| 2. Database Layer | v1.0 | 2/2 | Complete | 2026-03-04 |
| 3. API Routes | v1.0 | 4/4 | Complete | 2026-03-04 |
| 4. Frontend Wiring | v1.0 | 2/2 | Complete | 2026-03-04 |
| 5. MCP Servers | v1.0 | 2/2 | Complete | 2026-03-04 |
| 6. Agent Definitions | v1.0 | 2/2 | Complete | 2026-03-04 |
| 7. Permission & Hooks | v1.0 | 2/2 | Complete | 2026-03-04 |
| 8. Memory System | v1.0 | 2/2 | Complete | 2026-03-04 |
| 9. Chat Rooms | v1.0 | 2/2 | Complete | 2026-03-04 |
| 10. Session Management | v1.0 | 2/2 | Complete | 2026-03-04 |
| 11. Cron & Automation | v1.0 | 2/2 | Complete | 2026-03-04 |
| 12. SSE Streaming | v1.0 | 2/2 | Complete | 2026-03-04 |
| 13. Skills | v1.0 | 1/1 | Complete | 2026-03-04 |
| 14. Final Integration | v1.0 | 2/2 | Complete | 2026-03-04 |
| 15. Env & Config | v2.0 | 0/1 | Not started | — |
| 16. Tmux Orchestration | v2.0 | 0/2 | Not started | — |
| 17. Enhanced Memory MCP | v2.0 | 0/2 | Not started | — |
| 18. Approval Rules + Worktrees | v2.0 | 0/1 | Not started | — |
| 19. Per-Agent Capabilities | v2.0 | 0/2 | Not started | — |
| 20. Skill Enrichment | v2.0 | 0/1 | Not started | — |
| 21. Voice Bridge | v2.0 | 0/2 | Not started | — |
| 22. E2E Verification v2.0 | v2.0 | 0/1 | Not started | — |

**Migration Status: v1.0 COMPLETE — v2.0 READY TO START**
