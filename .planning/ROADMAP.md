# Roadmap: Froggo.app

## Milestones

- [x] **v1.0 Dashboard Hardening** - Phases 1-4 (shipped 2026-02-12)
- [x] **v2.0 Writing System** - Phases 5-10 (shipped 2026-02-13)
- [ ] **v2.1 Writing UX Redesign** - Phases 11-12 (in progress)

## Phases

<details>
<summary>v1.0 Dashboard Hardening (Phases 1-4) - SHIPPED 2026-02-12</summary>

### Phase 1: Security Hardening
**Goal**: No security vulnerabilities remain in shipped source code
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. `grep -r` for known API tokens returns zero hits in src/ and electron/
  2. DevTools cannot be opened in the packaged Froggo.app
  3. SQL injection via task title does not execute
  4. Filesystem IPC handlers refuse paths outside allowed directories
  5. Encryption key loaded from environment or keychain, not hardcoded
**Plans**: 6/6 complete

### Phase 2: Fix Broken Features
**Goal**: Every feature works and every data indicator reflects live reality
**Depends on**: Phase 1
**Requirements**: FIX-01 through FIX-10
**Plans**: 2/2 complete

### Phase 3: Functional Fixes
**Goal**: App behaves correctly under all conditions including edge cases
**Depends on**: Phase 2
**Requirements**: FUNC-01 through FUNC-10
**Plans**: 2/2 complete

### Phase 4: Cleanup & Debloat
**Goal**: Lean codebase with no dead files, dead code, or broken styling
**Depends on**: Phase 3
**Requirements**: CLEAN-01 through CLEAN-08
**Plans**: 2/2 complete

</details>

<details>
<summary>v2.0 Writing System (Phases 5-10) - SHIPPED 2026-02-13</summary>

### Phase 5: Foundation
**Goal**: User can create writing projects, manage chapters, and write prose in a rich text editor with autosave
**Depends on**: Nothing (first v2 phase; v1 dashboard is stable)
**Requirements**: FOUND-01 through FOUND-10, EDIT-01 through EDIT-05
**Plans**: 3/3 complete

### Phase 6: Inline Feedback
**Goal**: User can highlight text and get AI-powered alternatives from agents, streamed in real-time
**Depends on**: Phase 5
**Requirements**: FEED-01 through FEED-08, AGENT-01, AGENT-04, AGENT-05
**Plans**: 2/2 complete

### Phase 7: Memory Store
**Goal**: User can maintain character profiles, timeline events, and verified facts that are automatically injected into AI context
**Depends on**: Phase 6
**Requirements**: MEM-01 through MEM-06
**Plans**: 2/2 complete

### Phase 8: Research Library
**Goal**: User can manage research sources and use the Researcher agent to fact-check claims
**Depends on**: Phase 7
**Requirements**: RES-01 through RES-05, AGENT-02
**Plans**: 2/2 complete

### Phase 9: Outline & Versions
**Goal**: User can reorganize chapters and compare version history before and after major edits
**Depends on**: Phase 5
**Requirements**: OUT-01 through OUT-05
**Plans**: 2/2 complete

### Phase 10: Jess Integration
**Goal**: User can get emotional and memoir-specific guidance from Jess when writing sensitive content
**Depends on**: Phase 6
**Requirements**: AGENT-03
**Plans**: 1/1 complete

</details>

### v2.1 Writing UX Redesign (Active)

**Milestone Goal:** Transform the writing module into an AI-powered book creation system with conversational AI chat driving content into the editor, and a setup wizard that plans the book before writing begins.

**Phase Numbering:**
- Integer phases (11, 12): Planned milestone work
- Decimal phases (11.1, 11.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 11: Chat Pane + 3-Pane Layout** - Persistent AI chat alongside the editor in a resizable 3-pane layout with chat-to-editor content flow
- [ ] **Phase 12: Setup Wizard** - Conversational AI wizard that plans a book (arc, chapters, characters) before writing begins

## Phase Details

### Phase 11: Chat Pane + 3-Pane Layout
**Goal**: User can chat with AI agents in a persistent pane alongside the editor, within a resizable 3-pane layout, and insert AI-generated content into the editor
**Depends on**: Phase 10 (uses v2.0 writing infrastructure: TipTap editor, gateway streaming, agent sessions, memory store)
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-10, LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05
**Success Criteria** (what must be TRUE):
  1. User can open the writing workspace and see a 3-pane layout (chapters sidebar, AI chat pane, content workspace) with drag-resizable and collapsible panes
  2. User can select an agent (Writer, Researcher, Jess) and send messages in the chat pane, with AI responses streaming in token by token
  3. User can click "Send to editor" on an AI chat message and see the content inserted into the current chapter at the cursor position or end of document
  4. User can close and reopen the app, and chat history, pane sizes, and collapse states are all preserved
  5. Layout renders correctly at window widths from 1024px to 1920px+ without overflow or broken panes
**Plans**: 4 plans

Plans:
- [ ] 11-01-PLAN.md — Chat stores, pendingInsert mechanism, shared context utility, chat history IPC
- [ ] 11-02-PLAN.md — Install npm packages, 3-pane resizable layout, CSS
- [ ] 11-03-PLAN.md — ChatPane/ChatMessage/ChatInput components, gateway streaming, editor insertion
- [ ] 11-04-PLAN.md — Session key fix, copy/retry actions, persistence verification, human verify

### Phase 12: Setup Wizard
**Goal**: User can create a new book project through a conversational AI wizard that plans the story arc, chapter outline, themes, and characters before writing begins
**Depends on**: Phase 11 (uses chat infrastructure, gateway patterns, and 3-pane layout for the resulting project)
**Requirements**: WIZARD-01, WIZARD-02, WIZARD-03, WIZARD-04, WIZARD-05, WIZARD-06, WIZARD-07, WIZARD-08, WIZARD-09, WIZARD-10, WIZARD-11
**Success Criteria** (what must be TRUE):
  1. User can start a new book and enter a brain dump description, then converse with an AI agent that proposes a story arc, chapter outline, and character profiles
  2. User can review the proposed plan (chapters, characters, arc) and edit any element before confirming project creation
  3. On wizard completion, the project is created with chapters, characters, and timeline pre-populated in the memory store -- no manual re-entry needed
  4. User can quit mid-wizard, restart the app, and resume the wizard conversation where they left off
  5. User can skip the wizard entirely and use quick-create (existing title + type form) for any project
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 11.1 -> 11.2 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4 | v1.0 | 12/12 | Complete | 2026-02-12 |
| 5-10 | v2.0 | 12/12 | Complete | 2026-02-13 |
| 11. Chat Pane + 3-Pane Layout | v2.1 | 0/4 | Planned | - |
| 12. Setup Wizard | v2.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-12*
*Last updated: 2026-02-13 -- v2.1 milestone phases added (11-12)*
