# Milestones

## v3.0 — App-Wide Polish & X/Twitter Overhaul (Complete)

**Completed:** 2026-02-18
**Duration:** 1 day across 21 plans
**Phases:** 9 (Global UI Consistency → Finance End-to-End Wiring)
**Requirements:** 50/50 complete

**Summary:** Rebuilt X/Twitter page from scratch (X branding, 8-tab nav, calendar with drag-to-reschedule, mentions with inline reply, reply guy with inline controls, automations rule builder, analytics with competitor insights). Standardized dark mode UI tokens across all 40+ components. Fixed writing pane layout. Populated Library with real agent skills. Wired Finance page end-to-end (CLI JSON output, budget creation modal, PDF upload, agent chat styling).

**Key outcomes:**
- X/Twitter page: 8 tabs, calendar, drag-reschedule, mentions, reply guy, automations, analytics with downloadable report
- Global dark mode: CSS token system (`--clawd-bg-alt/bg0/card`), consistent chat bubbles, pinned input bars
- Finance CLI: `--format json` on all 4 commands, alerts crash fixed, budget creation modal, PDF routing
- Writing panes: pixel-based minimums (180px/280px/300px), visible drag handles on first load
- Library: 66 agent skills from DB, 9-category file taxonomy with inline tagging

**Stats:**
- 67 files modified, +9,081 / -989 lines
- ~118K lines TypeScript total
- 9 phases, 21 plans, ~42 tasks
- 1 day (2026-02-18)

**Git range:** `feat(13-01)` → `feat(21-02)`

**Archive:** `.planning/milestones/v3.0-ROADMAP.md`

---

## v1.0 — Dashboard Hardening (Complete)

**Completed:** 2026-02-12
**Duration:** ~161min across 12 plans
**Phases:** 4 (Security Hardening → Fix Broken Features → Functional Fixes → Cleanup & Debloat)
**Requirements:** 35/35 complete

**Summary:** Took Froggo.app from "functional but leaking" to production-grade. Removed hardcoded credentials, fixed SQL injection, locked down IPC, fixed broken features, eliminated dead code.

**Key outcomes:**
- All credentials moved to keychain/env vars
- 156 SQL queries parameterized
- 10 broken features fixed
- 10 functional bugs resolved
- ~1,200 lines of dead code removed

**Last phase:** Phase 4 (Cleanup & Debloat)

---

## v2.0 — Writing System (Complete)

**Completed:** 2026-02-13
**Duration:** ~39min across 12 plans
**Phases:** 6 (Foundation → Inline Feedback → Memory Store → Research Library → Outline & Versions → Jess Integration)
**Requirements:** 44/44 complete

**Summary:** Built AI-collaborative long-form writing module with chapter-based editor, inline feedback (highlight → chat → iterate), multi-agent support (Writer, Researcher, Jess), memory stores, research library, and version history.

**Key outcomes:**
- TipTap rich text editor with autosave
- Inline feedback with streaming AI alternatives
- Memory store (characters, timeline, facts) with AI context injection
- Per-project SQLite research library with fact-checking
- Drag-and-drop chapter reordering
- Version snapshots with diff comparison
- 3 agent integrations (Writer, Researcher, Jess)

**Last phase:** Phase 10 (Jess Integration)

---

## v2.1 — Writing UX Redesign (Complete)

**Completed:** 2026-02-13
**Duration:** ~32min across 8 plans
**Phases:** 2 (Chat Pane + 3-Pane Layout → Setup Wizard)
**Requirements:** 26/26 complete

**Summary:** Transformed the writing module into an AI-powered book creation system. Added conversational AI chat in a persistent 3-pane layout (chapters | AI chat | workspace) and a setup wizard that plans books before writing begins.

**Key outcomes:**
- 3-pane resizable layout with drag handles and collapsible panes
- Persistent AI chat with streaming responses and agent switching (Writer, Researcher, Jess)
- Chat-to-editor content insertion (send AI prose to TipTap with one click)
- Conversational setup wizard with brain dump → AI planning → review → create flow
- Atomic project creation populating chapters, characters, and timeline from wizard
- Wizard state persistence for resume-on-restart
- Genre flexibility beyond memoir/novel

**Last phase:** Phase 12 (Setup Wizard)
