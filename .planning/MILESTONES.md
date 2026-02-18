# Milestones

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
