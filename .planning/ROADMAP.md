# Roadmap: Froggo.app

## Milestones

- [x] **v1.0 Dashboard Hardening** - Phases 1-4 (shipped 2026-02-12)
- [ ] **v2.0 Writing System** - Phases 5-10 (in progress)

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

### v2.0 Writing System (Active)

**Milestone Goal:** Kevin can write a complete memoir using AI-collaborative inline feedback -- highlight any passage, get contextual alternatives from the right agent, and maintain consistency across hundreds of chapters.

**Phase Numbering:**
- Integer phases (5, 6, 7...): Planned milestone work
- Decimal phases (5.1, 5.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 5: Foundation** - Project CRUD, TipTap editor, chapter management, file storage
- [ ] **Phase 6: Inline Feedback** - Highlight-to-chat, AI alternatives, streaming, agent routing
- [ ] **Phase 7: Memory Store** - Characters, timeline, facts, context injection
- [ ] **Phase 8: Research Library** - Sources, fact-checking, Researcher agent
- [ ] **Phase 9: Outline & Versions** - Chapter navigation, drag-drop, diff comparison
- [ ] **Phase 10: Jess Integration** - Emotional guidance, memoir-specific support

## Phase Details

### Phase 5: Foundation
**Goal**: User can create writing projects, manage chapters, and write prose in a rich text editor with autosave
**Depends on**: Nothing (first v2 phase; v1 dashboard is stable)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05
**Success Criteria** (what must be TRUE):
  1. User can create a writing project with title and type, and see all projects listed with word count and chapter count
  2. User can create, rename, and delete chapters within a project
  3. User can write prose in the TipTap editor with formatting (headings, bold, italic, lists, blockquotes, links) and changes auto-save without a manual save button
  4. User can navigate between chapters via the outline sidebar and see word counts per chapter and project total
  5. Writing workspace is accessible from the main dashboard sidebar alongside existing panels (Kanban, Chat, etc.) and projects are stored as file-based structure (markdown chapters, JSON metadata)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Inline Feedback
**Goal**: User can highlight text and get AI-powered alternatives from agents, streamed in real-time
**Depends on**: Phase 5
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08, AGENT-01, AGENT-04, AGENT-05
**Success Criteria** (what must be TRUE):
  1. User can highlight text in the editor and see a feedback popover with an input field
  2. User can send feedback instructions to the Writer agent and see 2-3 alternative versions stream in real-time (not blank-then-full)
  3. User can accept an alternative (replaces highlighted text) or dismiss, and the interaction is logged per chapter
  4. User can select which agent (Writer, Researcher, Jess) to send feedback to, and agent sessions persist within the project
  5. AI context includes current chapter content, project outline, and memory store data (when available), communicated via existing OpenClaw Gateway WebSocket
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Memory Store
**Goal**: User can maintain character profiles, timeline events, and verified facts that are automatically injected into AI context
**Depends on**: Phase 6
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete character profiles (name, relationship, description, traits) in the context panel alongside the editor
  2. User can create, edit, and delete timeline events (date, description, chapter references) in the context panel
  3. User can create, edit, and delete verified facts (claim, source, status) in the context panel
  4. Memory store data is automatically included in AI agent context for feedback requests, and persists as JSON files per project
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Research Library
**Goal**: User can manage research sources and use the Researcher agent to fact-check claims
**Depends on**: Phase 7
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, AGENT-02
**Success Criteria** (what must be TRUE):
  1. User can add research sources (title, author, type, URL, notes) to a per-project library stored in SQLite
  2. User can link sources to facts in the memory store and mark facts as verified/disputed/needs-source
  3. User can highlight a claim in the editor and ask the Researcher agent to fact-check it, receiving source-backed verification
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Outline & Versions
**Goal**: User can reorganize chapters and compare version history before and after major edits
**Depends on**: Phase 5 (uses chapter structure from foundation)
**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04, OUT-05
**Success Criteria** (what must be TRUE):
  1. User can see the project outline as a collapsible chapter tree and reorder chapters via drag-and-drop
  2. User can save a version snapshot of a chapter before a major edit
  3. User can view previous versions and restore one, with a diff comparison showing what changed between versions
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Jess Integration
**Goal**: User can get emotional and memoir-specific guidance from Jess when writing sensitive content
**Depends on**: Phase 6 (uses inline feedback infrastructure)
**Requirements**: AGENT-03
**Success Criteria** (what must be TRUE):
  1. User can select Jess from the agent picker and receive emotionally attuned feedback specific to memoir writing (pacing, boundaries, tone)
  2. Jess feedback is contextually distinct from Writer feedback -- addresses emotional impact, not just prose quality
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 5.1 -> 5.2 -> 6 -> ... -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4 | v1.0 | 12/12 | Complete | 2026-02-12 |
| 5. Foundation | v2.0 | 0/3 | Not started | - |
| 6. Inline Feedback | v2.0 | 0/3 | Not started | - |
| 7. Memory Store | v2.0 | 0/2 | Not started | - |
| 8. Research Library | v2.0 | 0/2 | Not started | - |
| 9. Outline & Versions | v2.0 | 0/2 | Not started | - |
| 10. Jess Integration | v2.0 | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-12*
*Last updated: 2026-02-12*
